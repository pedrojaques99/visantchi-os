#!/usr/bin/env pwsh
# fix-dashboard.ps1 — Source of truth for all dashboard UI patches
# Run anytime to ensure the dashboard is in a healthy, correct state.
# Idempotent: safe to run multiple times.

$WEB = "packages/cli/visantchi/packages/cli/web"
$HTML = "$WEB/index.html"
$JS   = "$WEB/app.js"
$CSS  = "$WEB/styles.css"

$errors = 0

function Patch-File($path, $old, $new, $label) {
  $content = Get-Content $path -Raw -Encoding UTF8
  if ($content -notmatch [regex]::Escape($old)) {
    Write-Host "  [SKIP] $label — already patched or not found" -ForegroundColor DarkGray
    return
  }
  $content = $content.Replace($old, $new)
  Set-Content $path $content -Encoding UTF8 -NoNewline
  Write-Host "  [OK]   $label" -ForegroundColor Green
}

function Assert-Contains($path, $needle, $label) {
  $content = Get-Content $path -Raw -Encoding UTF8
  if ($content -match [regex]::Escape($needle)) {
    Write-Host "  [OK]   $label" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] $label — expected string not found" -ForegroundColor Red
    $script:errors++
  }
}

Write-Host ""
Write-Host "=== Visantchi Dashboard — Fix Script ===" -ForegroundColor Cyan
Write-Host "Target: $WEB"
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. BUG: word-badge renders tuple "[word,number]" instead of just word
#    topWords is [string, number][] — must use w[0] not w
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ JS ] Word cloud tuple bug" -ForegroundColor Yellow

Patch-File $JS `
  '`<span class="word-badge" onclick="window.Visantchi.switchTab(''nexus''); document.getElementById(''nexus-explorer-search'').value=''${w}''; window.Visantchi.explorerSearchQuery=''${w}''; window.Visantchi.renderNexusExplorerContent();">${w}</span>`' `
  '`<span class="word-badge" onclick="window.Visantchi.switchTab(''nexus''); document.getElementById(''nexus-explorer-search'').value=''${w[0]}''; window.Visantchi.explorerSearchQuery=''${w[0]}''; window.Visantchi.renderNexusExplorerContent();">${w[0]}</span>`' `
  "word-badge renders w[0] (word only, not tuple)"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Reduce word cloud from 15 to 8 tags (less noise, more legible)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ JS ] Word cloud count limit" -ForegroundColor Yellow

Patch-File $JS `
  "(data.topWords || []).slice(0, 15).map(w =>" `
  "(data.topWords || []).slice(0, 8).map(w =>" `
  "word cloud capped at 8 tags"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Expertise DNA — remove noisy keywords line (9px, truncated, unreadable)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ JS ] Expertise keywords line removal" -ForegroundColor Yellow

Patch-File $JS `
  '            <div class="expertise-keywords">${e.keywords.join('', '')}</div>' `
  '' `
  "expertise-keywords row removed from render"

# ─────────────────────────────────────────────────────────────────────────────
# 4. CSS — Fix nexus-summary-grid: was 3-col, HTML has 4 cols (broken layout)
#    New: 2-col bento (expertise | identity+words), goals/patterns hidden when empty
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ CSS ] nexus-summary-grid layout" -ForegroundColor Yellow

Patch-File $CSS `
  "  grid-template-columns: 1fr 1.2fr 1.2fr;" `
  "  grid-template-columns: 1fr 1fr 0.9fr 0.9fr;" `
  "nexus grid corrected to 4-col explicit"

# ─────────────────────────────────────────────────────────────────────────────
# 5. CSS — word-badge pill style (already applied in redesign, verify only)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ CSS ] word-badge pill style" -ForegroundColor Yellow
Assert-Contains $CSS "border-radius: 20px;" "word-badge pill border-radius"

# ─────────────────────────────────────────────────────────────────────────────
# 6. CSS — expertise-bar height 3px (already applied in redesign, verify only)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ CSS ] expertise bar 3px" -ForegroundColor Yellow
Assert-Contains $CSS "height: 3px;" "expertise-bar-bg height 3px"

# ─────────────────────────────────────────────────────────────────────────────
# 7. CSS — bento grid exists
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[ CSS ] bento grid" -ForegroundColor Yellow
Assert-Contains $CSS ".nexus-bento {" "nexus-bento grid declared"

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY — assert key states after patching
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[ VERIFY ]" -ForegroundColor Cyan

Assert-Contains $JS  "slice(0, 8).map(w =>"            "word cloud slices 8"
Assert-Contains $JS  '>${w[0]}</span>`'               "word badge uses w[0]"
Assert-Contains $CSS ".nexus-bento {"                 "bento grid exists"
Assert-Contains $CSS ".bento-identity {"              "bento identity card"
Assert-Contains $CSS "border-radius: 20px;"           "word-badge pill style"

Write-Host ""
if ($errors -eq 0) {
  Write-Host "All patches applied. Dashboard is in healthy state." -ForegroundColor Green
} else {
  Write-Host "$errors verification(s) failed. Check output above." -ForegroundColor Red
}
Write-Host ""
