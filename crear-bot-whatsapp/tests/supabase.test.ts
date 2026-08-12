import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ejecutarSql, comprobarSecretKey, guardarConfig } from '../src/api/supabase.js'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const resp = (cuerpo: unknown, ok = true, status = 200) => ({
  ok, status, text: async () => JSON.stringify(cuerpo),
})

describe('ejecutarSql', () => {
  it('manda el SQL a la Management API con el token personal', async () => {
    fetchMock.mockResolvedValue(resp([]))
    await ejecutarSql('sbp_123', 'abcdef', 'create table x ();')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.supabase.com/v1/projects/abcdef/database/query')
    expect(init.headers.Authorization).toBe('Bearer sbp_123')
    expect(JSON.parse(init.body).query).toContain('create table x ()')
  })

  it('lanza con el error de Postgres', async () => {
    fetchMock.mockResolvedValue(resp({ message: 'syntax error at or near "crate"' }, false, 400))
    await expect(ejecutarSql('sbp_123', 'abcdef', 'crate table')).rejects.toThrow('syntax error')
  })
})

describe('comprobarSecretKey', () => {
  it('acepta una clave que responde', async () => {
    fetchMock.mockResolvedValue(resp([]))
    expect(await comprobarSecretKey('https://abc.supabase.co', 'sb_secret_x')).toEqual({ ok: true })
  })

  it('acepta la clave aunque las tablas aún no existan', async () => {
    fetchMock.mockResolvedValue(resp({ code: 'PGRST205' }, false, 404))
    expect(await comprobarSecretKey('https://abc.supabase.co', 'sb_secret_x')).toEqual({ ok: true })
  })

  it('rechaza una clave que da 401', async () => {
    fetchMock.mockResolvedValue(resp({ message: 'Invalid API key' }, false, 401))
    const r = await comprobarSecretKey('https://abc.supabase.co', 'sb_secret_x')
    expect(r.ok).toBe(false)
  })
})

describe('guardarConfig', () => {
  it('hace PATCH sobre la única fila de config', async () => {
    fetchMock.mockResolvedValue(resp({}, true, 204))
    await guardarConfig('https://abc.supabase.co', 'sb_secret_x', { verify_token: 'tok' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://abc.supabase.co/rest/v1/config?id=eq.true')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ verify_token: 'tok' })
  })
})
