import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('../src/plantilla.js', () => ({
  RAIZ_PLANTILLA: '/plantilla',
  copiarPlantilla: vi.fn(), escribirEnv: vi.fn(), instalarDependencias: vi.fn(),
}))
vi.mock('../src/api/supabase.js', () => ({
  ejecutarSql: vi.fn(), guardarConfig: vi.fn(), comprobarSecretKey: vi.fn(),
}))
vi.mock('../src/api/meta.js', () => ({
  estadoNumero: vi.fn(), registrarNumero: vi.fn(),
  conectarAppAlWaba: vi.fn(), configurarWebhook: vi.fn(),
}))
vi.mock('../src/api/vercel.js', () => ({
  estaLogueado: vi.fn(), iniciarSesion: vi.fn(),
  enlazarProyecto: vi.fn(), cargarVariables: vi.fn(), desplegar: vi.fn(),
}))
// Solo se finge la lectura del SQL (la plantilla no existe en los tests).
// El resto pasa al fs de verdad, porque el estado de reanudación se guarda ahí.
vi.mock('node:fs/promises', async (original) => {
  const real = await original<typeof import('node:fs/promises')>()
  return {
    ...real,
    default: real,
    readFile: vi.fn(async (ruta: unknown, ...resto: unknown[]) =>
      String(ruta).endsWith('.sql')
        ? 'create table if not exists config ();'
        : (real.readFile as (...a: never[]) => Promise<string>)(
            ...([ruta, ...resto] as never[]),
          ),
    ),
  }
})

import { copiarPlantilla, instalarDependencias } from '../src/plantilla.js'
import { ejecutarSql, guardarConfig } from '../src/api/supabase.js'
import { estadoNumero, registrarNumero, conectarAppAlWaba, configurarWebhook } from '../src/api/meta.js'
import { estaLogueado, iniciarSesion, desplegar, cargarVariables } from '../src/api/vercel.js'
import { ejecutarPasos } from '../src/pasos.js'

const datos = {
  carpeta: '', nombreProyecto: 'mi-bot',
  supabaseUrl: 'https://abcdef.supabase.co',
  publishableKey: 'sb_publishable_x', secretKey: 'sb_secret_x', pat: 'sbp_x',
  openaiKey: 'sk-x', appId: '225', appSecret: 'sec', metaToken: 'EAAG',
  wabaId: '132', numeroId: '117', pin: '452817', verifyToken: 'tok-abc',
}

const conectado = {
  id: '117', numero: '+593 96 884 4837', nombre: 'J',
  estado: 'CONNECTED', plataforma: 'CLOUD_API',
}

beforeEach(async () => {
  vi.clearAllMocks()
  datos.carpeta = await mkdtemp(join(tmpdir(), 'pasos-'))
  vi.mocked(estadoNumero).mockResolvedValue(conectado)
  vi.mocked(estaLogueado).mockResolvedValue(true)
  vi.mocked(desplegar).mockResolvedValue({ url: 'https://mi-bot.vercel.app' })
  // La comprobación final llama al webhook desplegado y espera el challenge de vuelta.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => 'prueba' })))
})

describe('ejecutarPasos', () => {
  it('devuelve la URL del panel y el enlace de WhatsApp', async () => {
    const r = await ejecutarPasos(datos, () => {})
    expect(r.urlPanel).toBe('https://mi-bot.vercel.app')
    expect(r.enlaceWa).toBe('https://wa.me/593968844837')
  })

  it('respeta el orden: guarda el verify token antes de pedir el webhook', async () => {
    const orden: string[] = []
    vi.mocked(guardarConfig).mockImplementation(async () => { orden.push('config') })
    vi.mocked(configurarWebhook).mockImplementation(async () => { orden.push('webhook') })
    vi.mocked(desplegar).mockImplementation(async () => {
      orden.push('deploy')
      return { url: 'https://x.vercel.app' }
    })

    await ejecutarPasos(datos, () => {})
    expect(orden).toEqual(['deploy', 'config', 'webhook'])
  })

  it('crea las tablas y carga las variables antes de desplegar', async () => {
    const orden: string[] = []
    vi.mocked(ejecutarSql).mockImplementation(async () => { orden.push('sql') })
    vi.mocked(cargarVariables).mockImplementation(async () => { orden.push('vars') })
    vi.mocked(desplegar).mockImplementation(async () => {
      orden.push('deploy')
      return { url: 'https://x.vercel.app' }
    })
    await ejecutarPasos(datos, () => {})
    expect(orden).toEqual(['sql', 'vars', 'deploy'])
  })

  it('registra el número solo si está en PENDING', async () => {
    await ejecutarPasos(datos, () => {})
    expect(registrarNumero).not.toHaveBeenCalled()
  })

  it('registra el número cuando está en PENDING', async () => {
    vi.mocked(estadoNumero).mockResolvedValue({
      id: '117', numero: '+593', nombre: 'J', estado: 'PENDING', plataforma: 'NOT_APPLICABLE',
    })
    await ejecutarPasos(datos, () => {})
    expect(registrarNumero).toHaveBeenCalledWith('EAAG', '117', '452817')
  })

  it('inicia sesión en Vercel si hace falta', async () => {
    vi.mocked(estaLogueado).mockResolvedValue(false)
    await ejecutarPasos(datos, () => {})
    expect(iniciarSesion).toHaveBeenCalled()
  })

  it('conecta la app al WABA', async () => {
    await ejecutarPasos(datos, () => {})
    expect(conectarAppAlWaba).toHaveBeenCalledWith('EAAG', '132')
  })

  it('al repetirse salta lo ya hecho', async () => {
    await ejecutarPasos(datos, () => {})
    vi.clearAllMocks()
    vi.mocked(estadoNumero).mockResolvedValue(conectado)
    vi.mocked(estaLogueado).mockResolvedValue(true)
    vi.mocked(desplegar).mockResolvedValue({ url: 'https://mi-bot.vercel.app' })

    await ejecutarPasos(datos, () => {})
    expect(copiarPlantilla).not.toHaveBeenCalled()
    expect(instalarDependencias).not.toHaveBeenCalled()
    expect(ejecutarSql).not.toHaveBeenCalled()
    expect(desplegar).not.toHaveBeenCalled()
  })

  it('falla si el webhook desplegado no devuelve el challenge', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'error' })))
    await expect(ejecutarPasos(datos, () => {})).rejects.toThrow(/variables de entorno/i)
  })

  it('avisa de cada paso al alumno', async () => {
    const avisos: string[] = []
    await ejecutarPasos(datos, (t) => avisos.push(t))
    expect(avisos.length).toBeGreaterThan(4)
    expect(avisos.join(' ')).toMatch(/tablas/i)
  })
})
