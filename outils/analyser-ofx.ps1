# Analyse un (ou plusieurs) export(s) OFX de la banque et compare les totaux
# mensuels avec les donnees du site (data.js).
#
#   Utilisation :  powershell -NoProfile -ExecutionPolicy Bypass -File outils\analyser-ofx.ps1
#                  powershell ... -File outils\analyser-ofx.ps1 -Dossier "$env:USERPROFILE\Downloads" -Detail
#
# -Dossier   : dossier ou chercher les fichiers .ofx (defaut : exports)
# -Detail    : affiche le detail de toutes les operations
# -Csv       : ecrit un recapitulatif CSV dans le dossier analyse (synthese-ofx.csv)

param(
    [string]$Dossier = '',
    [switch]$Detail,
    [switch]$Csv
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$racine = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Dossier) { $Dossier = Join-Path $racine 'exports' }
if (-not (Test-Path $Dossier)) { throw "Dossier introuvable : $Dossier" }

$cultureFR = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
$moisNoms = @('', 'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'aout', 'septembre', 'octobre', 'novembre', 'decembre')

# ---------------------------------------------------------------- outils

function Convert-Montant {
    param([string]$Texte)
    if ([string]::IsNullOrWhiteSpace($Texte)) { return 0.0 }
    $t = ($Texte -replace '[^\d,\.\-]', '') -replace ',', '.'
    $v = 0.0
    if ([double]::TryParse($t, [Globalization.NumberStyles]::Float,
            [Globalization.CultureInfo]::InvariantCulture, [ref]$v)) { return $v }
    return 0.0
}

function Format-Euro {
    param([double]$Montant)
    return ($Montant.ToString('N2', $cultureFR) + ' EUR')
}

# "février", "fevrier", "FÉVR." -> 2
function Convert-MoisIndex {
    param([string]$Nom)
    if ([string]::IsNullOrWhiteSpace($Nom)) { return 0 }
    $n = $Nom.ToLower()
    $n = $n -replace 'é', 'e' -replace 'è', 'e' -replace 'ê', 'e' -replace 'û', 'u' -replace 'ô', 'o' -replace 'à', 'a'
    $n = $n.Trim()
    $prefixes = @{ 'janv' = 1; 'fevr' = 2; 'mars' = 3; 'avri' = 4; 'mai' = 5; 'juin' = 6;
                   'juil' = 7; 'aout' = 8; 'sept' = 9; 'octo' = 10; 'nove' = 11; 'dece' = 12 }
    foreach ($p in $prefixes.Keys) {
        if ($n.StartsWith($p)) { return $prefixes[$p] }
    }
    return 0
}

function Get-ValeurTag {
    param([string]$Bloc, [string]$Tag)
    $m = [regex]::Match($Bloc, "(?s)<$Tag>([^<\r\n]*)")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

function Read-FichierOfx {
    param([string]$Chemin)
    $octets = [IO.File]::ReadAllBytes($Chemin)
    # OFX 1.x est souvent en Windows-1252, OFX 2.x en UTF-8 : on essaie les deux.
    $utf8Strict = New-Object Text.UTF8Encoding($false, $true)
    try { return $utf8Strict.GetString($octets) }
    catch { return [Text.Encoding]::GetEncoding(1252).GetString($octets) }
}

function Get-OperationsOfx {
    param([string]$Texte, [string]$Fichier)

    $operations = @()
    $sections = @()

    $releves = [regex]::Matches($Texte, '(?s)<STMTRS>(.*?)(?=</STMTRS>|<STMTRS>|</OFX>|$)')
    if ($releves.Count -gt 0) {
        foreach ($r in $releves) {
            $bloc = $r.Groups[1].Value
            $acct = Get-ValeurTag $bloc 'ACCTID'
            if (-not $acct) { $acct = Get-ValeurTag $bloc 'ACCTNBR' }
            if (-not $acct) { $acct = '(compte inconnu)' }
            $sections += [pscustomobject]@{ Compte = $acct; Bloc = $bloc }
        }
    } else {
        $acct = Get-ValeurTag $Texte 'ACCTID'
        if (-not $acct) { $acct = '(compte inconnu)' }
        $sections += [pscustomobject]@{ Compte = $acct; Bloc = $Texte }
    }

    foreach ($section in $sections) {
        $blocs = [regex]::Matches($section.Bloc,
            '(?s)<STMTTRN>(.*?)(?=<STMTTRN>|</STMTTRN>|</BANKTRANLIST>|</STMTRS>|$)')
        foreach ($b in $blocs) {
            $bloc = $b.Groups[1].Value
            $dateBrute = Get-ValeurTag $bloc 'DTPOSTED'
            if (-not $dateBrute) { continue }
            $chiffres = ($dateBrute -replace '\D', '')
            if ($chiffres.Length -lt 8) { continue }
            $annee = [int]$chiffres.Substring(0, 4)
            $mois = [int]$chiffres.Substring(4, 2)
            $jour = [int]$chiffres.Substring(6, 2)
            if ($mois -lt 1 -or $mois -gt 12 -or $jour -lt 1 -or $jour -gt 31) { continue }

            $libelle = Get-ValeurTag $bloc 'NAME'
            $memo = Get-ValeurTag $bloc 'MEMO'
            if (-not $libelle) { $libelle = $memo }
            if (-not $libelle) { $libelle = '(sans libelle)' }

            $operations += [pscustomobject]@{
                Fichier = Split-Path -Leaf $Fichier
                Compte  = $section.Compte
                Date    = [datetime]::new($annee, $mois, $jour)
                Annee   = $annee
                Mois    = $mois
                Montant = (Convert-Montant (Get-ValeurTag $bloc 'TRNAMT'))
                Type    = Get-ValeurTag $bloc 'TRNTYPE'
                Libelle = ($libelle -replace '\s+', ' ').Trim()
                Memo    = $memo
                FitId   = Get-ValeurTag $bloc 'FITID'
            }
        }
    }
    return $operations
}

# ---------------------------------------------------------------- lecture des OFX

$fichiers = @(Get-ChildItem -Path $Dossier -Filter '*.ofx' -File -ErrorAction SilentlyContinue)
if ($fichiers.Count -eq 0) {
    Write-Host ""
    Write-Host "  Aucun fichier .ofx trouve dans : $Dossier" -ForegroundColor Yellow
    Write-Host "  Depose ton export OFX dans ce dossier puis relance." -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}

$ops = @()
foreach ($f in $fichiers) {
    $texte = Read-FichierOfx $f.FullName
    $lues = @(Get-OperationsOfx -Texte $texte -Fichier $f.Name)
    $ops += $lues
    Write-Host ("  Lu : {0}  ({1} operations)" -f $f.Name, $lues.Count) -ForegroundColor DarkGray
}

if ($ops.Count -eq 0) {
    Write-Host "  Aucune operation lue : verifie que le fichier est bien un export OFX." -ForegroundColor Red
    exit 1
}

# Doublons (meme FITID present dans deux exports qui se chevauchent)
$avant = $ops.Count
$avecId = @($ops | Where-Object { $_.FitId })
$sansId = @($ops | Where-Object { -not $_.FitId })
$ops = @($avecId | Sort-Object Compte, FitId, Date, Montant -Unique) + $sansId
$doublons = $avant - $ops.Count

# ---------------------------------------------------------------- synthese OFX

Write-Host ""
Write-Host "  =========================================================================" -ForegroundColor DarkGray
Write-Host "   EXPORT OFX : SYNTHESE" -ForegroundColor Cyan
Write-Host "  =========================================================================" -ForegroundColor DarkGray
$infoDoublons = ''
if ($doublons -gt 0) { $infoDoublons = " ($doublons doublon(s) ecarte(s))" }
Write-Host ("  {0} operations uniques{1}" -f $ops.Count, $infoDoublons) -ForegroundColor DarkGray
Write-Host ""

$parCompte = @($ops | Group-Object Compte)
foreach ($g in $parCompte) {
    Write-Host ("  Compte {0} : {1} operations" -f $g.Name, $g.Count) -ForegroundColor White
    $g.Group |
        Group-Object Annee, Mois |
        Sort-Object { ([int]$_.Group[0].Annee) * 100 + [int]$_.Group[0].Mois } |
        ForEach-Object {
            $an = $_.Group[0].Annee
            $mo = [int]$_.Group[0].Mois
            $credits = ($_.Group | Where-Object { $_.Montant -gt 0 } | Measure-Object Montant -Sum).Sum
            $debits = [Math]::Abs(($_.Group | Where-Object { $_.Montant -lt 0 } | Measure-Object Montant -Sum).Sum)
            $net = $credits - $debits
            Write-Host ("    {0,-10} {1}  {2,3} ops   entrees {3,14}   sorties {4,14}   net {5,14}" -f `
                $moisNoms[$mo], $an, $_.Count, (Format-Euro $credits), (Format-Euro $debits), (Format-Euro $net))
        }
    Write-Host ""
}

# ---------------------------------------------------------------- comparaison avec data.js

$cheminData = Join-Path $racine 'data.js'
$anneeOfx = ($ops | Sort-Object Date | Select-Object -First 1).Annee

if (Test-Path $cheminData) {
    $brut = Get-Content $cheminData -Raw -Encoding UTF8
    $bloc = [regex]::Match($brut, "(?s)window\.BUDGET${anneeOfx}\s*=\s*(\[.*\])\s*;?")
    if (-not $bloc.Success) { $bloc = [regex]::Match($brut, '(?s)=\s*(\[.*\])\s*;?') }

    $donnees = $null
    if ($bloc.Success) {
        try { $donnees = $bloc.Groups[1].Value | ConvertFrom-Json } catch { $donnees = $null }
    }

    if ($donnees) {
        # reference : les totaux de data.js par mois
        $ref = @{}
        foreach ($m in $donnees) {
            $i = Convert-MoisIndex "$($m.mois)"
            if ($i -eq 0) { continue }
            $ref[$i] = [pscustomobject]@{
                Rev = (Convert-Montant "$($m.revenuTotalFoyer)")
                Dep = (Convert-Montant "$($m.depenseTotalCommune)")
            }
        }

        # choisir le compte OFX le plus proche de data.js
        $meilleur = $null
        $meilleurEcart = [double]::MaxValue
        foreach ($g in $parCompte) {
            $ecart = 0.0
            foreach ($mo in 1..12) {
                if (-not $ref.ContainsKey($mo)) { continue }
                $moIns = @($g.Group | Where-Object { $_.Mois -eq $mo })
                $rev = ($moIns | Where-Object { $_.Montant -gt 0 } | Measure-Object Montant -Sum).Sum
                $dep = [Math]::Abs(($moIns | Where-Object { $_.Montant -lt 0 } | Measure-Object Montant -Sum).Sum)
                $ecart += [Math]::Abs($rev - $ref[$mo].Rev) + [Math]::Abs($dep - $ref[$mo].Dep)
            }
            if ($ecart -lt $meilleurEcart) { $meilleurEcart = $ecart; $meilleur = $g }
        }

        Write-Host "  =========================================================================" -ForegroundColor DarkGray
        Write-Host ("   COMPARAISON AVEC data.js ({0})" -f $anneeOfx) -ForegroundColor Cyan
        Write-Host "  =========================================================================" -ForegroundColor DarkGray
        Write-Host ("  Compte analyse : {0}" -f $meilleur.Name) -ForegroundColor DarkGray
        if ($parCompte.Count -gt 1) {
            $autres = @($parCompte | Where-Object { $_.Name -ne $meilleur.Name } | ForEach-Object { $_.Name })
            Write-Host ("  Autre(s) compte(s) present(s) : {0} (compare manuellement si besoin)" -f ($autres -join ', ')) -ForegroundColor DarkGray
        }
        Write-Host ""

        $entete = "  {0,-11}| {1,15} | {2,13} | {3,14} | {4,15} | {5,13} | {6,14}"
        Write-Host ($entete -f 'Mois', 'OFX entrees', 'data.js', 'ecart', 'OFX sorties', 'data.js', 'ecart') -ForegroundColor DarkGray
        Write-Host ("  -----------+-----------------+---------------+----------------+-----------------+---------------+---------------") -ForegroundColor DarkGray

        $totalEcart = 0.0
        foreach ($mo in 1..12) {
            $moIns = @($meilleur.Group | Where-Object { $_.Mois -eq $mo })
            if ($moIns.Count -eq 0 -and -not $ref.ContainsKey($mo)) { continue }

            $revOfx = ($moIns | Where-Object { $_.Montant -gt 0 } | Measure-Object Montant -Sum).Sum
            $depOfx = [Math]::Abs(($moIns | Where-Object { $_.Montant -lt 0 } | Measure-Object Montant -Sum).Sum)
            $revRef = 0.0; $depRef = 0.0
            if ($ref.ContainsKey($mo)) { $revRef = $ref[$mo].Rev; $depRef = $ref[$mo].Dep }

            $ecRev = $revOfx - $revRef
            $ecDep = $depOfx - $depRef
            $totalEcart += [Math]::Abs($ecRev) + [Math]::Abs($ecDep)

            $ok = ([Math]::Abs($ecRev) -lt 0.01 -and [Math]::Abs($ecDep) -lt 0.01)
            $couleur = 'Yellow'
            if ($ok) { $couleur = 'Green' }

            Write-Host ($entete -f $moisNoms[$mo], (Format-Euro $revOfx), (Format-Euro $revRef), (Format-Euro $ecRev),
                (Format-Euro $depOfx), (Format-Euro $depRef), (Format-Euro $ecDep)) -ForegroundColor $couleur
        }

        Write-Host ("  -----------+-----------------+---------------+----------------+-----------------+---------------+---------------") -ForegroundColor DarkGray
        $verdict = "  Ecart total : " + (Format-Euro $totalEcart)
        if ($totalEcart -lt 0.01) { $verdict += "  -> tout est coherent." }
        else { $verdict += "  -> ecarts a examiner (voir colonnes 'ecart')." }
        Write-Host $verdict -ForegroundColor $(if ($totalEcart -lt 0.01) { 'Green' } else { 'Yellow' })
        Write-Host ""
        Write-Host "  Ecart = OFX moins data.js (positif : OFX plus eleve)." -ForegroundColor DarkGray
        Write-Host "  Les virements internes et le 'solde mois precedent' de data.js peuvent creer des ecarts normaux." -ForegroundColor DarkGray
        Write-Host ""
    }
}

if ($Detail) {
    Write-Host "  =========================================================================" -ForegroundColor DarkGray
    Write-Host "   DETAIL DES OPERATIONS" -ForegroundColor Cyan
    Write-Host "  =========================================================================" -ForegroundColor DarkGray
    $ops | Sort-Object Date | ForEach-Object {
        $signe = '-'
        if ($_.Montant -ge 0) { $signe = '+' }
        $montant = ([Math]::Abs($_.Montant)).ToString('N2', $cultureFR)
        Write-Host ("  {0:dd/MM/yyyy} {1}{2,10}  {3}" -f $_.Date, $signe, $montant, $_.Libelle)
    }
    Write-Host ""
}

if ($Csv) {
    $sortie = Join-Path $Dossier 'synthese-ofx.csv'
    $ops | Sort-Object Date | Select-Object Date, Compte, Montant, Libelle, Memo, FitId |
        Export-Csv -Path $sortie -NoTypeInformation -Encoding UTF8 -Delimiter ';'
    Write-Host "  Recapitulatif CSV ecrit : $sortie" -ForegroundColor Green
    Write-Host ""
}
