# Compare l'export d'operations avec data.js, categorie par categorie, mois par mois.
# Sert a localiser precisement les erreurs avant correction.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File outils\diagnostic-ecarts.ps1

param(
    [string]$Fichier = ''
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$racine = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cultureFR = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
$moisNoms = @('', 'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'aout', 'septembre', 'octobre', 'novembre', 'decembre')

function Remove-Diacritiques {
    param([string]$Texte)
    if ([string]::IsNullOrWhiteSpace($Texte)) { return '' }
    $d = $Texte.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    return $sb.ToString()
}

function Normaliser {
    param([string]$Nom)
    if ([string]::IsNullOrWhiteSpace($Nom)) { return '' }
    $n = (Remove-Diacritiques $Nom).ToLower()
    $n = $n -replace '&', ' et '
    $n = $n -replace '[^a-z0-9]+', ' '
    return $n.Trim()
}

function Convert-Montant {
    param([string]$Texte)
    if ([string]::IsNullOrWhiteSpace($Texte)) { return 0.0 }
    $t = ($Texte.Trim() -replace '[^\d,\.\-]', '')
    if ($t -eq '' -or $t -eq '-') { return 0.0 }
    if ($t.Contains(',') -and $t.Contains('.')) { $t = $t -replace '\.', '' -replace ',', '.' }
    elseif ($t.Contains(',')) { $t = $t -replace ',', '.' }
    $v = 0.0
    if ([double]::TryParse($t, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$v)) { return $v }
    return 0.0
}

function Euro { param([double]$M) return ($M.ToString('N2', $cultureFR)) }

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

# ---------------------------------------------------------------- export

if (-not $Fichier) {
    $csv = @(Get-ChildItem (Join-Path $racine 'exports') -Filter '*.csv' -File | Sort-Object Length -Descending)
    if ($csv.Count -eq 0) { throw "Aucun CSV dans exports\" }
    $Fichier = $csv[0].FullName
}

$texte = [IO.File]::ReadAllText($Fichier, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$lignes = @($texte -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
$entete = Split-LigneCsv $lignes[0]
$idx = @{}
for ($i = 0; $i -lt $entete.Count; $i++) {
    $k = Normaliser $entete[$i]
    if (-not $idx.ContainsKey($k)) { $idx[$k] = $i }
}

$ops = @()
for ($l = 1; $l -lt $lignes.Count; $l++) {
    $c = Split-LigneCsv $lignes[$l]
    if ($c.Count -lt 7) { continue }
    $d = [datetime]::MinValue
    if (-not [datetime]::TryParse($c[$idx['date operation']], [ref]$d)) { continue }
    $ops += [pscustomobject]@{
        Date    = $d
        Mois    = $d.Month
        Libelle = $c[$idx['libelle']]
        Cat     = $c[$idx['categorie']]
        Par     = $c[$idx['categorie parente']]
        Montant = (Convert-Montant $c[$idx['solde']])
    }
}

# ---------------------------------------------------------------- data.js

$brut = Get-Content (Join-Path $racine 'data.js') -Raw -Encoding UTF8
$bloc = [regex]::Match($brut, '(?s)window\.BUDGET2026\s*=\s*(\[.*\])\s*;?')
$data = $bloc.Groups[1].Value | ConvertFrom-Json

# Correspondance entre les categories de data.js et celles de l'export
$mapping = @{
    'vie quotidienne'          = @('vie quotidienne')
    'logement'                 = @('logement')
    'auto moto'                = @('auto et moto', 'voyages et transports')
    'sante'                    = @('sante')
    'abonnement et telephonie' = @('abonnements et telephonie')
    'education et famille'     = @('education et famille')
    'cadeaux et solidarite'    = @('cadeaux et solidarite')
    'loisir'                   = @('loisirs et sorties')
    'operation banquaire'      = @('depenses d epargne', 'virements emis')
    'autre'                    = @('services financiers et professionnels')
    'impots et taxe'           = @('impots et taxes')
    'mouvement interne debiteur' = @('mouvements internes debiteurs')
}
$mapInverse = @{}
foreach ($k in $mapping.Keys) {
    foreach ($src in $mapping[$k]) { $mapInverse[$src] = $k }
}

Write-Host ""
Write-Host "  ===============================================================================" -ForegroundColor DarkGray
Write-Host "   ECARTS DE DEPENSES, CATEGORIE PAR CATEGORIE (export - data.js)" -ForegroundColor Cyan
Write-Host "  ===============================================================================" -ForegroundColor DarkGray

$totalNonExplique = 0.0
foreach ($mo in 1..8) {
    $nomMois = $moisNoms[$mo]
    $ligneD = $data | Where-Object { (Normaliser $_.mois) -eq (Normaliser $nomMois) } | Select-Object -First 1
    if (-not $ligneD) { continue }

    # depenses de l'export regroupees selon la nomenclature de data.js
    $parCat = @{}
    foreach ($op in ($ops | Where-Object { $_.Mois -eq $mo -and $_.Montant -lt 0 })) {
        $cle = $mapInverse[(Normaliser $op.Par)]
        if (-not $cle) { $cle = 'inconnue : ' + $op.Par }
        if (-not $parCat.ContainsKey($cle)) { $parCat[$cle] = 0.0 }
        $parCat[$cle] += [Math]::Abs($op.Montant)
    }

    $lignes = @()
    foreach ($dep in $ligneD.depenses) {
        $cle = Normaliser $dep.categorie
        $reel = 0.0
        if ($parCat.ContainsKey($cle)) { $reel = $parCat[$cle] }
        $ref = Convert-Montant "$($dep.total)"
        $ecart = $reel - $ref
        if ([Math]::Abs($ecart) -ge 0.01) {
            $lignes += ("      {0,-30} export {1,10}  data.js {2,10}  ecart {3,10}" -f $dep.categorie, (Euro $reel), (Euro $ref), (Euro $ecart))
            $totalNonExplique += $ecart
        }
    }
    foreach ($cle in $parCat.Keys) {
        if ($cle -like 'inconnue*') {
            $lignes += ("      {0,-30} export {1,10}  data.js {2,10}  ecart {3,10}" -f $cle, (Euro $parCat[$cle]), (Euro 0), (Euro $parCat[$cle]))
        }
    }

    if ($lignes.Count -gt 0) {
        Write-Host ("  {0} {1}" -f $nomMois.ToUpper(), '') -ForegroundColor White
        $lignes | ForEach-Object { Write-Host $_ }
        Write-Host ""
    }
}

Write-Host "  ===============================================================================" -ForegroundColor DarkGray
Write-Host "   REVENUS DE L'EXPORT PAR CATEGORIE (pour comparaison avec data.js)" -ForegroundColor Cyan
Write-Host "  ===============================================================================" -ForegroundColor DarkGray
foreach ($mo in 1..9) {
    $nomMois = $moisNoms[$mo]
    $rev = $ops | Where-Object { $_.Mois -eq $mo -and $_.Montant -gt 0 }
    if ($rev.Count -eq 0) { continue }

    $ligneD = $data | Where-Object { (Normaliser $_.mois) -eq (Normaliser $nomMois) } | Select-Object -First 1
    $totalExport = ($rev | Measure-Object Montant -Sum).Sum
    $totalData = Convert-Montant "$($ligneD.revenuTotalFoyer)"

    Write-Host ("  {0}" -f $nomMois.ToUpper()) -ForegroundColor White
    Write-Host ("      export : {0,12}   data.js : {1,12}   ecart {2,10}" -f (Euro $totalExport), (Euro $totalData), (Euro ($totalExport - $totalData)))
    $rev | Group-Object Par | Sort-Object { -($_.Group | Measure-Object Montant -Sum).Sum } | ForEach-Object {
        $s = ($_.Group | Measure-Object Montant -Sum).Sum
        Write-Host ("      {0,-40} {1,12}" -f $_.Name, (Euro $s)) -ForegroundColor DarkGray
    }
    if ($ligneD) {
        $ligneD.revenus | ForEach-Object {
            Write-Host ("      {0,-40} {1,12}  (data.js)" -f $_.nom, (Euro (Convert-Montant "$($_.montant)"))) -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}
