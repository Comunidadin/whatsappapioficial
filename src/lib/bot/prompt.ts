import type { BotConfig, Message } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'
import { ROLE_PROMPTS, type BotRole } from '@/lib/bot/roles'

export const HISTORY_LIMIT = 15

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const REGLAS_CANAL = [
  'Estás conversando por WhatsApp: responde en 1 o 2 párrafos cortos, sin listas largas ni formato markdown.',
  'Escribe en español, en el mismo tono con el que te escriben.',
  'Nunca inventes precios, fechas ni datos que no estén en tus instrucciones.',
].join(' ')

export function buildChatMessages(input: {
  config: BotConfig
  history: Message[]
  incoming: InboundMessage
}): ChatMessage[] {
  const { config, history, incoming } = input
  const base =
    config.system_prompt.trim() ||
    ROLE_PROMPTS[config.bot_role as BotRole] ||
    ROLE_PROMPTS.personalizado

  const previos: ChatMessage[] = history
    .filter((m) => m.body.trim() !== '')
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.sender === 'contacto' ? 'user' : 'assistant', content: m.body }))

  return [
    { role: 'system', content: `${base}\n\n${REGLAS_CANAL}` },
    ...previos,
    { role: 'user', content: incoming.body },
  ]
}
