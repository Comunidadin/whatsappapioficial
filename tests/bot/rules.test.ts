import { describe, it, expect } from 'vitest'
import { decideBotAction, isWithinHours, matchEscalation } from '@/lib/bot/rules'
import type { BotConfig, Contact } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'

const config: BotConfig = {
  phone_number_id: '1', waba_id: '1', meta_token: 't', meta_app_secret: 's', verify_token: 'v',
  bot_enabled: true, bot_role: 'ventas', system_prompt: 'Eres un asesor.',
  welcome_message: '¡Hola! Soy el asistente.',
  business_hours: { enabled: false, tz: 'America/Guayaquil', days: {} },
  out_of_hours_message: 'Estamos fuera de horario, te respondemos mañana.',
  escalation_keywords: ['asesor', 'humano'],
  openai_model: 'gpt-4o-mini', updated_at: '',
}

const contact: Contact = {
  id: 'c1', wa_id: '593987654321', profile_name: 'Ana', status: 'en_conversacion',
  bot_paused: false, needs_attention: false, last_message_at: '', created_at: '',
}

const mensaje: InboundMessage = {
  waMessageId: 'wamid.1', from: '593987654321', profileName: 'Ana',
  type: 'text', body: '¿Cuánto cuesta?',
}

const ahora = new Date('2026-08-12T15:00:00Z') // 10:00 en Guayaquil (UTC-5)
const base = { config, contact, isNewContact: false, message: mensaje, now: ahora }

describe('matchEscalation', () => {
  it('detecta la palabra clave sin importar mayúsculas ni tildes del texto', () => {
    expect(matchEscalation('Quiero hablar con un ASESOR', ['asesor'])).toBe(true)
  })
  it('no detecta si no aparece', () => {
    expect(matchEscalation('¿cuánto cuesta?', ['asesor', 'humano'])).toBe(false)
  })
  it('ignora una lista vacía', () => {
    expect(matchEscalation('asesor', [])).toBe(false)
  })
})

describe('isWithinHours', () => {
  const horario = {
    enabled: true, tz: 'America/Guayaquil',
    days: { '3': [['09:00', '18:00']] as [string, string][] }, // miércoles
  }
  it('acepta dentro de la franja', () => {
    expect(isWithinHours(horario, new Date('2026-08-12T15:00:00Z'))).toBe(true)
  })
  it('rechaza fuera de la franja', () => {
    expect(isWithinHours(horario, new Date('2026-08-12T04:00:00Z'))).toBe(false)
  })
  it('rechaza un día sin franjas', () => {
    expect(isWithinHours(horario, new Date('2026-08-16T15:00:00Z'))).toBe(false)
  })
  it('siempre acepta si el horario está desactivado', () => {
    expect(isWithinHours({ enabled: false, tz: 'America/Guayaquil', days: {} }, ahora)).toBe(true)
  })
})

describe('decideBotAction', () => {
  it('responde con IA en el caso normal', () => {
    expect(decideBotAction(base)).toEqual({ action: 'ai', welcome: null })
  })

  it('incluye la bienvenida si el contacto es nuevo', () => {
    expect(decideBotAction({ ...base, isNewContact: true }))
      .toEqual({ action: 'ai', welcome: '¡Hola! Soy el asistente.' })
  })

  it('calla si el bot global está apagado', () => {
    const d = decideBotAction({ ...base, config: { ...config, bot_enabled: false } })
    expect(d).toEqual({ action: 'silent', reason: 'bot_apagado', needsAttention: false })
  })

  it('calla si el chat está pausado', () => {
    const d = decideBotAction({ ...base, contact: { ...contact, bot_paused: true } })
    expect(d).toEqual({ action: 'silent', reason: 'chat_pausado', needsAttention: false })
  })

  it('calla y marca atención ante una palabra clave de escalamiento', () => {
    const d = decideBotAction({ ...base, message: { ...mensaje, body: 'quiero un asesor' } })
    expect(d).toEqual({ action: 'silent', reason: 'escalado', needsAttention: true })
  })

  it('manda el mensaje fuera de horario', () => {
    const config2 = {
      ...config,
      business_hours: { enabled: true, tz: 'America/Guayaquil', days: { '3': [['09:00', '10:00']] as [string, string][] } },
    }
    const d = decideBotAction({ ...base, config: config2, now: new Date('2026-08-12T20:00:00Z') })
    expect(d).toEqual({ action: 'canned', text: 'Estamos fuera de horario, te respondemos mañana.' })
  })

  it('pide texto ante un audio', () => {
    const d = decideBotAction({ ...base, message: { ...mensaje, type: 'audio', body: '' } })
    expect(d).toEqual({
      action: 'canned',
      text: 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?',
    })
  })

  it('el escalamiento gana sobre el fuera de horario', () => {
    const config2 = {
      ...config,
      business_hours: { enabled: true, tz: 'America/Guayaquil', days: {} },
    }
    const d = decideBotAction({ ...base, config: config2, message: { ...mensaje, body: 'un humano por favor' } })
    expect(d).toEqual({ action: 'silent', reason: 'escalado', needsAttention: true })
  })
})
