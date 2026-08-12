import { describe, it, expect } from 'vitest'
import {
  validarUrlSupabase, refDeSupabase, validarSecretKey, validarPublishableKey,
  validarPat, validarPin, nombreDeProyecto,
} from '../src/validar.js'

describe('validarUrlSupabase', () => {
  it('acepta la URL del proyecto', () => {
    expect(validarUrlSupabase('https://nxieepcukyekvcticrqo.supabase.co')).toEqual({ ok: true })
  })

  it('rechaza la URL con /rest/v1 y lo explica', () => {
    const r = validarUrlSupabase('https://nxieepcukyekvcticrqo.supabase.co/rest/v1/')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('/rest/v1')
  })

  it('rechaza cualquier otra cosa', () => {
    expect(validarUrlSupabase('nxieepcukyekvcticrqo').ok).toBe(false)
    expect(validarUrlSupabase('https://google.com').ok).toBe(false)
  })
})

describe('refDeSupabase', () => {
  it('saca el identificador del proyecto', () => {
    expect(refDeSupabase('https://nxieepcukyekvcticrqo.supabase.co')).toBe('nxieepcukyekvcticrqo')
  })
})

describe('validaciones de claves', () => {
  it('distingue secret de publishable', () => {
    expect(validarSecretKey('sb_secret_abc').ok).toBe(true)
    expect(validarSecretKey('sb_publishable_abc').ok).toBe(false)
    expect(validarPublishableKey('sb_publishable_abc').ok).toBe(true)
    expect(validarPublishableKey('sb_secret_abc').ok).toBe(false)
  })

  it('el error de secret menciona el prefijo correcto', () => {
    const r = validarSecretKey('sb_publishable_abc')
    if (!r.ok) expect(r.motivo).toContain('sb_secret_')
  })

  it('el personal access token empieza por sbp_', () => {
    expect(validarPat('sbp_1234').ok).toBe(true)
    expect(validarPat('sb_secret_1234').ok).toBe(false)
  })
})

describe('validarPin', () => {
  it('exige exactamente 6 dígitos', () => {
    expect(validarPin('452817').ok).toBe(true)
    expect(validarPin('45281').ok).toBe(false)
    expect(validarPin('4528170').ok).toBe(false)
    expect(validarPin('45281a').ok).toBe(false)
  })
})

describe('nombreDeProyecto', () => {
  it('usa el nombre de la carpeta donde está parado el alumno', () => {
    expect(nombreDeProyecto('/Users/ana/mi-bot')).toBe('mi-bot')
  })

  it('limpia lo que Vercel no acepta', () => {
    expect(nombreDeProyecto('/Users/joffre/Desktop/[Bot Clase]')).toBe('bot-clase')
    expect(nombreDeProyecto('/tmp/Mi Bot de WhatsApp!')).toBe('mi-bot-de-whatsapp')
  })

  it('no deja guiones sueltos al principio ni al final', () => {
    expect(nombreDeProyecto('/tmp/---raro---')).toBe('raro')
  })

  it('cae en un nombre por defecto si no queda nada usable', () => {
    expect(nombreDeProyecto('/tmp/***')).toBe('bot-whatsapp')
  })

  it('recorta los nombres larguísimos', () => {
    expect(nombreDeProyecto('/tmp/' + 'a'.repeat(200)).length).toBeLessThanOrEqual(100)
  })
})

