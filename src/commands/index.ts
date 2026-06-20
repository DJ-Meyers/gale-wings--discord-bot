import * as calc from '~/commands/calc'

// Registry consumed by both the boot path (commands/index.ts → index.ts) and
// the one-shot register-commands script. New commands: add an import + entry.
export const commands = [calc] as const

export type Command = (typeof commands)[number]
