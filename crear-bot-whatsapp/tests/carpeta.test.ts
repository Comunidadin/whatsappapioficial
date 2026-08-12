import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carpetaOcupada } from '../src/plantilla.js'

let carpeta: string

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'carpeta-'))
})

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

describe('carpetaOcupada', () => {
  it('una carpeta vacía está libre', async () => {
    expect(await carpetaOcupada(carpeta)).toBe(false)
  })

  it('una carpeta con archivos sueltos sigue estando libre', async () => {
    await writeFile(join(carpeta, 'notas.txt'), 'hola')
    expect(await carpetaOcupada(carpeta)).toBe(false)
  })

  it('detecta un proyecto ya instalado por su package.json', async () => {
    await writeFile(join(carpeta, 'package.json'), '{}')
    expect(await carpetaOcupada(carpeta)).toBe(true)
  })

  it('detecta un proyecto ya instalado por su carpeta src', async () => {
    await mkdir(join(carpeta, 'src'))
    expect(await carpetaOcupada(carpeta)).toBe(true)
  })
})
