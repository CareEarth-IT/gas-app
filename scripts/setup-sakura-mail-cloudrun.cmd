@echo off
setlocal
if "%~1"=="" goto usage
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-sakura-mail-cloudrun.ps1" -MailSecret %1
exit /b %ERRORLEVEL%

:usage
echo Usage: scripts\setup-sakura-mail-cloudrun.cmd SECRET_VALUE
exit /b 1
