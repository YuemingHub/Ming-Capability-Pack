@ECHO off
REM ming.cmd — Windows wrapper for Ming Capability Pack
REM
REM 用法：
REM   ming.cmd <自然语言任务描述>
REM   set DSH_PROFILE=web && ming.cmd "帮我整理文件"

SETLOCAL ENABLEDELAYEDEXPANSION

IF "%~1"=="" (
  ECHO [ming] Ming Capability Pack CLI
  ECHO.
  ECHO 用法：
  ECHO   ming.cmd ^<自然语言任务描述^>
  ECHO   set DSH_PROFILE=web ^&^& ming.cmd "帮我整理文件"
  ECHO.
  ECHO 环境变量：
  ECHO   DSH_BIN     dsh bin.js 路径（默认自动查找）
  ECHO   DSH_PROFILE 使用的 profile（默认 ming）
  ECHO   DSH_HOME    Harness 数据目录（默认 %%USERPROFILE%%\.dsh）
  GOTO :eof
)

SET "DSH_BIN_DEFAULT=%~dp0..\node_modules\@deepseek-ai\dsh\lib\bin.js"
IF DEFINED DSH_BIN (
  SET "DSH_BIN=%DSH_BIN%"
) ELSE (
  SET "DSH_BIN=%DSH_BIN_DEFAULT%"
)

IF NOT DEFINED DSH_PROFILE SET "DSH_PROFILE=ming"
IF NOT DEFINED DSH_HOME SET "DSH_HOME=%USERPROFILE%\.dsh"

SET "PROMPT=请调用 ming_auto 工具完成下面的任务：%*"

ECHO [ming] profile=%DSH_PROFILE%
ECHO [ming] prompt=%*

node "%~dp0ming.js" "%DSH_BIN%" "--profile" "%DSH_PROFILE%" "%PROMPT%"
SET "EXITCODE=%ERRORLEVEL%"
EXIT /B %EXITCODE%
