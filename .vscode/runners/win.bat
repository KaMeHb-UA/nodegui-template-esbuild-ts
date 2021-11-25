@echo off

set curdir="%~dp0"
for %%F in ("%curdir%") do set vscodedir="%%~dpF"
for %%F in ("%vscodedir%") do set root="%%~dpF"
pushd "%root%"
echo "Building an app..."
node build
echo "Done"
popd
start "" /b "%root%\node_modules\.bin\qode.exe" "%*"
