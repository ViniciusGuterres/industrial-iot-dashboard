#!/bin/bash
set -e

echo "Building Go Lambda function for ARM64..."

# Create dist directory
mkdir -p dist

# Build for ARM64 (Graviton2)
GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o dist/bootstrap main.go

echo "Build complete: dist/bootstrap"
echo "Size: $(du -h dist/bootstrap | cut -f1)"

# Optional: Create zip for manual upload
cd dist && zip bootstrap.zip bootstrap && cd ..