# Plan: Share Insights — "LinkedIn dos Mascotes"

## Visão

Usuário clica em **SHARE** → escolhe o que expor → gera card viral (OG image) + página pública no Social com feed de insights customizável.

Dados seguros por padrão. Sem custos, sem nomes de projetos. Identidade de dev, não financeiro.

---

## Dados Permitidos (safe preset — nunca expõe custo ou projetos)

| Campo | Origem | Exemplo |
|---|---|---|
| Agentic DNA narrative | insights.summary | "Prolific builder with high focus time" |
| Success rate | insights.at_a_glance.success_rate | 99% |
| Focus time (horas) | insights.at_a_glance.total_hours | 658.8h |
| Sessions count | insights.at_a_glance.total_sessions | 715 |
| Archetype/style | insights.interaction_style | "Deep iterative, heavy context" |
| Peak hour / peak day | insights.time_patterns | 7PM · Tuesday |
| Top model (nome só) | insights.model_breakdown[0].name | opus-4-7 |
| Activity heatmap | dailyActivity (sessions, sem custo) | últimos 30 dias |
| Current streak | profile.currentStreak | 12 dias |
| What works (tags) | insights.what_works | ["focus blocks", "iterative"] |

**Nunca expostos:** totalCost, costUSD, projected/month, project names, dailyActivity.costUSD.

---

## Controle do Usuário

Cada seção é um toggle independente (default: ON para todas):

- [ ] Agentic DNA summary
- [ ] Success rate + Focus time + Sessions
- [ ] Archetype / Interaction style
- [ ] Time patterns (peak hour/day)
- [ ] Top model
- [ ] Activity heatmap
- [ ] What works
- [ ] Streak

Visibilidade geral: `PUBLIC` / `PRIVATE` (herdado do perfil existente).

---

## Arquitetura

```
CLI dashboard
  └── SHARE click
        └── POST /api/insights/share (CLI server)
              ├── GET /api/insights/full (local)
              ├── strip sensitive fields (custo, projetos)
              ├── PUT social/api/profiles/me/insights (Bearer)
              └── return { url: "visantchi.com/p/{nickname}" }

Social API (Hono)
  └── PUT /api/profiles/me/insights   ← novo endpoint
  └── GET /api/profiles/:nickname      ← inclui insights se público

Social UI (Next.js)
  └── /p/[nickname]                   ← nova tab "Insights"
  └── /api/og/mascot/[nickname]       ← OG card atualizado com DNA
```

---

## Fases de Implementação

### Fase 1 — Backend Social (Social repo)

**1.1 Schema Prisma**
- Adicionar ao `Profile`:
  ```prisma
  insights       Json?
  insightsAt     DateTime?
  insightsConfig Json?   // { dna: bool, stats: bool, style: bool, ... }
  ```
- Migration: `prisma migrate dev --name add_insights`

**1.2 Validator** (`src/validators/schemas.ts`)
- `insightsPayloadSchema` — valida apenas os campos safe (sem custo)
- `insightsConfigSchema` — toggles de visibilidade

**1.3 Rota** (`src/routes/profile.routes.ts`)
- `PUT /me/insights` — salva insights + config
- `PATCH /me/insights/config` — atualiza só os toggles
- `GET /:nickname` — inclui `insights` filtrado por config quando PUBLIC

---

### Fase 2 — CLI: Share endpoint + botão

**2.1 Rota server** (`src/server/routes/insights.ts`)
- `POST /api/insights/share`
  - Busca `/api/insights/full`
  - Sanitiza: remove `costUSD`, `totalCost`, project names
  - Lê `~/.visantchi/auth.json`
  - PUT para Social API
  - Retorna `{ url, nickname }`

**2.2 Dashboard** (`web/app.js`)
- Substituir stub `shareInsights()`:
  - Loading state no botão
  - Modal de seleção (toggles por seção)
  - Botão confirmar → chama `/api/insights/share` com config
  - Sucesso: mostra link copiável + botão "Abrir perfil"

---

### Fase 3 — UI Social: Tab Insights + OG Card

**3.1 Tab Insights** (`ui/src/app/p/[nickname]/`)
- Nova tab no `MascotProfileView`
- Renderiza seções habilitadas: DNA card, stat chips, heatmap, what works
- Se seção desabilitada: não aparece (nem placeholder)
- Se perfil privado ou sem insights: sem tab

**3.2 OG Card atualizado** (`ui/src/app/api/og/mascot/[nickname]/route.tsx`)
- Se insights disponíveis: inclui DNA summary + success rate no card
- Card vira "Wrapped-style": mascot + identidade + 2-3 stats chave

---

## Ordem de execução

1. Fase 1 (Social backend) — fundação
2. Fase 2 (CLI) — ativa o botão
3. Fase 3 (UI) — torna viral

---

## O que NÃO está no escopo

- Notificações quando alguém vê seus insights (fase futura)
- Exportar como PDF/imagem diretamente do dashboard
- Comparar insights entre usuários
- Feed/timeline de insights no social

---

## Arquivos a criar/editar

### Social
- `prisma/schema.prisma` — +3 campos
- `src/validators/schemas.ts` — +2 schemas
- `src/routes/profile.routes.ts` — +2 rotas
- `src/services/profile.service.ts` — lógica de filtrar por config

### CLI
- `src/server/routes/insights.ts` — nova rota share
- `web/app.js` — shareInsights() real + modal

### Social UI
- `ui/src/app/p/[nickname]/MascotProfileView.tsx` — tab insights
- `ui/src/app/p/[nickname]/InsightsTab.tsx` — novo componente
- `ui/src/app/api/og/mascot/[nickname]/route.tsx` — OG card atualizado
