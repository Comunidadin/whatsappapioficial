import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendWhatsAppText, fetchPhoneNumberInfo } from '@/lib/whatsapp/send'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function ok(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}
function fail(status: number, body: unknown) {
  return { ok: false, status, text: async () => JSON.stringify(body) }
}

describe('sendWhatsAppText', () => {
  it('llama a la URL correcta con el token y devuelve el id del mensaje', async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: 'wamid.OUT1' }] }))

    const r = await sendWhatsAppText({
      phoneNumberId: '222', token: 'tok', to: '593987654321', text: 'Hola',
    })

    expect(r).toEqual({ waMessageId: 'wamid.OUT1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v21.0/222/messages')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '593987654321',
      type: 'text',
      text: { preview_url: false, body: 'Hola' },
    })
  })

  it('lanza con el mensaje de error de Meta', async () => {
    fetchMock.mockResolvedValue(fail(400, { error: { message: 'Invalid parameter', code: 100 } }))
    await expect(
      sendWhatsAppText({ phoneNumberId: '222', token: 'tok', to: '1', text: 'x' }),
    ).rejects.toThrow('Invalid parameter')
  })
})

describe('fetchPhoneNumberInfo', () => {
  it('devuelve el número y el nombre verificado', async () => {
    fetchMock.mockResolvedValue(ok({ display_phone_number: '+593 99', verified_name: 'Clases IA' }))
    const r = await fetchPhoneNumberInfo({ phoneNumberId: '222', token: 'tok' })
    expect(r).toEqual({ displayPhoneNumber: '+593 99', verifiedName: 'Clases IA' })
  })

  it('lanza si el token es inválido', async () => {
    fetchMock.mockResolvedValue(fail(401, { error: { message: 'Invalid OAuth access token' } }))
    await expect(fetchPhoneNumberInfo({ phoneNumberId: '222', token: 'malo' }))
      .rejects.toThrow('Invalid OAuth access token')
  })
})
