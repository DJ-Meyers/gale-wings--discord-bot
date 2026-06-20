# gale-wings--discord-bot


https://github.com/user-attachments/assets/6a704341-7bbd-4551-b507-4d8279b8bf6a


Discord bot for Gale Wings damage calcs. One slash command: `/gwcalc <input>`.

The bot asks the [Gale Wings api](../api) parser to interpret a damage-calc string ("X SpA Gardevoir Dazzling Gleam vs Garchomp"), then runs `@smogon/calc` locally via [`@dj-meyers/gale-wings/calc`](../data) and replies with the percent range, KO chance, and the calc desc.

## Setup

```sh
nvm use
export NODE_AUTH_TOKEN=$(gh auth token)   # for @dj-meyers/* on GitHub Packages
pnpm install
cp .env.example .env
# Fill the env vars (see comments in .env.example)
pnpm register-commands                    # one-shot
pnpm dev
```

You need:
- A Discord application + bot token (https://discord.com/developers/applications)
- A test guild + its snowflake ID for `DISCORD_GUILD_ID` (instant command updates during dev)
- The Gale Wings api running locally on `API_URL` (default `http://localhost:8787`)
- `BOT_API_KEY` matching the api's `BOT_API_KEY` (see `../discord-bot-plan.md` §7.3)

## Scripts

- `pnpm dev` — boot in watch mode
- `pnpm build` — `tsc` to `dist/`
- `pnpm start` — run from `dist/`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — vitest
- `pnpm register-commands` — re-PUT the slash command shape to Discord; needed only when a command signature changes

## See also

- `AGENTS.md` — orientation for future agents working in this repo
- `../discord-bot-plan.md` — the design doc this implements
- `../AGENTS.md` — ecosystem-wide rules across the four sibling repos
