import { describe, it, expect, vi } from 'vitest'
import { elegirNumero, generarVerifyToken } from '../src/preguntas.js'
import type { Numero } from '../src/api/meta.js'

const uno: Numero = { id: '1', numero: '+593 1', nombre: 'A', estado: 'CONNECTED', plataforma: 'CLOUD_API' }
const dos: Numero = { id: '2', numero: '+593 2', nombre: 'B', estado: 'PENDING', plataforma: 'NOT_APPLICABLE' }

describe('elegirNumero', () => {
  it('con un solo número no pregunta nada', async () => {
    const preguntar = vi.fn()
    expect(await elegirNumero([uno], preguntar)).toEqual(uno)
    expect(preguntar).not.toHaveBeenCalled()
  })

  it('con varios pregunta y devuelve el elegido', async () => {
    const preguntar = vi.fn(async () => '2')
    expect(await elegirNumero([uno, dos], preguntar)).toEqual(dos)
    const opciones = preguntar.mock.calls[0][0] as { valor: string; etiqueta: string }[]
    expect(opciones).toHaveLength(2)
    expect(opciones[1].etiqueta).toContain('+593 2')
  })

  it('lanza si el WABA no tiene números', async () => {
    await expect(elegirNumero([], vi.fn())).rejects.toThrow(/ningún número/i)
  })
})

describe('generarVerifyToken', () => {
  it('genera tokens largos y distintos cada vez', () => {
    const a = generarVerifyToken()
    const b = generarVerifyToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(16)
    expect(a).toMatch(/^[a-z0-9-]+$/)
  })
})
