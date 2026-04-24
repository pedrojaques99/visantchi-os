# visantchi-os

Cockpit root for the Visantchi ecosystem. No code lives here — all logic is in the submodules.

## Structure

```
visantchi-os/
├── packages/
│   ├── cli/     → github.com/pedrojaques99/visantchi-cli
│   └── social/  → github.com/pedrojaques99/visantchi-social
└── package.json
```

## Setup

```bash
git clone --recurse-submodules <this-repo>
npm install
```

If already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start CLI + Social in parallel |
| `npm run dev:cli` | Start CLI only |
| `npm run dev:social` | Start Social only |
| `npm run build` | Build both |
| `npm run test` | Test both |
| `npm run update` | Pull latest from both submodule remotes |

## Updating submodules

```bash
npm run update
# then commit the new submodule pointers
git add packages/cli packages/social
git commit -m "chore: update submodules"
```
