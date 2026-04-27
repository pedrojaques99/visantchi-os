$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$cliDir = Join-Path $root "packages\cli\visantchi\packages\cli"

Set-Location $cliDir

# Check latest published version and bump if needed
$localVersion = node -p "require('./package.json').version"
$npmVersion = npm view visantchi version 2>$null
if ($npmVersion -and $npmVersion -eq $localVersion) {
    Write-Host "-> Version $localVersion already published. Bumping patch..."
    npm version patch --no-git-tag-version | Out-Null
    $localVersion = node -p "require('./package.json').version"
    Write-Host "-> Bumped to $localVersion"
} else {
    Write-Host "-> Version $localVersion not yet published, proceeding..."
}

Write-Host ""
Write-Host "-> Building..."
Set-Location $root
npm run build:cli

Set-Location $cliDir

Write-Host ""
Write-Host "-> npm login"
npm login

Write-Host ""
Write-Host "-> Publishing visantchi@$localVersion..."
npm publish --access public

Write-Host ""
Write-Host "Done! Published visantchi@$localVersion"
