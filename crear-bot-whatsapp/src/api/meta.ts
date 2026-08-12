import { MENSAJES } from '../mensajes.js'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type Numero = {
  id: string
  numero: string
  nombre: string
  estado: string
  plataforma: string
}

type Respuesta = { ok: boolean; status: number; text: () => Promise<string> }

async function leer(res: Respuesta): Promise<Record<string, unknown>> {
  const crudo = await res.text()
  let cuerpo: Record<string, unknown> = {}
  try {
    cuerpo = JSON.parse(crudo) as Record<string, unknown>
  } catch {
    throw new Error(`Meta respondió algo que no es JSON (HTTP ${res.status})`)
  }
  if (!res.ok) {
    const error = cuerpo.error as { message?: string } | undefined
    throw new Error(error?.message ?? `Meta respondió HTTP ${res.status}`)
  }
  return cuerpo
}

async function pedir(
  url: string,
  token: string,
  init: { method?: string; body?: string } = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: init.method,
    body: init.body,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return leer(res as unknown as Respuesta)
}

export async function revisarToken(
  token: string,
): Promise<{ valido: boolean; tieneActivos: boolean; motivo?: string }> {
  const cuerpo = await pedir(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`,
    token,
  )
  const data = (cuerpo.data ?? {}) as {
    is_valid?: boolean
    granular_scopes?: { scope: string; target_ids?: string[] }[]
  }

  if (!data.is_valid) {
    return { valido: false, tieneActivos: false, motivo: 'El token no es válido o ya caducó.' }
  }

  const tieneActivos = (data.granular_scopes ?? []).some(
    (s) => Array.isArray(s.target_ids) && s.target_ids.length > 0,
  )

  return tieneActivos
    ? { valido: true, tieneActivos: true }
    : { valido: true, tieneActivos: false, motivo: MENSAJES.tokenSinActivos }
}

export async function buscarWabas(token: string): Promise<string[]> {
  const negocios = (await pedir(`${GRAPH}/me/businesses?fields=id`, token)).data as
    | { id: string }[]
    | undefined

  const wabas: string[] = []
  for (const negocio of negocios ?? []) {
    const propias = (
      await pedir(`${GRAPH}/${negocio.id}/owned_whatsapp_business_accounts?fields=id`, token)
    ).data as { id: string }[] | undefined
    for (const waba of propias ?? []) wabas.push(waba.id)
  }
  return wabas
}

function aNumero(fila: Record<string, unknown>): Numero {
  return {
    id: String(fila.id ?? ''),
    numero: String(fila.display_phone_number ?? ''),
    nombre: String(fila.verified_name ?? ''),
    estado: String(fila.status ?? 'DESCONOCIDO'),
    plataforma: String(fila.platform_type ?? 'NOT_APPLICABLE'),
  }
}

const CAMPOS = 'id,display_phone_number,verified_name,status,platform_type'

export async function listarNumeros(token: string, wabaId: string): Promise<Numero[]> {
  const cuerpo = await pedir(`${GRAPH}/${wabaId}/phone_numbers?fields=${CAMPOS}`, token)
  return ((cuerpo.data ?? []) as Record<string, unknown>[]).map(aNumero)
}

export async function estadoNumero(token: string, numeroId: string): Promise<Numero> {
  return aNumero(await pedir(`${GRAPH}/${numeroId}?fields=${CAMPOS}`, token))
}

export async function registrarNumero(
  token: string,
  numeroId: string,
  pin: string,
): Promise<void> {
  try {
    await pedir(`${GRAPH}/${numeroId}/register`, token, {
      method: 'POST',
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    // Registrar dos veces no es un fallo: el resultado buscado ya se cumplió.
    if (mensaje.includes('already registered')) return
    throw err
  }
}

export async function conectarAppAlWaba(token: string, wabaId: string): Promise<void> {
  await pedir(`${GRAPH}/${wabaId}/subscribed_apps`, token, { method: 'POST' })
}

export async function configurarWebhook(input: {
  appId: string
  appSecret: string
  url: string
  verifyToken: string
}): Promise<void> {
  const res = await fetch(`${GRAPH}/${input.appId}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      callback_url: input.url,
      verify_token: input.verifyToken,
      fields: ['messages'],
      access_token: `${input.appId}|${input.appSecret}`,
    }),
  })

  try {
    await leer(res as unknown as Respuesta)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    if (mensaje.toLowerCase().includes('validat')) {
      throw new Error(
        `Meta no pudo verificar tu webhook (${input.url}). Suele significar que el despliegue ` +
          'quedó sin variables de entorno o que el token de verificación no llegó a guardarse.',
      )
    }
    throw err
  }
}
