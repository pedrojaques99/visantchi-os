# Plan: Insights UI/UX Fix

Objetivo: corrigir todos os issues encontrados no audit, alinhado ao DESIGN.md.
Regras: sem emojis, sem inline styles, tokens como source of truth, brutalist.

---

## Wave 1 — Tokens (styles.css) — base de tudo

**1.1 Reconciliar tokens divergentes**

Em `styles.css` `:root`:

- Alterar `--color-error: #ff4444` → `#a12c7b` (alinha com tokens.md)
- Adicionar `--color-text-faint: #3d3c3a`
- Adicionar `--color-primary-dim: #2a5a62`
- Adicionar `--color-cursor: #a78bfa` (Cursor IDE — token explícito ao invés de hard-coded)
- Remover `--color-text-secondary: rgba(255,255,255,0.55)` e documentar em tokens.md como token oficial com nome semântico

**1.2 Substituir hard-coded colors no CSS**

- `.mascot-ascii` mood `burnt`: `#ff3e3e` → manter como exception de estado expressivo (fora do sistema, intencional)
- `.mascot-ascii` mood `rage`: `#ff0055` → idem, estado extremo
- `.tools-ide-card.ide-cursor` e `.ide-dot-cursor`: `#a78bfa` → `var(--color-cursor)`

---

## Wave 2 — CSS: classes faltantes e limpeza

**2.1 Criar `.btn-action`**

Adicionar ao `styles.css`:

```css
.btn-action {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-action:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-action.small {
  font-size: 9px;
  padding: 0.3rem 0.65rem;
}
```

**2.2 Criar classes para insights inline styles recorrentes**

Adicionar ao `styles.css`:

```css
/* usadas no renderInsightsView */
.insights-narrative-secondary {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.insights-sub-label {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 0.75rem;
}
```

---

## Wave 3 — HTML (index.html): remover emojis e inline styles

**3.1 Insights action bar — substituir emojis por símbolos**

```html
<!-- ANTES -->
<button class="btn-action" onclick="..."><span>📋</span> Copy JSON</button>
<button class="btn-action" onclick="..."><span>📄</span> View .md</button>
<button class="btn-action" onclick="..."><span>🤖</span> Ask AI</button>
<button class="btn-action" onclick="..."><span>📤</span> Share</button>

<!-- DEPOIS -->
<button class="btn-action" onclick="...">[ ] Copy JSON</button>
<button class="btn-action" onclick="...">.md Export</button>
<button class="btn-action" onclick="...">~ Ask AI</button>
<button class="btn-action" onclick="...">^ Share</button>
```

**3.2 ADVANCED button — remover inline style**

```html
<!-- ANTES -->
<button class="btn-action small mono" onclick="..." style="margin-right:0.5rem">
  <span>⚙</span> ADVANCED
</button>

<!-- DEPOIS -->
<button class="btn-action small mono" onclick="...">ADVANCED</button>
<!-- gap já existe em .view-actions gap:0.75rem -->
```

**3.3 BYOK modal — remover inline style de height**

```html
<!-- ANTES -->
<div class="ask-ai-modal" style="height: auto; max-height: 90vh;">

<!-- DEPOIS: criar variante CSS -->
<div class="ask-ai-modal ask-ai-modal--auto">
```

Adicionar no CSS:
```css
.ask-ai-modal--auto { height: auto; max-height: 90vh; }
```

**3.4 BYOK provider headers — remover inline styles**

Criar classe `.byok-provider-name` no CSS, substituir `style="font-size:11px; color:..."` inline.

---

## Wave 4 — app.js: bugs e limpeza

**4.1 Corrigir `viewInsightsMD()` — MD descartado**

```js
// ANTES
const md = await res.text();
this.openDocsOverlay('Insights', 'visantchi-report.md');

// DEPOIS
const md = await res.text();
this.openDocsOverlay('Insights Report', 'visantchi-report.md', md);
```

Verificar assinatura de `openDocsOverlay` e passar o conteúdo corretamente.

**4.2 Feedback visual no re-fetch de insights**

```js
async fetchInsights() {
  const body = document.getElementById('insights-body');
  if (!body) return;
  // adicionar indicador se já tem dados
  const refreshBtn = document.querySelector('[onclick="window.Visantchi.fetchInsights()"]');
  if (refreshBtn) refreshBtn.textContent = '↻'; // já está certo, adicionar classe loading
  if (!this.insightsData) {
    body.innerHTML = '<div class="empty-state">Synthesizing agentic data...</div>';
  } else {
    // overlay leve: opacidade sem apagar conteúdo
    body.style.opacity = '0.5';
  }
  try {
    // ...fetch...
    body.style.opacity = '1';
    this.renderInsightsView(data);
  } catch (err) {
    body.style.opacity = '1';
    // ...
  }
}
```

**4.3 Substituir inline styles recorrentes no `renderInsightsView`**

Mapeamento de substituições:

| inline style | classe a usar |
|---|---|
| `style="font-size:10px;color:var(--color-text-muted)"` | `class="insights-sub-label"` |
| `style="font-size:11px;color:var(--color-text-secondary)"` | `class="insights-narrative-secondary"` |
| `style="flex-wrap:wrap;"` em insights-stat-row | adicionar variant `.insights-stat-row--wrap` |
| `style="display:grid;grid-template-columns:repeat(auto-fit,...)"` em Suggestions | extrair para `.suggestions-grid` no CSS |

**4.4 `badge color-warning` / `badge color-success` — remover dependência de `!important`**

Criar `.badge--warning` e `.badge--success` ao invés de compor com `.color-warning`:

```css
.badge--warning { color: var(--color-warning); }
.badge--success { color: var(--color-success); }
```

---

## Wave 5 — tokens.md: documentar tokens reais

Atualizar `docs/design/tokens.md` para refletir o estado real do CSS após as correções:
- Adicionar `--color-cursor`, `--color-text-secondary`, `--space-md`
- Corrigir `--color-error`
- Remover tokens que não existem no CSS

---

## Ordem de execução

```
Wave 1 (styles.css tokens)  →  Wave 2 (styles.css classes)
       ↓
Wave 3 (index.html)  →  Wave 4 (app.js)
       ↓
Wave 5 (tokens.md)
```

Waves 1+2 podem ir em paralelo com Wave 3.
Wave 4 depende de Wave 2 (classes precisam existir antes de referenciar).
Wave 5 é última (documenta o estado final).

---

## Arquivos tocados

| Arquivo | Waves |
|---|---|
| `web/styles.css` | 1, 2 |
| `web/index.html` | 3 |
| `web/app.js` | 4 |
| `docs/design/tokens.md` | 5 |
