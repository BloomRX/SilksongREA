@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SilksongREA - analise local

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ERRO: Windows PowerShell nao encontrado.
    set "EXIT_CODE=1"
    goto :finish
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

:finish
echo.
if "%EXIT_CODE%"=="0" (
    echo Processo concluido. Veja reports\latest.
) else (
    echo Processo terminou com erro. Veja reports\latest e .local.
)
if not defined SILKSONG_REA_NO_PAUSE (
    if /i not "%CI%"=="true" pause
)
exit /b %EXIT_CODE%
