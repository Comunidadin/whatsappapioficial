import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  revisarToken, listarNumeros, registrarNumero, estadoNumero,
  conectarAppAlWaba, configurarWebhook,
} from '../src/api/meta.js'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const json = (cuerpo: unknown, ok = true, status = 200) => ({
  ok, status, text: async () => JSON.stringify(cuerpo),
})

describe('revisarToken', () => {
  it('detecta un token válido con activos', async () => {
    fetchMock.mockResolvedValue(json({
      data: {
        is_valid: true,
        granular_scopes: [{ scope: 'whatsapp_business_messaging', target_ids: ['132'] }],
      },
    }))
    expect(await revisarToken('EAAG')).toEqual({ valido: true, tieneActivos: true })
  })

  it('detecta el token sin activos asignados', async () => {
    fetchMock.mockResolvedValue(json({
      data: { is_valid: true, granular_scopes: [{ scope: 'whatsapp_business_messaging' }] },
    }))
    const r = await revisarToken('EAAG')
    expect(r).toMatchObject({ valido: true, tieneActivos: false })
    expect(r.motivo).toContain('TOKEN NUEVO')
  })

  it('detecta un token inválido', async () => {
    fetchMock.mockResolvedValue(json({ data: { is_valid: false } }))
    expect(await revisarToken('malo')).toMatchObject({ valido: false })
  })
})

describe('listarNumeros', () => {
  it('devuelve los números del WABA', async () => {
    fetchMock.mockResolvedValue(json({
      data: [{
        id: '117', display_phone_number: '+593 96 884 4837',
        verified_name: 'Joffre', status: 'CONNECTED', platform_type: 'CLOUD_API',
      }],
    }))
    expect(await listarNumeros('EAAG', '132')).toEqual([
      { id: '117', numero: '+593 96 884 4837', nombre: 'Joffre', estado: 'CONNECTED', plataforma: 'CLOUD_API' },
    ])
  })

  it('lanza con el mensaje de Meta si falla', async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'Object does not exist' } }, false, 400))
    await expect(listarNumeros('EAAG', '132')).rejects.toThrow('Object does not exist')
  })
})

describe('estadoNumero y registrarNumero', () => {
  it('lee el estado del número', async () => {
    fetchMock.mockResolvedValue(json({
      id: '117', display_phone_number: '+593', verified_name: 'J',
      status: 'PENDING', platform_type: 'NOT_APPLICABLE',
    }))
    expect((await estadoNumero('EAAG', '117')).estado).toBe('PENDING')
  })

  it('registra el número con el PIN', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    await registrarNumero('EAAG', '117', '452817')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/117/register')
    expect(JSON.parse(init.body)).toEqual({ messaging_product: 'whatsapp', pin: '452817' })
  })

  it('no falla si el número ya estaba registrado', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { message: 'Phone number already registered', code: 133005 } }, false, 400),
    )
    await expect(registrarNumero('EAAG', '117', '452817')).resolves.toBeUndefined()
  })
})

describe('conectarAppAlWaba', () => {
  it('hace POST a subscribed_apps', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    await conectarAppAlWaba('EAAG', '132')
    expect(fetchMock.mock.calls[0][0]).toContain('/132/subscribed_apps')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})

describe('configurarWebhook', () => {
  it('usa el token de app y suscribe el campo messages', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    await configurarWebhook({
      appId: '225', appSecret: 'sec', url: 'https://x.vercel.app/api/whatsapp/webhook',
      verifyToken: 'tok-123',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/225/subscriptions')
    const cuerpo = JSON.parse(init.body)
    expect(cuerpo.object).toBe('whatsapp_business_account')
    expect(cuerpo.fields).toContain('messages')
    expect(cuerpo.callback_url).toBe('https://x.vercel.app/api/whatsapp/webhook')
    expect(cuerpo.verify_token).toBe('tok-123')
    expect(cuerpo.access_token).toBe('225|sec')
  })

  it('explica el fallo de verificación en lugar de soltar el error crudo', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { message: "The URL couldn't be validated" } }, false, 400),
    )
    await expect(
      configurarWebhook({ appId: '225', appSecret: 'sec', url: 'https://x', verifyToken: 't' }),
    ).rejects.toThrow(/verificar/i)
  })
})
