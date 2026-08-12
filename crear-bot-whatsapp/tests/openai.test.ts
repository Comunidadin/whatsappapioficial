import { describe, it, expect, vi, beforeEach } from 'vitest'
import { comprobarKeyOpenai } from '../src/api/openai.js'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const resp = (cuerpo: unknown, ok = true, status = 200) => ({
  ok, status, text: async () => JSON.stringify(cuerpo),
})

describe('comprobarKeyOpenai', () => {
  it('acepta una key que responde', async () => {
    fetchMock.mockResolvedValue(resp({ choices: [{ message: { content: 'ok' } }] }))
    expect(await comprobarKeyOpenai('sk-x')).toEqual({ ok: true })
  })

  it('distingue una key inválida de una sin saldo', async () => {
    fetchMock.mockResolvedValue(resp({ error: { message: 'Incorrect API key' } }, false, 401))
    const invalida = await comprobarKeyOpenai('sk-mala')
    expect(invalida.motivo).toContain('no es válida')

    fetchMock.mockResolvedValue(
      resp({ error: { message: 'You exceeded your current quota' } }, false, 429),
    )
    const sinSaldo = await comprobarKeyOpenai('sk-x')
    expect(sinSaldo.motivo).toContain('saldo')
  })
})
