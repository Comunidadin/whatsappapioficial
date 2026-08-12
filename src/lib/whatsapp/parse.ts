import type { MessageStatus, MessageType } from '@/lib/types'

export type InboundMessage = {
  waMessageId: string
  from: string
  profileName: string | null
  type: MessageType
  body: string
}

export type StatusUpdate = {
  waMessageId: string
  status: MessageStatus
  error: string | null
}

export type ParsedWebhook = { messages: InboundMessage[]; statuses: StatusUpdate[] }

const TIPOS: Record<string, MessageType> = { text: 'text', image: 'image', audio: 'audio' }
const ESTADOS: Record<string, MessageStatus> = {
  sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed',
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function parseWebhook(payload: unknown): ParsedWebhook {
  const messages: InboundMessage[] = []
  const statuses: StatusUpdate[] = []
  const entries = asArray((payload as { entry?: unknown } | null)?.entry)

  for (const entry of entries) {
    for (const change of asArray((entry as { changes?: unknown })?.changes)) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {}
      const contactos = asArray(value.contacts) as { wa_id?: string; profile?: { name?: string } }[]

      for (const raw of asArray(value.messages) as Record<string, unknown>[]) {
        const from = String(raw.from ?? '')
        const contacto = contactos.find((c) => c.wa_id === from) ?? contactos[0]
        const tipo = TIPOS[String(raw.type)] ?? 'other'
        const body = tipo === 'text'
          ? String((raw.text as { body?: string })?.body ?? '')
          : ''

        messages.push({
          waMessageId: String(raw.id ?? ''),
          from,
          profileName: contacto?.profile?.name ?? null,
          type: tipo,
          body,
        })
      }

      for (const raw of asArray(value.statuses) as Record<string, unknown>[]) {
        const errores = asArray(raw.errors) as { code?: number; title?: string }[]
        statuses.push({
          waMessageId: String(raw.id ?? ''),
          status: ESTADOS[String(raw.status)] ?? 'sent',
          error: errores.length
            ? errores.map((e) => `${e.code ?? ''} ${e.title ?? ''}`.trim()).join('; ')
            : null,
        })
      }
    }
  }

  return { messages, statuses }
}
