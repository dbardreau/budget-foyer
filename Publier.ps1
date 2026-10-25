# Publie les modifications du site Budget Foyer sur GitHub.
# Fait exactement ce que tu faisais a la main :
#   git add .  ->  git commit -m "..."  ->  git push
# A lancer par double-clic sur "Publier mes modifications.bat".

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

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

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host "   PUBLICATION DU SITE BUDGET FOYER" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Que faut-il publier ? ---
$changes = @(& $git status --porcelain)
if ($changes.Count -eq 0) {
    Write-Host "  Aucune modification a publier." -ForegroundColor Yellow
    Write-Host "  Tout est deja en ligne sur GitHub." -ForegroundColor DarkGray
    Pause-Fin
    exit 0
}

$files = @()
foreach ($line in $changes) {
    if ($line.Length -gt 3) { $files += $line.Substring(3).Trim().Trim('"') }
}

Write-Host "  Fichiers concernes ($($files.Count)) :" -ForegroundColor White
$files | Select-Object -First 15 | ForEach-Object { Write-Host "     - $_" -ForegroundColor DarkGray }
if ($files.Count -gt 15) { Write-Host "     ... et $($files.Count - 15) autre(s)" -ForegroundColor DarkGray }
Write-Host ""

# --- 2. git add ---
& $git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Echec de l'etape 'git add'." -ForegroundColor Red
    Pause-Fin
    exit 1
}

# --- 3. git commit ---
$date   = Get-Date -Format 'dd/MM/yyyy HH:mm'
$sujet  = "Publication du $date"
$detail = "Fichiers : " + (($files | Select-Object -First 12) -join ', ')
if ($files.Count -gt 12) { $detail += " (+$($files.Count - 12))" }

& $git commit -m $sujet -m $detail | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Echec de l'etape 'git commit'." -ForegroundColor Red
    Pause-Fin
    exit 1
}
Write-Host "  [1/2] Modifications enregistrees : $sujet" -ForegroundColor Green

# --- 4. git push (avec une nouvelle tentative si GitHub a bouge entre-temps) ---
Write-Host "  [2/2] Envoi vers GitHub..." -ForegroundColor White
$push = & $git push origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  L'envoi a echoue, tentative de synchronisation..." -ForegroundColor Yellow
    $pull = & $git pull --rebase origin main 2>&1
    if ($LASTEXITCODE -eq 0) {
        $push = & $git push origin main 2>&1
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  L'envoi vers GitHub a echoue." -ForegroundColor Red
    $push | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
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
