import { describe, it, expect } from 'vitest'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { RAIZ_PLANTILLA } from '../src/plantilla.js'

describe('la plantilla incluida en el paquete', () => {
  it('trae el proyecto del panel', async () => {
    const nombres = await readdir(RAIZ_PLANTILLA)
    expect(nombres).toContain('package.json')
    expect(nombres).toContain('src')
    expect(nombres).toContain('supabase')
  })

  it('trae la migración que crea las tablas', async () => {
    const sql = await readFile(join(RAIZ_PLANTILLA, 'supabase/migrations/0001_init.sql'), 'utf8')
    expect(sql).toContain('create table if not exists config')
    expect(sql).toContain('create table if not exists messages')
  })

  it('no lleva credenciales ni dependencias instaladas', async () => {
    const nombres = await readdir(RAIZ_PLANTILLA)
    expect(nombres.some((n) => n.startsWith('.env') && n !== '.env.example')).toBe(false)
    expect(nombres).not.toContain('node_modules')
    expect(nombres).not.toContain('.vercel')
  })

  it('el .gitignore de la plantilla protege el .env.local', async () => {
    const ignore = await readFile(join(RAIZ_PLANTILLA, '.gitignore'), 'utf8')
    expect(ignore).toContain('.env')
  })

  it('no se cuela a sí mismo dentro de la plantilla', async () => {
    await expect(stat(join(RAIZ_PLANTILLA, 'crear-bot-whatsapp'))).rejects.toThrow()
  })
})
