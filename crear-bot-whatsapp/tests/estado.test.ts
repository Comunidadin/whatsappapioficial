import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { leerEstado, guardarEstado, marcarHecho, estaHecho } from '../src/estado.js'

let carpeta: string

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'crear-bot-'))
})

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

describe('estado', () => {
  it('sin archivo devuelve un estado vacío', async () => {
    const e = await leerEstado(carpeta)
    expect(e.hechos).toEqual([])
    expect(e.datos).toEqual({})
  })

  it('guarda y vuelve a leer', async () => {
    await guardarEstado(carpeta, marcarHecho(await leerEstado(carpeta), 'tablas'))
    const e = await leerEstado(carpeta)
    expect(estaHecho(e, 'tablas')).toBe(true)
    expect(estaHecho(e, 'vercel')).toBe(false)
  })

  it('marcar dos veces el mismo paso no lo duplica', () => {
    const e = marcarHecho(marcarHecho({ version: 1, hechos: [], datos: {} }, 'tablas'), 'tablas')
    expect(e.hechos).toEqual(['tablas'])
  })

  it('guarda datos no secretos junto al paso', async () => {
    const e = marcarHecho({ version: 1, hechos: [], datos: {} }, 'vercel', {
      urlPanel: 'https://x.vercel.app',
    })
    await guardarEstado(carpeta, e)
    expect((await leerEstado(carpeta)).datos.urlPanel).toBe('https://x.vercel.app')
  })

  it('se niega a guardar credenciales', async () => {
    const e = marcarHecho({ version: 1, hechos: [], datos: {} }, 'tablas', {
      metaToken: 'EAAG...',
    })
    await expect(guardarEstado(carpeta, e)).rejects.toThrow(/credencial/i)
  })

  it('un archivo corrupto no rompe: se empieza de cero', async () => {
    await writeFile(join(carpeta, '.crear-bot.json'), '{esto no es json')
    expect((await leerEstado(carpeta)).hechos).toEqual([])
  })

  it('el archivo guardado es legible por una persona', async () => {
    await guardarEstado(carpeta, marcarHecho(await leerEstado(carpeta), 'tablas'))
    const crudo = await readFile(join(carpeta, '.crear-bot.json'), 'utf8')
    expect(crudo).toContain('\n')
  })
})
