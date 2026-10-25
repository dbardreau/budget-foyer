# Publie les modifications du site Budget Foyer sur GitHub.
# Fait exactement ce que tu faisais a la main :
#   git add .  ->  git commit -m "..."  ->  git push
# A lancer par double-clic sur "Publier mes modifications.bat".

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

function Pause-Fin {
    Write-Host ""
    Read-Host "  Appuie sur Entree pour fermer cette fenetre" | Out-Null
}

# --- Localiser git (il est installe mais pas forcement dans le PATH) ---
$git = 'C:\Program Files\Git\cmd\git.exe'
if (-not (Test-Path $git)) {
    $cmd = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($cmd) { $git = $cmd.Source }
}
if (-not $git -or -not (Test-Path $git)) {
    Write-Host ""
    Write-Host "  Git est introuvable sur cet ordinateur." -ForegroundColor Red
    Write-Host "  Installe-le depuis https://git-scm.com/download/win puis relance." -ForegroundColor Red
    Pause-Fin
    exit 1
}

# Lance git sans que sa sortie normale (stderr) soit traitee comme une erreur.
function Invoke-Git {
    param([string[]]$Arguments, [switch]$Silencieux, [switch]$Afficher)
    $ancien = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $sortie = & $git @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $ancien
    }
    if ($Afficher) {
        $sortie | Where-Object { "$_".Trim() -ne '' } | ForEach-Object {
            Write-Host "     $_" -ForegroundColor DarkGray
        }
    }
    [pscustomobject]@{ Sortie = $sortie; Code = $code }
}

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host "   PUBLICATION DU SITE BUDGET FOYER" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Que faut-il publier ? ---
$etat = Invoke-Git -Arguments @('status', '--porcelain')
$lignes = @($etat.Sortie | ForEach-Object { "$_" } | Where-Object { $_.Trim() -ne '' })
if ($lignes.Count -eq 0) {
    Write-Host "  Aucune modification a publier." -ForegroundColor Yellow
    Write-Host "  Tout est deja en ligne sur GitHub." -ForegroundColor DarkGray
    Pause-Fin
    exit 0
}

$fichiers = @()
foreach ($ligne in $lignes) {
    if ($ligne.Length -gt 3) { $fichiers += $ligne.Substring(3).Trim().Trim('"') }
}

Write-Host "  Fichiers concernes ($($fichiers.Count)) :" -ForegroundColor White
$fichiers | Select-Object -First 15 | ForEach-Object { Write-Host "     - $_" -ForegroundColor DarkGray }
if ($fichiers.Count -gt 15) { Write-Host "     ... et $($fichiers.Count - 15) autre(s)" -ForegroundColor DarkGray }
Write-Host ""

# --- 2. git add ---
$add = Invoke-Git -Arguments @('add', '-A')
if ($add.Code -ne 0) {
    Write-Host "  Echec de l'etape 'git add'." -ForegroundColor Red
    Invoke-Git -Arguments @('add', '-A') -Afficher | Out-Null
    Pause-Fin
    exit 1
}

# --- 3. git commit ---
$date   = Get-Date -Format 'dd/MM/yyyy HH:mm'
$sujet  = "Publication du $date"
$detail = "Fichiers : " + (($fichiers | Select-Object -First 12) -join ', ')
if ($fichiers.Count -gt 12) { $detail += " (+$($fichiers.Count - 12))" }

$commit = Invoke-Git -Arguments @('commit', '-m', $sujet, '-m', $detail)
if ($commit.Code -ne 0) {
    Write-Host "  Echec de l'etape 'git commit'." -ForegroundColor Red
    $commit.Sortie | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    Pause-Fin
    exit 1
}
Write-Host "  [1/2] Modifications enregistrees : $sujet" -ForegroundColor Green

# --- 4. git push (une nouvelle tentative si GitHub a bouge entre-temps) ---
Write-Host "  [2/2] Envoi vers GitHub..." -ForegroundColor White
$push = Invoke-Git -Arguments @('push', 'origin', 'main')

if ($push.Code -ne 0) {
    Write-Host "  L'envoi a echoue, tentative de synchronisation..." -ForegroundColor Yellow
    $pull = Invoke-Git -Arguments @('pull', '--rebase', '--autostash', 'origin', 'main')
    if ($pull.Code -eq 0) {
        $push = Invoke-Git -Arguments @('push', 'origin', 'main')
    } else {
        $pull.Sortie | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    }
}

if ($push.Code -ne 0) {
    Write-Host ""
    Write-Host "  L'envoi vers GitHub a echoue." -ForegroundColor Red
    $push.Sortie | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    Write-Host ""
    Write-Host "  Ton travail est enregistre en local, rien n'est perdu." -ForegroundColor Yellow
    Write-Host "  Envoie ce message a ton assistant pour qu'il t'aide." -ForegroundColor Yellow
    Pause-Fin
    exit 1
}

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host "   C'EST PUBLIE !" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host "  GitHub a recu les modifications." -ForegroundColor DarkGray
Write-Host "  Le site en ligne peut mettre quelques minutes a se mettre a jour." -ForegroundColor DarkGray
Pause-Fin
exit 0
