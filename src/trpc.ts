import type { AppRouter } from '@dj-meyers/gale-wings--api-types'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

import { env } from '~/env'

// httpBatchLink packs N calls per HTTP request. The api caps parser batches at
// 10 (see api's middleware/batch-cap.ts); we send one parse per /gwcalc, so the
// cap doesn't bite in practice. Keep batching on so any future co-located calls
// still amortise.
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.API_URL}/api/trpc`,
      transformer: superjson,
      maxURLLength: 2048,
      headers: () => ({
        // The api's source-tagger keys 'source:bot' off this header. Wrong/
        // missing → 401, no Origin/no key → 403. See plan §7.2.
        'x-service-key': env.BOT_API_KEY,
        'x-service-name': 'discord-bot',
      }),
    }),
  ],
})
