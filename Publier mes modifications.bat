@echo off
rem Double-clique sur ce fichier pour publier tes modifications sur GitHub.
rem Il lance Publier.ps1 (git add + git commit + git push) dans cette fenetre.
title Publication du site Budget Foyer
chcp 65001 >nul 2>&1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publier.ps1"
if errorlevel 1 (
  echo.
  echo La publication n'a pas abouti.
  pause
)
