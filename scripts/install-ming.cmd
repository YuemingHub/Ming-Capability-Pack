@echo off
rem Ming 一键安装（Windows CMD 包装器，等价于 scripts/install-ming.ps1）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-ming.ps1" %*
