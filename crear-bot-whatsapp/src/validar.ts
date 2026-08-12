export type Resultado = { ok: true } | { ok: false; motivo: string }

const ok: Resultado = { ok: true }
const mal = (motivo: string): Resultado => ({ ok: false, motivo })

const URL_SUPABASE = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/

export function validarUrlSupabase(valor: string): Resultado {
  const limpio = valor.trim()
  if (limpio.includes('/rest/v1')) {
    return mal('Quita el /rest/v1 del final: hace falta solo https://tuproyecto.supabase.co')
  }
  if (!URL_SUPABASE.test(limpio)) {
    return mal('No parece la URL de un proyecto de Supabase. Debe ser https://algo.supabase.co')
  }
  return ok
}

export function refDeSupabase(url: string): string {
  const m = url.trim().match(URL_SUPABASE)
  if (!m) throw new Error(`URL de Supabase no válida: ${url}`)
  return m[1]
}

function conPrefijo(prefijo: string, nombre: string) {
  return (valor: string): Resultado =>
    valor.trim().startsWith(prefijo)
      ? ok
      : mal(`Esa no es la ${nombre}: tiene que empezar por ${prefijo}`)
}

export const validarSecretKey = conPrefijo('sb_secret_', 'clave secreta')
export const validarPublishableKey = conPrefijo('sb_publishable_', 'clave publicable')
export const validarPat = conPrefijo('sbp_', 'clave de acceso personal')

export function validarPin(valor: string): Resultado {
  return /^\d{6}$/.test(valor.trim()) ? ok : mal('El PIN son exactamente 6 dígitos')
}

/**
 * Nombre del proyecto en Vercel, sacado de la carpeta donde se ejecuta el comando.
 * Vercel solo acepta minúsculas, números y guiones, y no más de 100 caracteres.
 */
export function nombreDeProyecto(carpeta: string): string {
  const base = carpeta.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? ''
  const limpio = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
    .replace(/-$/, '')

  return limpio === '' ? 'bot-whatsapp' : limpio
}

