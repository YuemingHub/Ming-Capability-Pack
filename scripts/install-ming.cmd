@echo off
rem Ming one-click installer for Windows (double-click this file)
rem Downloads the installer script from the npm registry and runs it automatically.
rem No & or | here, so cmd does not need any escaping; $ passes through to powershell as-is.
title Ming Installer
echo.
echo  ================================================
echo    Ming Installer - installing, please wait...
echo  ================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://registry.npmmirror.com/@mingworkbench/capability-pack/-/capability-pack-0.9.0.tgz';$t=$env:TEMP+'\ming.tgz';[Console]::OutputEncoding=[Text.Encoding]::UTF8;Invoke-WebRequest $u -OutFile $t;$s=(tar -xzOf $t 'package/scripts/install-ming.ps1') -join [char]10;$s=$s.TrimStart([char]0xFEFF);iex $s"
echo.
echo  If you see a problem above, take a screenshot and send it to the person who gave you this file.
echo.
pause
