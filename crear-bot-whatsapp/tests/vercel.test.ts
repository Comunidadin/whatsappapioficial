import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/ejecutar.js', () => ({ ejecutar: vi.fn() }))

import { ejecutar } from '../src/ejecutar.js'
import { estaLogueado, cargarVariables, desplegar } from '../src/api/vercel.js'

beforeEach(() => vi.mocked(ejecutar).mockReset())

describe('estaLogueado', () => {
  it('es verdadero si whoami responde un usuario', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: 'joffre\n' })
    expect(await estaLogueado()).toBe(true)
  })

  it('es falso si whoami falla', async () => {
    vi.mocked(ejecutar).mockImplementation(() => Promise.reject(new Error('not authenticated')))
    expect(await estaLogueado()).toBe(false)
  })
})

describe('cargarVariables', () => {
  it('añade cada variable a producción', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: '' })
    await cargarVariables('/tmp/x', { UNA: '1', OTRA: '2' })
    expect(vi.mocked(ejecutar)).toHaveBeenCalledTimes(2)
    const orden = vi.mocked(ejecutar).mock.calls[0][1].join(' ')
    expect(orden).toContain('env')
    expect(orden).toContain('add')
    expect(orden).toContain('production')
  })

  it('no filtra el valor de la variable a la línea de comandos sin comillas', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: '' })
    await cargarVariables('/tmp/x', { CLAVE: 'valor con espacios y "comillas"' })
    const orden = vi.mocked(ejecutar).mock.calls[0][1].join(' ')
    expect(orden).not.toContain('valor con espacios y "comillas"')
  })
})

describe('desplegar', () => {
  it('saca la URL de producción de la salida', async () => {
    vi.mocked(ejecutar).mockResolvedValue({
      salida: 'Building...\nhttps://mi-bot-abc123.vercel.app\nDeployed',
    })
    expect(await desplegar('/tmp/x')).toEqual({ url: 'https://mi-bot-abc123.vercel.app' })
  })

  it('lanza un error claro si no aparece ninguna URL', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: 'algo salió mal' })
    await expect(desplegar('/tmp/x')).rejects.toThrow(/no devolvió ninguna URL/i)
  })
})
