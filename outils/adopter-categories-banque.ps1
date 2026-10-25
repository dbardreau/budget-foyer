# Bascule des categories de data.js vers celles de l'application bancaire.
#
# Pourquoi : les categories du site (maison) ne correspondaient pas a celles
# de l'appli bancaire, ce qui obligeait a refaire des correspondances a chaque
# export. On reconstruit ici les depenses janvier -> septembre 2026 directement
# depuis l'export, avec les categories parentes et les sous-categories de la
# banque. Resultat : un export = un import, sans retraitement.
#
# Regles particulieres conservees :
#   - le loyer de 940 EUR debite le 02/03/2026 est le loyer de FEVRIER :
#     il reste affecte a fevrier (choix de l'utilisateur), le loyer du 30/03
#     reste en mars.
#   - les revenus ne sont pas touches, sauf la ligne « solde mois precedent »
#     remise a 0 (elle portait -300 en janvier et +300 en juin).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File outils\adopter-categories-banque.ps1

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$racine = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cheminData = Join-Path $racine 'data.js'
$cheminCsv = (Get-ChildItem (Join-Path $racine 'exports') -Filter '*.csv' -File | Sort-Object Length -Descending | Select-Object -First 1).FullName

$cultureFR = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
function Montant { param([double]$v) return ($v.ToString('N2', $cultureFR) + ' €') }
function Lit-Montant {
    param([string]$s)
    if ([string]::IsNullOrWhiteSpace($s)) { return 0.0 }
    $t = ($s -replace '[^\d,\.\-]', '')
    if ($t -eq '' -or $t -eq '-') { return 0.0 }
    if ($t.Contains(',') -and $t.Contains('.')) { $t = $t -replace '\.', '' -replace ',', '.' }
    elseif ($t.Contains(',')) { $t = $t -replace ',', '.' }
    return [double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture)
}

function Split-LigneCsv {
    param([string]$Ligne)
    $champs = New-Object System.Collections.Generic.List[string]
    $courant = New-Object Text.StringBuilder
    $q = $false
    for ($i = 0; $i -lt $Ligne.Length; $i++) {
        $c = $Ligne[$i]
        if ($c -eq '"') {
            if ($q -and ($i + 1) -lt $Ligne.Length -and $Ligne[$i + 1] -eq '"') { [void]$courant.Append('"'); $i++ }
            else { $q = -not $q }
        } elseif ($c -eq ';' -and -not $q) { $champs.Add($courant.ToString()); [void]$courant.Clear() }
        else { [void]$courant.Append($c) }
    }
    $champs.Add($courant.ToString())
    return $champs.ToArray()
}

# ---------------------------------------------------------------- sauvegarde

$cheminBak = Join-Path $racine 'data.js.avant-categories'
if (-not (Test-Path $cheminBak)) {
    Copy-Item $cheminData $cheminBak
    Write-Host "  Sauvegarde : data.js.avant-categories" -ForegroundColor Green
}

# ---------------------------------------------------------------- export

$texte = [IO.File]::ReadAllText($cheminCsv, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$lignes = @($texte -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
$entete = Split-LigneCsv $lignes[0]
function Norm([string]$t) {
    if ([string]::IsNullOrWhiteSpace($t)) { return '' }
    $d = $t.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    return ($sb.ToString().ToLower() -replace '&', ' et ' -replace '[^a-z0-9]+', ' ').Trim()
}
$idx = @{}
for ($i = 0; $i -lt $entete.Count; $i++) {
    $k = Norm $entete[$i]
    if (-not $idx.ContainsKey($k)) { $idx[$k] = $i }
}

# depenses[mois][categorie][sous-categorie] = montant
$depenses = @{}
1..12 | ForEach-Object { $depenses[$_] = [ordered]@{} }

# ordre d'affichage = ordre de l'appli bancaire
$ordre = @(
    'Vie quotidienne',
    'Logement',
    'Auto & Moto',
    'Voyages & Transports',
    'Santé',
    'Abonnements & téléphonie',
    'Éducation & Famille',
    'Cadeaux et solidarité',
    'Loisirs et sorties',
    'Dépenses d''épargne',
    'Virements émis',
    'Chèques',
    'Retraits cash',
    'Services financiers & professionnels',
    'Impôts et taxes',
    'Mouvements internes débiteurs'
)
$canon = @{}
foreach ($o in $ordre) { $canon[(Norm $o)] = $o }
$loyerFevrier = 0
for ($l = 1; $l -lt $lignes.Count; $l++) {
    $c = Split-LigneCsv $lignes[$l]
    if ($c.Count -lt 7) { continue }
    $d = [datetime]::MinValue
    if (-not [datetime]::TryParse($c[$idx['date operation']], [ref]$d)) { continue }
    $v = Lit-Montant $c[$idx['solde']]
    if ($v -ge 0) { continue }          # seules les depenses nous interessent

    $mois = $d.Month
    $cat = $c[$idx['categorie parente']].Trim()
    $sous = $c[$idx['categorie']].Trim()
    $libelle = $c[$idx['libelle']]

    # loyer de fevrier, debite le 02/03
    if ($mois -eq 3 -and $d.Day -le 2 -and [Math]::Abs($v) -eq 940 -and $libelle -match '(?i)sarrazin') {
        $mois = 2
        $loyerFevrier++
    }

    if ($mois -gt 12) { continue }
    # l'export ecrit parfois les noms sans accent : on se rabat sur l'orthographe de reference
    if ($canon.ContainsKey((Norm $cat))) { $cat = $canon[(Norm $cat)] }
    if (-not $depenses[$mois].Contains($cat)) { $depenses[$mois][$cat] = [ordered]@{} }
    if (-not $depenses[$mois][$cat].Contains($sous)) { $depenses[$mois][$cat][$sous] = 0.0 }
    $depenses[$mois][$cat][$sous] += [Math]::Abs($v)
}

# ---------------------------------------------------------------- data.js

$brut = [IO.File]::ReadAllText($cheminData, [Text.Encoding]::UTF8)
$bloc = [regex]::Match($brut, '(?s)window\.BUDGET2026\s*=\s*(\[.*\])\s*;?')
if (-not $bloc.Success) { throw "Impossible de lire window.BUDGET2026 dans data.js" }
$mois = $bloc.Groups[1].Value | ConvertFrom-Json
if ($mois -isnot [array]) { $mois = @($mois) }

$journal = @()

foreach ($m in $mois) {
    $num = [array]::IndexOf(@('janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'), $m.mois) + 1
    if ($num -lt 1) { continue }

    # --- depenses reconstruites depuis la banque ---
    $liste = @()
    foreach ($cat in $ordre) {
        if (-not $depenses[$num].Contains($cat)) {
            if ($cat -eq 'Impôts et taxes') {
                $liste += [pscustomobject]@{ categorie = $cat; total = (Montant 0); items = @() }
            }
            continue
        }
        $sous = $depenses[$num][$cat]
        $total = 0.0
        foreach ($k in $sous.Keys) { $total += $sous[$k] }
        $items = @()
        $sous.Keys | Sort-Object { -$sous[$_] } | ForEach-Object {
            $items += [pscustomobject]@{ nom = $_; montant = (Montant $sous[$_]) }
        }
        $liste += [pscustomobject]@{ categorie = $cat; total = (Montant $total); items = $items }
    }
    $m.depenses = $liste

    # --- revenus : on ne garde que la correction du faux report ---
    foreach ($r in $m.revenus) {
        if ((Norm $r.nom) -eq 'solde mois precedent' -and (Lit-Montant $r.montant) -ne 0) {
            $journal += ("{0} : solde mois precedent {1} -> 0,00 € (aligne sur la banque)" -f $m.mois, $r.montant)
            $r.montant = Montant 0
        }
    }

    # --- totaux ---
    $dep = 0.0
    foreach ($c in $m.depenses) { foreach ($it in $c.items) { $dep += (Lit-Montant $it.montant) } }
    $rev = 0.0
    foreach ($r in $m.revenus) { $rev += (Lit-Montant $r.montant) }
    $m.depenseTotalCommune = Montant $dep
    $m.revenuTotalFoyer = Montant $rev
    $m.sommeRestante = Montant ($rev - $dep)
}

# ---------------------------------------------------------------- ecriture

$json = ($mois | ConvertTo-Json -Depth 12)
$enteteTxt = @(
    '// Donnees du compte commun 2026.',
    '// Categories = celles de l''application bancaire (Vie quotidienne, Logement,',
    '// Auto & Moto, Voyages & Transports, Sante, Abonnements & telephonie,',
    '// Education & Famille, Cadeaux et solidarite, Loisirs et sorties,',
    '// Depenses d''epargne, Virements emis, Cheques, Retraits cash,',
    '// Services financiers & professionnels, Impots et taxes, Mouvements internes debiteurs).',
    '// Depenses janvier -> septembre 2026 reconstruites depuis l''export bancaire',
    '// (965 operations) par outils\adopter-categories-banque.ps1.',
    ''
) -join "`r`n"

[IO.File]::WriteAllText($cheminData, ($enteteTxt + "window.BUDGET2026 = " + $json + ";`r`n"), (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "  =========================================================================" -ForegroundColor DarkGray
Write-Host "   CATEGORIES BANCAIRES ADOPTEES" -ForegroundColor Cyan
Write-Host "  =========================================================================" -ForegroundColor DarkGray
Write-Host ("   Loyer de fevrier replace : {0} operation(s)" -f $loyerFevrier)
$journal | ForEach-Object { Write-Host ("   - " + $_) }
Write-Host ""
Write-Host "   Totaux mensuels :" -ForegroundColor DarkGray
foreach ($m in $mois) {
    if ((Lit-Montant $m.depenseTotalCommune) -gt 0) {
        Write-Host ("     {0,-10} revenus {1,12}   depenses {2,12}" -f $m.mois, $m.revenuTotalFoyer, $m.depenseTotalCommune)
    }
}
Write-Host ""
Write-Host "  data.js reecrit." -ForegroundColor Green
Write-Host ""
