import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } }
  },
}))

import { generateReply } from '@/lib/bot/openai'

const messages = [{ role: 'user' as const, content: 'hola' }]

function respuesta(texto: string) {
  return { choices: [{ message: { content: texto } }] }
}

describe('generateReply', () => {
  beforeEach(() => {
    create.mockReset()
    process.env.OPENAI_API_KEY = 'sk-test'
  })

  it('devuelve el texto de la respuesta', async () => {
    create.mockResolvedValue(respuesta('¡Hola! ¿En qué te ayudo?'))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' }))
      .resolves.toBe('¡Hola! ¿En qué te ayudo?')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('pasa el modelo configurado', async () => {
    create.mockResolvedValue(respuesta('ok'))
    await generateReply(messages, { model: 'mi-modelo' })
    expect(create.mock.calls[0][0].model).toBe('mi-modelo')
  })

  it('reintenta una vez si la primera llamada falla', async () => {
    create.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(respuesta('listo'))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' })).resolves.toBe('listo')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('lanza si falla dos veces', async () => {
    create.mockRejectedValue(new Error('caído'))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' })).rejects.toThrow('caído')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('lanza si la respuesta viene vacía', async () => {
    create.mockResolvedValue(respuesta('   '))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' }))
      .rejects.toThrow('respuesta vacía')
  })
})
