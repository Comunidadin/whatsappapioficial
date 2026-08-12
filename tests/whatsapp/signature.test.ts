import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifySignature } from '@/lib/whatsapp/signature'

const secret = 'app-secret-de-prueba'
const body = JSON.stringify({ object: 'whatsapp_business_account' })
const firma = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

describe('verifySignature', () => {
  it('acepta una firma correcta', () => {
    expect(verifySignature(body, firma, secret)).toBe(true)
  })

  it('rechaza una firma alterada', () => {
    const mala = firma.slice(0, -1) + (firma.endsWith('a') ? 'b' : 'a')
    expect(verifySignature(body, mala, secret)).toBe(false)
  })

  it('rechaza si el cuerpo cambió', () => {
    expect(verifySignature(body + ' ', firma, secret)).toBe(false)
  })

  it('rechaza si no hay cabecera', () => {
    expect(verifySignature(body, null, secret)).toBe(false)
  })

  it('rechaza si no hay app secret configurado', () => {
    expect(verifySignature(body, firma, '')).toBe(false)
  })
})
