# Correction de data.js a partir de l'export bancaire (janvier -> septembre 2026).
#
# Ce script :
#   1. sauvegarde data.js dans data.js.bak
#   2. corrige les ecarts reels identifies (mars : revenus, avril : depenses + revenus)
#   3. recalcule le total de chaque categorie a partir de ses lignes
#      (dans l'ancien fichier, "auto moto" incluait a tort le total de
#       "voyage et transport", ce qui gonflait les graphiques)
#   4. recalcule revenuTotalFoyer / depenseTotalCommune / sommeRestante
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File outils\corriger-data.ps1

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$racine = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cheminData = Join-Path $racine 'data.js'
$cheminBak = Join-Path $racine 'data.js.bak'

$cultureFR = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
$script:journal = @()

function Montant { param([double]$v) return ($v.ToString('N2', $cultureFR) + ' EUR') }

function Lit-Montant {
    param([string]$s)
    if ([string]::IsNullOrWhiteSpace($s)) { return 0.0 }
    $t = ($s -replace '[^\d,\.\-]', '')
    if ($t -eq '' -or $t -eq '-') { return 0.0 }
    if ($t.Contains(',') -and $t.Contains('.')) { $t = $t -replace '\.', '' -replace ',', '.' }
    elseif ($t.Contains(',')) { $t = $t -replace ',', '.' }
    return [double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture)
}

function Norm {
    param([string]$t)
    if ([string]::IsNullOrWhiteSpace($t)) { return '' }
    $d = $t.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $n = $sb.ToString().ToLower() -replace '&', ' et ' -replace '[^a-z0-9]+', ' '
    return $n.Trim()
}

# ---------------------------------------------------------------- sauvegarde

if (-not (Test-Path $cheminBak)) {
    Copy-Item $cheminData $cheminBak
    Write-Host "  Sauvegarde creee : data.js.bak" -ForegroundColor Green
} else {
    Write-Host "  Sauvegarde existante conservee : data.js.bak" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- lecture

$brut = [IO.File]::ReadAllText($cheminData, [Text.Encoding]::UTF8)
$bloc = [regex]::Match($brut, '(?s)window\.BUDGET2026\s*=\s*(\[.*\])\s*;?')
if (-not $bloc.Success) { throw "Impossible de lire window.BUDGET2026 dans data.js" }
$mois = $bloc.Groups[1].Value | ConvertFrom-Json
if ($mois -isnot [array]) { $mois = @($mois) }

function Trouver-Mois { param([string]$nom) return ($mois | Where-Object { $_.mois -eq $nom } | Select-Object -First 1) }

function Trouver-Categorie {
    param($m, [string]$cat)
    $c = $m.depenses | Where-Object { (Norm $_.categorie) -eq (Norm $cat) } | Select-Object -First 1
    if (-not $c) { throw "Categorie introuvable : $cat" }
    return $c
}

function Assurer-Items {
    param($c)
    if (-not ($c.PSObject.Properties.Name -contains 'items')) {
        $c | Add-Member -NotePropertyName items -NotePropertyValue @()
    }
    if ($null -eq $c.items) { $c.items = @() }
}

# Ajoute un montant a une ligne existante (recherche par debut de nom, sans accents)
function Ajouter-Au-Item {
    param($m, [string]$cat, [string]$motif, [string]$nomSiNouveau, [double]$delta, [string]$note)
    $c = Trouver-Categorie $m $cat
    Assurer-Items $c
    $n = Norm $motif
    $it = $c.items | Where-Object { (Norm $_.nom).StartsWith($n) } | Select-Object -First 1
    if (-not $it) {
        $nouvel = [pscustomobject]@{ nom = $nomSiNouveau; montant = (Montant $delta) }
        $c.items = @($c.items) + $nouvel
        $script:journal += ("{0} : nouvelle ligne '{1}' = {2}  ({3})" -f $m.mois, $nomSiNouveau, (Montant $delta), $note)
    } else {
        $avant = Lit-Montant $it.montant
        $it.montant = Montant ($avant + $delta)
        $script:journal += ("{0} : {1} / {2} {3} -> {4}  ({5})" -f $m.mois, $cat, $it.nom, (Montant $avant), (Montant ($avant + $delta)), $note)
    }
}

function Revenu-Sante {
    param($m)
    return ($m.revenus | Where-Object { (Norm $_.nom) -like '*mouvement interne crediteur*' -and (Norm $_.detail) -eq 'sante' } | Select-Object -First 1)
}

# ---------------------------------------------------------------- MARS

$mars = Trouver-Mois 'mars'
foreach ($r in $mars.revenus) {
    if ((Norm $r.nom) -eq 'salaire sophie' -and (Lit-Montant $r.montant) -eq 1656.45) {
        $r.montant = Montant 1656.78
        $journal += "mars : SALAIRE SOPHIE 1 656,45 -> 1 656,78  (+0,33)"
    }
}
$rs = Revenu-Sante $mars
if ($rs) {
    $avant = Lit-Montant $rs.montant
    $rs.montant = Montant 203.07
    $journal += ("mars : remboursements sante {0} -> 203,07  (+9,00)" -f (Montant $avant))
}

# ---------------------------------------------------------------- AVRIL

$avril = Trouver-Mois 'avril'

Ajouter-Au-Item $avril 'vie quotidienne' 'alimentation' 'Alimentation' 26.62 'operation SUPER U du 28/04 oubliee'
Ajouter-Au-Item $avril 'vie quotidienne' 'electronique et informatique' 'electronique et informatique' 81.11 'operation AMAZON du 28/04 oubliee'
Ajouter-Au-Item $avril 'vie quotidienne' 'mobilier electro' 'mobilier electro deco' 9.91 'ecart mobilier'
Ajouter-Au-Item $avril 'abonnement et téléphonie' 'multimedia a domicile' 'multimedia a domicile, tv internet' 7.99 'NETFLIX du 30/04 oublie'
Ajouter-Au-Item $avril 'abonnement et téléphonie' 'telephonie' 'telephonie' 15.98 'prelevements Bouygues oublies'
Ajouter-Au-Item $avril 'loisir' 'club association' 'club association' 22.50 'cotisation SGP Police du 13/04 oubliee'
Ajouter-Au-Item $avril 'autre' 'frais banquaire' 'frais banquaire' 20.90 'prelevement Carrefour Banque oublie'
Ajouter-Au-Item $avril 'mouvement interne débiteur' 'virement de compte a compte' 'virement de compte a compte' 85.30 'virement David BARDREAU du 30/04 oublie'

$rsa = Revenu-Sante $avril
if ($rsa) {
    $avant = Lit-Montant $rsa.montant
    $rsa.montant = Montant ($avant + 25.30)
    $journal += ("avril : remboursements sante {0} -> {1}  (+25,30)" -f (Montant $avant), (Montant ($avant + 25.30)))
}
$avril.revenus = @($avril.revenus) + [pscustomobject]@{
    nom = 'mouvement interne créditeur'; montant = (Montant 29.00); detail = 'remboursement'
}
$journal += "avril : nouvelle ligne revenu 'remboursement' = 29,00"

# ---------------------------------------------------------------- totaux

$totauxCorriges = @()
foreach ($m in $mois) {
    foreach ($c in $m.depenses) {
        Assurer-Items $c
        $somme = 0.0
        foreach ($it in $c.items) { $somme += (Lit-Montant $it.montant) }
        $avant = Lit-Montant $c.total
        if ([Math]::Abs($avant - $somme) -ge 0.01) {
            $c.total = Montant $somme
            $totauxCorriges += ("{0} / {1} : {2} -> {3}" -f $m.mois, $c.categorie, (Montant $avant), (Montant $somme))
        }
    }
}

foreach ($m in $mois) {
    $dep = 0.0
    foreach ($c in $m.depenses) { foreach ($it in $c.items) { $dep += (Lit-Montant $it.montant) } }
    $rev = 0.0
    foreach ($r in $m.revenus) { $rev += (Lit-Montant $r.montant) }
    $m.depenseTotalCommune = Montant $dep
    $m.revenuTotalFoyer = Montant $rev
    $m.sommeRestante = Montant ($rev - $dep)
}

# ---------------------------------------------------------------- ecriture

$json = ($mois | ConvertTo-Json -Depth 10)
$entete = @(
    '// Donnees du compte commun 2026.',
    '// Base : export bancaire du 02/01/2026 au 30/09/2026 (965 operations),',
    '// corrige et complete par outils\corriger-data.ps1.',
    ''
) -join "`r`n"

[IO.File]::WriteAllText($cheminData, ($entete + "window.BUDGET2026 = " + $json + ";`r`n"), (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "  =========================================================================" -ForegroundColor DarkGray
Write-Host "   CORRECTIONS APPLIQUEES" -ForegroundColor Cyan
Write-Host "  =========================================================================" -ForegroundColor DarkGray
$journal | ForEach-Object { Write-Host ("   - " + $_) }
Write-Host ""
Write-Host ("  Totaux de categorie recalcules : {0}" -f $totauxCorriges.Count) -ForegroundColor DarkGray
$totauxCorriges | Select-Object -First 6 | ForEach-Object { Write-Host ("     " + $_) -ForegroundColor DarkGray }
if ($totauxCorriges.Count -gt 6) { Write-Host "     ..." -ForegroundColor DarkGray }
Write-Host ""
Write-Host "  data.js reecrit." -ForegroundColor Green
Write-Host ""
