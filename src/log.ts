import pino from 'pino'

import { env } from '~/env'

const isDev = process.env.NODE_ENV !== 'production'

// Raw JSON in prod (Railway log aggregator parses fields natively),
// pino-pretty in dev so the terminal is readable.
export const log = pino({
  level: env.LOG_LEVEL,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    },
  }),
})
