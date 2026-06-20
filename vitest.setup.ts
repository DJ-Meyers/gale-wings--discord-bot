// Bot env validation runs at module load (src/env.ts). Tests that don't
// exercise discord.js or the trpc client still pull env.ts transitively
// through log.ts / format.ts, so the placeholders need to be present.
process.env.DISCORD_BOT_TOKEN ??= 'test-discord-token'
process.env.DISCORD_APPLICATION_ID ??= '000000000000000000'
process.env.API_URL ??= 'http://localhost:8787'
process.env.BOT_API_KEY ??= 'gwbot_test_key_for_vitest_only_must_be_long'
