import { describe, it, expect } from 'vitest'
import { buildChatMessages, HISTORY_LIMIT } from '@/lib/bot/prompt'
import { ROLE_PROMPTS } from '@/lib/bot/roles'
import type { BotConfig, Message } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'

const config = {
  system_prompt: 'Eres el asesor de Clases IA. Sé breve.',
  bot_role: 'ventas',
} as BotConfig

const incoming: InboundMessage = {
  waMessageId: 'wamid.9', from: '593987654321', profileName: 'Ana',
  type: 'text', body: '¿Cuánto cuesta?',
}

function msg(i: number, sender: 'contacto' | 'bot'): Message {
  return {
    id: `m${i}`, contact_id: 'c1', wa_message_id: `w${i}`,
    direction: sender === 'contacto' ? 'inbound' : 'outbound',
    sender, type: 'text', body: `mensaje ${i}`, status: 'sent', error: null,
    created_at: `2026-08-12T10:${String(i).padStart(2, '0')}:00Z`,
  }
}

describe('buildChatMessages', () => {
  it('pone el prompt del usuario en el mensaje de sistema', () => {
    const r = buildChatMessages({ config, history: [], incoming })
    expect(r[0].role).toBe('system')
    expect(r[0].content).toContain('Eres el asesor de Clases IA.')
  })

  it('termina con el mensaje entrante como user', () => {
    const r = buildChatMessages({ config, history: [], incoming })
    expect(r.at(-1)).toEqual({ role: 'user', content: '¿Cuánto cuesta?' })
  })

  it('mapea el historial en orden cronológico con los roles correctos', () => {
    const history = [msg(1, 'contacto'), msg(2, 'bot')]
    const r = buildChatMessages({ config, history, incoming })
    expect(r.slice(1, 3)).toEqual([
      { role: 'user', content: 'mensaje 1' },
      { role: 'assistant', content: 'mensaje 2' },
    ])
  })

  it('recorta el historial a los últimos HISTORY_LIMIT mensajes', () => {
    const history = Array.from({ length: 40 }, (_, i) => msg(i, i % 2 ? 'bot' : 'contacto'))
    const r = buildChatMessages({ config, history, incoming })
    expect(r).toHaveLength(HISTORY_LIMIT + 2) // sistema + historial + entrante
    expect(r[1].content).toBe('mensaje 25')
  })

  it('descarta mensajes con cuerpo vacío del historial', () => {
    const vacio = { ...msg(3, 'contacto'), body: '   ' }
    const r = buildChatMessages({ config, history: [vacio], incoming })
    expect(r).toHaveLength(2)
  })

  it('usa el prompt base del rol si el usuario no escribió el suyo', () => {
    const r = buildChatMessages({ config: { ...config, system_prompt: '' }, history: [], incoming })
    expect(r[0].content).toContain(ROLE_PROMPTS.ventas)
  })
})
