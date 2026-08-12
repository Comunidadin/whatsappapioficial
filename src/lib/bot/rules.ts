import type { BotConfig, BusinessHours, Contact } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'

export const TEXTO_SOLO_TEXTO =
  'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?'

export type BotDecision =
  | { action: 'ai'; welcome: string | null }
  | { action: 'canned'; text: string }
  | { action: 'silent'; reason: string; needsAttention: boolean }

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function matchEscalation(text: string, keywords: string[]): boolean {
  const cuerpo = normalizar(text)
  return keywords.some((k) => k.trim() !== '' && cuerpo.includes(normalizar(k)))
}

/** Hora local en la zona indicada, como minutos desde medianoche, y día de la semana (0 = domingo). */
function horaLocal(tz: string, now: Date): { minutos: number; dia: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
  const partes = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const dias: Record<string, string> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' }
  const hora = Number(partes.hour === '24' ? '0' : partes.hour)
  return { minutos: hora * 60 + Number(partes.minute), dia: dias[partes.weekday] ?? '0' }
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function isWithinHours(hours: BusinessHours, now: Date): boolean {
  if (!hours?.enabled) return true
  const { minutos, dia } = horaLocal(hours.tz || 'UTC', now)
  const franjas = hours.days?.[dia] ?? []
  return franjas.some(([desde, hasta]) => minutos >= aMinutos(desde) && minutos < aMinutos(hasta))
}

export function decideBotAction(input: {
  config: BotConfig
  contact: Contact
  isNewContact: boolean
  message: InboundMessage
  now: Date
}): BotDecision {
  const { config, contact, isNewContact, message, now } = input

  if (!config.bot_enabled) return { action: 'silent', reason: 'bot_apagado', needsAttention: false }
  if (contact.bot_paused) return { action: 'silent', reason: 'chat_pausado', needsAttention: false }

  if (matchEscalation(message.body, config.escalation_keywords)) {
    return { action: 'silent', reason: 'escalado', needsAttention: true }
  }

  if (!isWithinHours(config.business_hours, now)) {
    return { action: 'canned', text: config.out_of_hours_message }
  }

  if (message.type !== 'text' || message.body.trim() === '') {
    return { action: 'canned', text: TEXTO_SOLO_TEXTO }
  }

  return { action: 'ai', welcome: isNewContact ? config.welcome_message || null : null }
}
