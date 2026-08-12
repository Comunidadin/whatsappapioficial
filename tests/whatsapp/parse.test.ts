import { describe, it, expect } from 'vitest'
import { parseWebhook } from '@/lib/whatsapp/parse'

const mensajeTexto = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '111',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '593999', phone_number_id: '222' },
        contacts: [{ profile: { name: 'Ana' }, wa_id: '593987654321' }],
        messages: [{ from: '593987654321', id: 'wamid.AAA', timestamp: '1754000000', type: 'text', text: { body: 'Hola, ¿cuánto cuesta?' } }],
      },
    }],
  }],
}

const mensajeAudio = {
  object: 'whatsapp_business_account',
  entry: [{ id: '111', changes: [{ field: 'messages', value: {
    contacts: [{ profile: { name: 'Luis' }, wa_id: '593911111111' }],
    messages: [{ from: '593911111111', id: 'wamid.BBB', timestamp: '1754000001', type: 'audio', audio: { id: 'media-1' } }],
  } }] }],
}

const estado = {
  object: 'whatsapp_business_account',
  entry: [{ id: '111', changes: [{ field: 'messages', value: {
    statuses: [{ id: 'wamid.CCC', status: 'delivered', timestamp: '1754000002', recipient_id: '593987654321' }],
  } }] }],
}

const estadoFallido = {
  object: 'whatsapp_business_account',
  entry: [{ id: '111', changes: [{ field: 'messages', value: {
    statuses: [{ id: 'wamid.DDD', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] }],
  } }] }],
}

describe('parseWebhook', () => {
  it('extrae un mensaje de texto', () => {
    const r = parseWebhook(mensajeTexto)
    expect(r.messages).toEqual([{
      waMessageId: 'wamid.AAA', from: '593987654321', profileName: 'Ana',
      type: 'text', body: 'Hola, ¿cuánto cuesta?',
    }])
    expect(r.statuses).toEqual([])
  })

  it('marca los audios como tipo audio con cuerpo vacío', () => {
    const r = parseWebhook(mensajeAudio)
    expect(r.messages[0].type).toBe('audio')
    expect(r.messages[0].body).toBe('')
  })

  it('extrae actualizaciones de estado', () => {
    expect(parseWebhook(estado).statuses).toEqual([
      { waMessageId: 'wamid.CCC', status: 'delivered', error: null },
    ])
  })

  it('incluye el error en los estados fallidos', () => {
    const s = parseWebhook(estadoFallido).statuses[0]
    expect(s.status).toBe('failed')
    expect(s.error).toContain('131047')
  })

  it('devuelve listas vacías ante un payload desconocido', () => {
    expect(parseWebhook({ hola: 'mundo' })).toEqual({ messages: [], statuses: [] })
    expect(parseWebhook(null)).toEqual({ messages: [], statuses: [] })
  })
})
