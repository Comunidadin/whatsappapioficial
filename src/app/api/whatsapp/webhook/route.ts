import { after } from 'next/server'
import { getConfig } from '@/lib/db/config'
import { verifySignature } from '@/lib/whatsapp/signature'
import { parseWebhook } from '@/lib/whatsapp/parse'
import { handleInbound } from '@/lib/bot/handle-inbound'
import { updateMessageStatus } from '@/lib/db/messages'
import { logWebhookEvent } from '@/lib/db/events'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge') ?? ''

  const config = await getConfig()
  const expected = config.verify_token

  if (mode === 'subscribe' && expected !== '' && token === expected) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

async function registrar(ok: boolean, detalle: string): Promise<void> {
  try {
    await logWebhookEvent(ok, detalle)
  } catch {
    // Si ni siquiera podemos registrar el evento, no hay nada más que hacer.
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const config = await getConfig()

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'), config.meta_app_secret)) {
    await registrar(false, 'Firma inválida')
    return new Response('Unauthorized', { status: 401 })
  }

  let parsed
  try {
    parsed = parseWebhook(JSON.parse(rawBody))
  } catch {
    await registrar(false, 'Cuerpo no es JSON válido')
    return new Response('OK', { status: 200 })
  }

  await registrar(true, `${parsed.messages.length} mensaje(s), ${parsed.statuses.length} estado(s)`)

  // Responder rápido: Meta reintenta si tardamos más de ~10 s y eso duplicaría respuestas.
  after(async () => {
    for (const estado of parsed.statuses) {
      try {
        await updateMessageStatus(estado)
      } catch {
        // Un estado perdido no justifica frenar el resto.
      }
    }
    for (const mensaje of parsed.messages) {
      await handleInbound(mensaje)
    }
  })

  return new Response('OK', { status: 200 })
}
