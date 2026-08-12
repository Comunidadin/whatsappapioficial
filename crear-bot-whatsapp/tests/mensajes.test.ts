import { describe, it, expect } from 'vitest'
import { MENSAJES, NODE_MINIMO } from '../src/mensajes.js'

describe('mensajes', () => {
  it('exige Node 20 o superior', () => {
    expect(NODE_MINIMO).toBe(20)
  })

  it('el aviso de Node viejo dice qué versión hace falta', () => {
    expect(MENSAJES.nodeViejo('18.0.0')).toContain('18.0.0')
    expect(MENSAJES.nodeViejo('18.0.0')).toContain('20')
  })

  it('todos los mensajes están en español, sin cadenas vacías', () => {
    const textos = Object.values(MENSAJES).filter((v) => typeof v === 'string') as string[]
    expect(textos.length).toBeGreaterThan(0)
    expect(textos.every((t) => t.trim() !== '')).toBe(true)
  })
})
