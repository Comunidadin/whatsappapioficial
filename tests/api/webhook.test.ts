import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

vi.mock('@/lib/db/config', () => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}))
vi.mock('@/lib/bot/handle-inbound', () => ({ handleInbound: vi.fn() }))
vi.mock('@/lib/db/messages', () => ({ updateMessageStatus: vi.fn() }))
vi.mock('@/lib/db/events', () => ({ logWebhookEvent: vi.fn() }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { void fn() } }))

import { getConfig } from '@/lib/db/config'
import { handleInbound } from '@/lib/bot/handle-inbound'
import { updateMessageStatus } from '@/lib/db/messages'
import { GET, POST } from '@/app/api/whatsapp/webhook/route'

const config = { verify_token: 'mi-token-secreto' }

describe('GET /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockResolvedValue(config as never)
  })

  it('devuelve el challenge cuando el verify token coincide', async () => {
    const url = 'https://x.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=mi-token-secreto&hub.challenge=12345'
    const res = await GET(new Request(url))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('12345')
  })

  it('rechaza con 403 si el verify token no coincide', async () => {
    const url = 'https://x.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=12345'
    const res = await GET(new Request(url))
    expect(res.status).toBe(403)
  })

  it('rechaza con 403 si el verify token está vacío en la config', async () => {
    vi.mocked(getConfig).mockResolvedValue({ verify_token: '' } as never)
    const url = 'https://x.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=12345'
    const res = await GET(new Request(url))
    expect(res.status).toBe(403)
  })
})

const appSecret = 'secreto'

function pedido(payload: unknown, firmar = true) {
  const body = JSON.stringify(payload)
  const firma = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex')
  return new Request('https://x.com/api/whatsapp/webhook', {
    method: 'POST',
    headers: firmar ? { 'x-hub-signature-256': firma } : {},
    body,
  })
}

const payloadMensaje = {
  entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: 'Ana' }, wa_id: '593987654321' }],
    messages: [{ from: '593987654321', id: 'wamid.AAA', type: 'text', text: { body: 'hola' } }],
  } }] }],
}

const payloadEstado = {
  entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.OUT', status: 'read' }] } }] }],
}

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConfig).mockResolvedValue({ meta_app_secret: appSecret } as never)
  })

  it('acepta un mensaje firmado y lo pasa al orquestador', async () => {
    const res = await POST(pedido(payloadMensaje))
    expect(res.status).toBe(200)
    expect(handleInbound).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: 'wamid.AAA', from: '593987654321', body: 'hola' }),
    )
  })

  it('rechaza con 401 si la firma no es válida', async () => {
    const res = await POST(pedido(payloadMensaje, false))
    expect(res.status).toBe(401)
    expect(handleInbound).not.toHaveBeenCalled()
  })

  it('actualiza los estados de entrega', async () => {
    const res = await POST(pedido(payloadEstado))
    expect(res.status).toBe(200)
    expect(updateMessageStatus).toHaveBeenCalledWith({ waMessageId: 'wamid.OUT', status: 'read', error: null })
  })

  it('devuelve 200 aunque el payload sea desconocido', async () => {
    const res = await POST(pedido({ hola: 'mundo' }))
    expect(res.status).toBe(200)
  })
})
