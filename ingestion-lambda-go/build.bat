@echo off
echo Building Go Lambda for ARM64...

REM Download dependencies first
echo Downloading Go dependencies...
go mod download

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to download dependencies!
    exit /b 1
)

REM Create dist directory
if not exist dist mkdir dist

REM Build for Linux ARM64 (AWS Lambda Graviton)
set GOOS=linux
set GOARCH=arm64
set CGO_ENABLED=0

echo Compiling for Linux ARM64...
go build -o dist\bootstrap main.go

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build successful! Binary created at dist\bootstrap
    dir dist\bootstrap
) else (
    echo ❌ Build failed!
    exit /b 1
)
