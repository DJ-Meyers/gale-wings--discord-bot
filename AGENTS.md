# gale-wings--bot

Discord bot for Gale Wings damage calcs. Accepts a `/gwcalc <input>` string, asks the api parser to interpret it, then runs `@smogon/calc` locally via `@dj-meyers/gale-wings/calc`.

## What this repo IS

- A thin discord.js v14 client that registers one slash command (`/gwcalc`) and routes its input through the api parser into the shared calc.
- A consumer of two published packages: `@dj-meyers/gale-wings` (calc + types) and `@dj-meyers/gale-wings--api-types` (router type for tRPC inference).
- Authenticated to the api via a single shared header (`x-service-key: $BOT_API_KEY`). The api's source-tagger middleware (`gale-wings--api/packages/server/src/middleware/source-tag.ts`) gates the parser endpoint.

## What this repo is NOT

- Not a parser. Don't add tokenization, alias, or grammar logic here — every parse goes through `trpc.parser.parseVs.query(...)`.
- Not an api. Don't add new tRPC procedures; if the bot needs new server-side data, that's a `gale-wings--api` PR.
- Not a place for calc machinery. `@dj-meyers/gale-wings/calc` is the source of truth.

## Local dev

```sh
nvm use
export NODE_AUTH_TOKEN=$(gh auth token)   # GitHub Packages read for the @dj-meyers/* packages
pnpm install
cp .env.example .env
# Fill DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, API_URL.
# BOT_API_KEY must match the api's BOT_API_KEY env (see ../discord-bot-plan.md §7.3).
pnpm register-commands   # one-shot; re-run only when a command signature changes
pnpm dev
```

Run the api locally first (`pnpm --filter @galewings/server dev` in `../api`) so the bot can reach `parser.parseVs`.

## Cross-repo rules

- `@dj-meyers/gale-wings` and `@dj-meyers/gale-wings--api-types` ship from GitHub Packages, not npm. The `.npmrc` here points at the GitHub registry and reads `${NODE_AUTH_TOKEN}` for auth — set it before `pnpm install`.
- Bot consumes both packages by version; never reaches into `../data/` or `../api/` directly.
- When the api parser output shape changes: the bot picks up the new `VsResult` through `inferRouterOutputs<AppRouter>['parser']['parseVs']` once `@dj-meyers/gale-wings--api-types` is bumped here.

## Deployment

Railway worker-type service. SIGTERM handler in `src/index.ts` does a graceful `client.destroy()` before exit. No HTTP health endpoint needed.

`BOT_API_KEY` must match the api service's `BOT_API_KEY` in the same Railway environment. See `../discord-bot-plan.md` §7.3 for the per-env story.

## File layout

```
src/
├── env.ts                 zod-validated env (fails fast at boot)
├── log.ts                 pino (pino-pretty in dev)
├── trpc.ts                tRPC client with x-service-key header
├── commands/
│   ├── index.ts           command registry
│   └── calc.ts            /gwcalc handler (per-user cooldown)
├── calc/
│   ├── runCalc.ts         parser.parseVs → parsedPokemonToCalcSide → computeDamage
│   └── format.ts          DamageCalcResult → Discord embed
├── scripts/
│   └── register-commands.ts   one-shot; run when command shape changes
└── index.ts               boot: login + interaction handler + SIGTERM
```
