@echo off
rem Ming one-click installer for Windows CMD (equivalent to the PowerShell command in README)
rem No & or | here, so cmd does not need any escaping; $ passes through to powershell as-is
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://registry.npmmirror.com/@mingworkbench/capability-pack/-/capability-pack-0.6.2.tgz';$t=$env:TEMP+'\ming.tgz';[Console]::OutputEncoding=[Text.Encoding]::UTF8;Invoke-WebRequest $u -OutFile $t;$s=(tar -xzOf $t 'package/scripts/install-ming.ps1') -join [char]10;$s=$s.TrimStart([char]0xFEFF);iex $s"
