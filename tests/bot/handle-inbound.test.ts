import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/config', () => ({ getConfig: vi.fn(), updateConfig: vi.fn() }))
vi.mock('@/lib/db/contacts', () => ({ upsertContact: vi.fn(), setContactFlags: vi.fn(), listContacts: vi.fn() }))
vi.mock('@/lib/db/messages', () => ({
  insertInboundMessage: vi.fn(), insertOutboundMessage: vi.fn(),
  getRecentMessages: vi.fn(), updateMessageStatus: vi.fn(),
}))
vi.mock('@/lib/db/events', () => ({ logWebhookEvent: vi.fn(), getLastWebhookEvents: vi.fn() }))
vi.mock('@/lib/bot/openai', () => ({ generateReply: vi.fn() }))
vi.mock('@/lib/whatsapp/send', () => ({ sendWhatsAppText: vi.fn(), fetchPhoneNumberInfo: vi.fn() }))

import { getConfig } from '@/lib/db/config'
import { upsertContact, setContactFlags } from '@/lib/db/contacts'
import { insertInboundMessage, insertOutboundMessage, getRecentMessages } from '@/lib/db/messages'
import { generateReply } from '@/lib/bot/openai'
import { sendWhatsAppText } from '@/lib/whatsapp/send'
import { handleInbound } from '@/lib/bot/handle-inbound'
import type { InboundMessage } from '@/lib/whatsapp/parse'

const config = {
  phone_number_id: '222', waba_id: '1', meta_token: 'tok', meta_app_secret: 's', verify_token: 'v',
  bot_enabled: true, bot_role: 'ventas', system_prompt: 'Eres un asesor.',
  welcome_message: '¡Hola! Soy el asistente.',
  business_hours: { enabled: false, tz: 'America/Guayaquil', days: {} },
  out_of_hours_message: 'Fuera de horario.', escalation_keywords: ['asesor'],
  openai_model: 'gpt-4o-mini', updated_at: '',
}

const contact = {
  id: 'c1', wa_id: '593987654321', profile_name: 'Ana', status: 'en_conversacion',
  bot_paused: false, needs_attention: false, last_message_at: '', created_at: '',
}

const mensaje: InboundMessage = {
  waMessageId: 'wamid.1', from: '593987654321', profileName: 'Ana',
  type: 'text', body: '¿Cuánto cuesta?',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getConfig).mockResolvedValue(config as never)
  vi.mocked(upsertContact).mockResolvedValue({ contact, isNew: false } as never)
  vi.mocked(insertInboundMessage).mockResolvedValue({ inserted: true })
  vi.mocked(getRecentMessages).mockResolvedValue([])
  vi.mocked(insertOutboundMessage).mockResolvedValue('m1')
  vi.mocked(generateReply).mockResolvedValue('Cuesta 100 dólares.')
  vi.mocked(sendWhatsAppText).mockResolvedValue({ waMessageId: 'wamid.out' })
})

describe('handleInbound', () => {
  it('responde con IA y guarda el mensaje saliente', async () => {
    await handleInbound(mensaje)

    expect(generateReply).toHaveBeenCalledTimes(1)
    expect(sendWhatsAppText).toHaveBeenCalledWith({
      phoneNumberId: '222', token: 'tok', to: '593987654321', text: 'Cuesta 100 dólares.',
    })
    expect(insertOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'c1', body: 'Cuesta 100 dólares.', sender: 'bot', waMessageId: 'wamid.out' }),
    )
  })

  it('no hace nada si el mensaje ya estaba guardado (reintento de Meta)', async () => {
    vi.mocked(insertInboundMessage).mockResolvedValue({ inserted: false })
    await handleInbound(mensaje)
    expect(generateReply).not.toHaveBeenCalled()
    expect(sendWhatsAppText).not.toHaveBeenCalled()
  })

  it('envía la bienvenida antes de la respuesta cuando el contacto es nuevo', async () => {
    vi.mocked(upsertContact).mockResolvedValue({ contact, isNew: true } as never)
    await handleInbound(mensaje)
    expect(vi.mocked(sendWhatsAppText).mock.calls.map((c) => c[0].text))
      .toEqual(['¡Hola! Soy el asistente.', 'Cuesta 100 dólares.'])
  })

  it('envía el mensaje predefinido sin llamar a OpenAI cuando la decisión es canned', async () => {
    vi.mocked(getConfig).mockResolvedValue({
      ...config,
      business_hours: { enabled: true, tz: 'America/Guayaquil', days: {} },
    } as never)
    await handleInbound(mensaje)
    expect(generateReply).not.toHaveBeenCalled()
    expect(vi.mocked(sendWhatsAppText).mock.calls[0][0].text).toBe('Fuera de horario.')
  })

  it('calla y marca atención ante una palabra clave', async () => {
    await handleInbound({ ...mensaje, body: 'quiero un asesor' })
    expect(sendWhatsAppText).not.toHaveBeenCalled()
    expect(setContactFlags).toHaveBeenCalledWith('c1', { needs_attention: true })
  })

  it('marca atención y no envía nada si OpenAI falla', async () => {
    vi.mocked(generateReply).mockRejectedValue(new Error('caído'))
    await handleInbound(mensaje)
    expect(sendWhatsAppText).not.toHaveBeenCalled()
    expect(setContactFlags).toHaveBeenCalledWith('c1', { needs_attention: true })
  })

  it('guarda el mensaje como fallido si Meta rechaza el envío', async () => {
    vi.mocked(sendWhatsAppText).mockRejectedValue(new Error('Meta rechazó el envío: token inválido'))
    await handleInbound(mensaje)
    expect(insertOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: expect.stringContaining('token inválido') }),
    )
    expect(setContactFlags).toHaveBeenCalledWith('c1', { needs_attention: true })
  })

  it('no lanza aunque falle todo', async () => {
    vi.mocked(getConfig).mockRejectedValue(new Error('sin base de datos'))
    await expect(handleInbound(mensaje)).resolves.toBeUndefined()
  })
})
