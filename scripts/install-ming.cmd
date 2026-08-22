@echo off
rem Ming 一键安装（Windows CMD）—— 等价于 README 里的新人命令
rem 说明：PS 5.1 管道不能传二进制，所以先 -OutFile 落盘再解压；脚本无 BOM + OutputEncoding=UTF8 保证中文不乱码
powershell -NoProfile -ExecutionPolicy Bypass -c "[Console]::OutputEncoding=[Text.Encoding]::UTF8;$t=$env:TEMP+'\ming.tgz';irm 'https://registry.npmjs.org/@mingworkbench/capability-pack/-/capability-pack-0.6.1.tgz' -OutFile $t;$s=(& tar -xzOf $t 'package/scripts/install-ming.ps1')|Out-String -Width 1000;iex $s"
