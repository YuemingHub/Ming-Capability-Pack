<#
  install-ming.ps1 — 一键安装 Ming（DeepSeek Harness 自然语言能力中间件）

  给完全不懂技术的新人：复制一条命令，自动完成安装。

  方式 A（npm 源，国内可达，推荐）：脚本已打包在 npm 里，经国内 npmmirror 镜像拉取：
    powershell -NoProfile -ExecutionPolicy Bypass -c "irm https://registry.npmmirror.com/@mingworkbench/capability-pack/-/capability-pack-0.6.0.tgz | tar -xzO package/scripts/install-ming.ps1 | iex"

  方式 B（GitHub 源，需能访问 GitHub）：
    powershell -NoProfile -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/YuemingHub/Ming-Capability-Pack/main/scripts/install-ming.ps1 | iex"
    （GitHub 慢可换：irm https://cdn.jsdelivr.net/gh/YuemingHub/Ming-Capability-Pack@main/scripts/install-ming.ps1 | iex）

  脚本自动完成：
    1. 定位 DSH Desktop（注册表 / 常见安装目录 / 正在运行的进程）
    2. 定位 Harness 数据目录（%APPDATA%\dsh-desktop\harness 或 %USERPROFILE%\.dsh）
    3. 选择 profile（web → headless → 第一个已存在的）
    4. 用 DSH 自带的 pnpm 从 npmmirror（国内镜像）安装插件——不依赖 GitHub、不依赖系统 npm / npx，绕开 npm-cache 权限问题
    5. 打印「重启后直接说自然语言」的引导

  可选参数：
    -Profile <name>   指定 profile（默认自动探测）
    -Source  <spec>   插件源（默认 @mingworkbench/capability-pack，npm 包名；也支持 github:YuemingHub/Ming-Capability-Pack）
    -Registry <url>   pnpm registry（默认 https://registry.npmmirror.com，国内镜像）
    -DryRun           只探测，不真正安装
#>
param(
  [string]$Profile = '',
  [string]$Source = '@mingworkbench/capability-pack',
  [string]$Registry = 'https://registry.npmmirror.com',
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  FAIL $msg" -ForegroundColor Red; exit 1 }

# ---------- 1. 定位 DSH Desktop 的 bin.js ----------
Write-Step '定位 DSH Desktop ...'
$bin = $null

$regBases = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($base in $regBases) {
  foreach ($item in (Get-ItemProperty $base -ErrorAction SilentlyContinue)) {
    if ($item.DisplayName -match 'DSH' -and $item.InstallLocation) {
      $cand = Join-Path $item.InstallLocation 'resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js'
      if (Test-Path $cand) { $bin = $cand; break }
    }
  }
  if ($bin) { break }
}

if (-not $bin) {
  $common = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DSH Desktop'),
    (Join-Path $env:ProgramFiles 'DSH Desktop'),
    (Join-Path ${env:ProgramFiles(x86)} 'DSH Desktop')
  )
  foreach ($dir in $common) {
    $cand = Join-Path $dir 'resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js'
    if (Test-Path $cand) { $bin = $cand; break }
  }
}

if (-not $bin) {
  $proc = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'dsh|deepseek' } | Select-Object -First 1
  if ($proc -and $proc.Path) {
    $exeDir = Split-Path $proc.Path -Parent          # ...\DSH Desktop
    $cand = Join-Path $exeDir 'resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js'
    if (Test-Path $cand) { $bin = $cand }
  }
}

if (-not $bin) { Write-Err '没有找到 DSH Desktop。请先安装并打开一次 DSH Desktop（完成登录），再运行本命令。' }
Write-Ok "DSH Desktop: $bin"

# ---------- 2. 定位 DSH_HOME ----------
Write-Step '定位 Harness 数据目录 ...'
$dshHome = Join-Path $env:APPDATA 'dsh-desktop\harness'
if (-not (Test-Path (Join-Path $dshHome 'profiles'))) {
  $alt = Join-Path $env:USERPROFILE '.dsh'
  if (Test-Path (Join-Path $alt 'profiles')) { $dshHome = $alt }
}
if (-not (Test-Path (Join-Path $dshHome 'profiles'))) {
  Write-Err "还没有找到 Harness 数据目录（$dshHome）。请先打开一次 DSH Desktop 完成初始化。"
}
Write-Ok "DSH_HOME: $dshHome"

# ---------- 3. 选择 profile ----------
Write-Step '选择 profile ...'
$profileRoot = Join-Path $dshHome 'profiles'
$profiles = Get-ChildItem $profileRoot -Directory | Where-Object { $_.Name -ne 'node_modules' }
if (-not $Profile) {
  if ($profiles.Name -contains 'web') { $Profile = 'web' }
  elseif ($profiles.Name -contains 'headless') { $Profile = 'headless' }
  elseif ($profiles.Count -gt 0) { $Profile = $profiles[0].Name }
}
if (-not $Profile) { Write-Err '还没有任何 profile。请先打开一次 DSH Desktop（会创建默认 profile）。' }
Write-Ok "profile: $Profile"

# ---------- 4. 用 DSH 自带 pnpm（绕开系统 npm-cache 权限问题）----------
$desktopBin = Join-Path $dshHome '.desktop-bin'
if (Test-Path $desktopBin) { $env:Path = $desktopBin + ';' + $env:Path }
$env:DSH_HOME = $dshHome
$env:DSH_BIN = $bin

# ---------- 5. 安装 ----------
Write-Step "安装插件：$Source（profile: $Profile，registry: $Registry）"
if ($DryRun) {
  Write-Ok "（DryRun）将执行: node `"$bin`" plugin --profile $Profile add $Source --registry=`"$Registry`""
  exit 0
}

& node $bin plugin --profile $Profile add $Source "--registry=$Registry"
if ($LASTEXITCODE -ne 0) {
  Write-Err "安装失败（退出码 $LASTEXITCODE）。请检查网络后重试；仍失败请把上面的完整输出发给维护者。"
}

# ---------- 6. 引导 ----------
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  Ming 已安装完成！' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ''
Write-Host '接下来只需 3 步：'
Write-Host '  1. 完全退出 DSH Desktop（关闭窗口，任务栏右下角图标也右键退出）'
Write-Host '  2. 重新打开 DSH Desktop'
Write-Host '  3. 在对话框里直接说出你想做的事，例如：'
Write-Host '       "我想做个个人网站展示我的作品"' -ForegroundColor Yellow
Write-Host '       "帮我整理下载文件夹，太乱了"' -ForegroundColor Yellow
Write-Host '       "把这周的数据做成一份周报"' -ForegroundColor Yellow
Write-Host '       "把这段文字变成一张信息图"' -ForegroundColor Yellow
Write-Host ''
Write-Host '它不会让你填任何技术配置：会先问你选「先做个能看的版本」还是「先问你几个问题」，'
Write-Host '你选完（或说"你看着办"）它就开始做，做完告诉你文件在哪、怎么打开。'
Write-Host ''
