import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/config', () => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}))

import { getConfig } from '@/lib/db/config'
import { GET } from '@/app/api/whatsapp/webhook/route'

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
