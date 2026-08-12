const MANAGEMENT = 'https://api.supabase.com/v1'

type Respuesta = { ok: boolean; status: number; text: () => Promise<string> }

async function comprobar(res: Respuesta): Promise<void> {
  if (res.ok) return
  const crudo = await res.text()
  let mensaje = crudo
  try {
    const json = JSON.parse(crudo) as { message?: string; error?: string }
    mensaje = json.message ?? json.error ?? crudo
  } catch {
    // El cuerpo no era JSON: se usa tal cual.
  }
  throw new Error(mensaje || `HTTP ${res.status}`)
}

export async function ejecutarSql(pat: string, ref: string, sql: string): Promise<void> {
  const res = await fetch(`${MANAGEMENT}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  await comprobar(res as unknown as Respuesta)
}

export async function comprobarSecretKey(
  url: string,
  secretKey: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const res = await fetch(`${url}/rest/v1/config?select=id&limit=1`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  })

  if (res.ok) return { ok: true }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, motivo: 'Esa clave secreta no es válida para este proyecto.' }
  }
  // 404 = las tablas aún no existen; la clave sirve.
  if (res.status === 404) return { ok: true }
  return { ok: false, motivo: `Supabase respondió HTTP ${res.status}.` }
}

export async function guardarConfig(
  url: string,
  secretKey: string,
  campos: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${url}/rest/v1/config?id=eq.true`, {
    method: 'PATCH',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(campos),
  })
  if (!res.ok) throw new Error(`No se pudo guardar la configuración: HTTP ${res.status}`)
}
