# Lit un export d'operations (CSV ";" avec categories) et compare les totaux
# mensuels et par categorie avec les donnees du site (data.js).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File outils\analyser-export.ps1
#   powershell ... -File outils\analyser-export.ps1 -Fichier exports\mon-export.csv
#   powershell ... -File outils\analyser-export.ps1 -Categories   (detail par categorie)

param(
    [string]$Fichier = '',
    [switch]$Categories
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$racine = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cultureFR = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
$moisNoms = @('', 'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'aout', 'septembre', 'octobre', 'novembre', 'decembre')

# ---------------------------------------------------------------- lecture CSV

if (-not $Fichier) {
    $candidats = @(Get-ChildItem (Join-Path $racine 'exports') -Filter '*.csv' -File -ErrorAction SilentlyContinue |
                   Sort-Object LastWriteTime -Descending)
    if ($candidats.Count -eq 0) { throw "Aucun CSV trouve dans exports\. Depose ton export puis relance." }
    $Fichier = $candidats[0].FullName
    Write-Host ("  Fichier utilise : {0}" -f (Split-Path -Leaf $Fichier)) -ForegroundColor DarkGray
}

$octets = [IO.File]::ReadAllBytes($Fichier)
$utf8Strict = New-Object Text.UTF8Encoding($false, $true)
try { $texte = $utf8Strict.GetString($octets) } catch { $texte = [Text.Encoding]::GetEncoding(1252).GetString($octets) }
$texte = $texte.TrimStart([char]0xFEFF)

# Decoupage respectant les guillemets
function Split-LigneCsv {
    param([string]$Ligne)
    $champs = New-Object System.Collections.Generic.List[string]
    $courant = New-Object Text.StringBuilder
    $dansGuillemets = $false
    for ($i = 0; $i -lt $Ligne.Length; $i++) {
        $c = $Ligne[$i]
        if ($c -eq '"') {
            if ($dansGuillemets -and ($i + 1) -lt $Ligne.Length -and $Ligne[$i + 1] -eq '"') {
                [void]$courant.Append('"'); $i++
            } else { $dansGuillemets = -not $dansGuillemets }
        } elseif ($c -eq ';' -and -not $dansGuillemets) {
            $champs.Add($courant.ToString()); [void]$courant.Clear()
        } else {
            [void]$courant.Append($c)
        }
    }
    $champs.Add($courant.ToString())
    return $champs.ToArray()
}

function Convert-Montant {
    param([string]$Texte)
    if ([string]::IsNullOrWhiteSpace($Texte)) { return 0.0 }
    $t = ($Texte.Trim() -replace '[^\d,\.\-]', '')
    if ($t -eq '' -or $t -eq '-') { return 0.0 }
    if ($t.Contains(',') -and $t.Contains('.')) { $t = $t -replace '\.', '' -replace ',', '.' }
    elseif ($t.Contains(',')) { $t = $t -replace ',', '.' }
    $v = 0.0
    if ([double]::TryParse($t, [Globalization.NumberStyles]::Float,
            [Globalization.CultureInfo]::InvariantCulture, [ref]$v)) { return $v }
    return 0.0
}

function Format-Euro { param([double]$Montant) return ($Montant.ToString('N2', $cultureFR) + ' EUR') }

function Remove-Diacritiques {
    param([string]$Texte)
    if ([string]::IsNullOrWhiteSpace($Texte)) { return '' }
    $d = $Texte.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
        if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    return $sb.ToString()
}

function Convert-MoisIndex {
    param([string]$Nom)
    if ([string]::IsNullOrWhiteSpace($Nom)) { return 0 }
    $n = (Remove-Diacritiques $Nom).ToLower().Trim()
    $p = @{ 'janv' = 1; 'fevr' = 2; 'mars' = 3; 'avri' = 4; 'mai' = 5; 'juin' = 6;
            'juil' = 7; 'aout' = 8; 'sept' = 9; 'octo' = 10; 'nove' = 11; 'dece' = 12 }
    foreach ($k in $p.Keys) { if ($n.StartsWith($k)) { return $p[$k] } }
    return 0
}

# Normalisation des libelles de categories pour rapprocher export et data.js
function Normaliser-Categorie {
    param([string]$Nom)
    if ([string]::IsNullOrWhiteSpace($Nom)) { return '' }
    $n = (Remove-Diacritiques $Nom).ToLower()
    $n = $n -replace '&', ' et '
    $n = $n -replace '[^a-z0-9]+', ' '
    return $n.Trim()
}

$lignes = @($texte -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
$entete = Split-LigneCsv $lignes[0]
Write-Host ""
Write-Host "  Colonnes detectees : $($entete.Count)" -ForegroundColor DarkGray

# reperage des colonnes par leur nom (tolere les doublons)
$idx = @{}
for ($i = 0; $i -lt $entete.Count; $i++) {
    $nom = (Normaliser-Categorie $entete[$i])
    if (-not $idx.ContainsKey($nom)) { $idx[$nom] = $i }
}
function Col { param([string]$Nom) $k = (Normaliser-Categorie $Nom); if ($idx.ContainsKey($k)) { return $idx[$k] } return -1 }

$cDate = Col 'Date Operation'
$cLib = Col 'Libelle'
$cCat = Col 'Categorie'
$cPar = Col 'Categorie Parente'
$cMon = Col 'Solde'          # 1re colonne "Solde" = montant de l'operation
$cCompte = Col 'Libelle Compte'

$operations = @()
for ($l = 1; $l -lt $lignes.Count; $l++) {
    $c = Split-LigneCsv $lignes[$l]
    if ($c.Count -lt 7) { continue }
    $dateTxt = $c[$cDate]
    $d = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($dateTxt, 'yyyy-MM-dd', $null, [Globalization.DateTimeStyles]::None, [ref]$d)) {
        if (-not [datetime]::TryParse($dateTxt, [ref]$d)) { continue }
    }
    $operations += [pscustomobject]@{
        Date      = $d
        Annee     = $d.Year
        Mois      = $d.Month
        Libelle   = ($c[$cLib] -replace '\s+', ' ').Trim()
        Categorie = $c[$cCat].Trim()
        Parente   = $c[$cPar].Trim()
        Montant   = (Convert-Montant $c[$cMon])
        Compte    = $(if ($cCompte -ge 0) { $c[$cCompte].Trim() } else { '' })
    }
}
$operations = @($operations | Sort-Object Date)
if ($operations.Count -eq 0) { throw "Aucune operation lue dans $Fichier" }

# ---------------------------------------------------------------- periode

Write-Host ""
Write-Host "  =========================================================================" -ForegroundColor DarkGray
Write-Host "   EXPORT : PERIODE COUVERTE" -ForegroundColor Cyan
Write-Host "  =========================================================================" -ForegroundColor DarkGray
Write-Host ("  {0} operations, du {1:dd/MM/yyyy} au {2:dd/MM/yyyy}" -f `
    $operations.Count, $operations[0].Date, $operations[-1].Date) -ForegroundColor White
$comptes = @($operations | Group-Object Compte | ForEach-Object { "$($_.Name) ($($_.Count))" })
Write-Host ("  Compte(s) : {0}" -f ($comptes -join ', ')) -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Mois       |  ops |          entrees |          sorties |              net" -ForegroundColor DarkGray
Write-Host "  -----------+------+------------------+------------------+------------------" -ForegroundColor DarkGray
$parMois = @{}
foreach ($g in ($operations | Group-Object Annee, Mois | Sort-Object { ([int]$_.Group[0].Annee) * 100 + [int]$_.Group[0].Mois })) {
    $an = $g.Group[0].Annee; $mo = [int]$g.Group[0].Mois
    $rev = ($g.Group | Where-Object { $_.Montant -gt 0 } | Measure-Object Montant -Sum).Sum
    $dep = [Math]::Abs(($g.Group | Where-Object { $_.Montant -lt 0 } | Measure-Object Montant -Sum).Sum)
    if (-not $rev) { $rev = 0.0 }
    if (-not $dep) { $dep = 0.0 }
    $parMois["$an-$mo"] = [pscustomobject]@{ Rev = $rev; Dep = $dep; Ops = $g.Count }
    Write-Host ("  {0,-10} | {1,4} | {2,16} | {3,16} | {4,16}" -f $moisNoms[$mo], $g.Count,
        (Format-Euro $rev), (Format-Euro $dep), (Format-Euro ($rev - $dep)))
}
Write-Host ""

# ---------------------------------------------------------------- comparaison data.js

$cheminData = Join-Path $racine 'data.js'
if (Test-Path $cheminData) {
    $brut = Get-Content $cheminData -Raw -Encoding UTF8
    foreach ($annee in @($operations | ForEach-Object { $_.Annee } | Sort-Object -Unique)) {
        $bloc = [regex]::Match($brut, "(?s)window\.BUDGET$annee\s*=\s*(\[.*\])\s*;?")
        if (-not $bloc.Success) { continue }
        try { $donnees = $bloc.Groups[1].Value | ConvertFrom-Json } catch { continue }

        $ref = @{}
        foreach ($m in $donnees) {
            $i = Convert-MoisIndex "$($m.mois)"
            if ($i -eq 0) { continue }
            $ref[$i] = [pscustomobject]@{ Rev = (Convert-Montant "$($m.revenuTotalFoyer)"); Dep = (Convert-Montant "$($m.depenseTotalCommune)") }
        }

        Write-Host "  =========================================================================" -ForegroundColor DarkGray
        Write-Host ("   COMPARAISON AVEC data.js ({0})" -f $annee) -ForegroundColor Cyan
        Write-Host "  =========================================================================" -ForegroundColor DarkGray
        Write-Host "  Mois       |      export entrees |      data.js |         ecart |     export sorties |      data.js |         ecart" -ForegroundColor DarkGray
        Write-Host "  -----------+---------------------+--------------+---------------+--------------------+--------------+--------------" -ForegroundColor DarkGray

        $totalEcart = 0.0
        foreach ($mo in 1..12) {
            $cle = "$annee-$mo"
            if (-not $parMois.ContainsKey($cle) -and -not $ref.ContainsKey($mo)) { continue }
            $eRev = 0.0; $eDep = 0.0
            if ($parMois.ContainsKey($cle)) { $eRev = $parMois[$cle].Rev; $eDep = $parMois[$cle].Dep }
            $dRev = 0.0; $dDep = 0.0
            if ($ref.ContainsKey($mo)) { $dRev = $ref[$mo].Rev; $dDep = $ref[$mo].Dep }
            $ecRev = $eRev - $dRev
            $ecDep = $eDep - $dDep
            $totalEcart += [Math]::Abs($ecRev) + [Math]::Abs($ecDep)
            $ok = ([Math]::Abs($ecRev) -lt 0.01 -and [Math]::Abs($ecDep) -lt 0.01)
            $couleur = 'Yellow'; if ($ok) { $couleur = 'Green' }
            Write-Host ("  {0,-10} | {1,19} | {2,12} | {3,13} | {4,18} | {5,12} | {6,13}" -f $moisNoms[$mo],
                (Format-Euro $eRev), (Format-Euro $dRev), (Format-Euro $ecRev),
                (Format-Euro $eDep), (Format-Euro $dDep), (Format-Euro $ecDep)) -ForegroundColor $couleur
        }
        Write-Host "  -----------+---------------------+--------------+---------------+--------------------+--------------+--------------" -ForegroundColor DarkGray
        $verdict = "  Ecart total : " + (Format-Euro $totalEcart)
        if ($totalEcart -lt 0.01) { $verdict += "  -> tout est coherent." }
        Write-Host $verdict -ForegroundColor $(if ($totalEcart -lt 0.01) { 'Green' } else { 'Yellow' })
        Write-Host "  Ecart = export moins data.js." -ForegroundColor DarkGray
        Write-Host ""

        if ($Categories) {
            Write-Host ("  --- Detail par categorie : {0} ---" -f $annee) -ForegroundColor Cyan
            $parCat = @{}
            foreach ($op in $operations) {
                if ($op.Annee -ne $annee) { continue }
                $nom = $op.Parente
                if (-not $nom) { $nom = $op.Categorie }
                $cle = "$($op.Mois)|$nom"
                if (-not $parCat.ContainsKey($cle)) { $parCat[$cle] = [pscustomobject]@{ Mois = $op.Mois; Cat = $nom; Rev = 0.0; Dep = 0.0 } }
                if ($op.Montant -gt 0) { $parCat[$cle].Rev += $op.Montant } else { $parCat[$cle].Dep += [Math]::Abs($op.Montant) }
            }
            $parCat.Values | Sort-Object Mois, @{ Expression = { $_.Dep }; Descending = $true } | ForEach-Object {
                Write-Host ("    {0,-10} {1,-28} entrees {2,12}  sorties {3,12}" -f $moisNoms[$_.Mois], $_.Cat, (Format-Euro $_.Rev), (Format-Euro $_.Dep))
            }
            Write-Host ""
        }
    }
}
