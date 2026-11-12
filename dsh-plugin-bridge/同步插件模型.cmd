@echo off
cd /d "%~dp0"
set "NODE_EXE=C:\Users\onemt\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" sync-dsh-plugin-models.mjs
echo.
pause
