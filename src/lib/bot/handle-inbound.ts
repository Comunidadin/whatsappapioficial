import 'server-only'
import { getConfig } from '@/lib/db/config'
import { upsertContact, setContactFlags } from '@/lib/db/contacts'
import { insertInboundMessage, insertOutboundMessage, getRecentMessages } from '@/lib/db/messages'
import { logWebhookEvent } from '@/lib/db/events'
import { decideBotAction } from '@/lib/bot/rules'
import { buildChatMessages, HISTORY_LIMIT } from '@/lib/bot/prompt'
import { generateReply } from '@/lib/bot/openai'
import { sendWhatsAppText } from '@/lib/whatsapp/send'
import type { InboundMessage } from '@/lib/whatsapp/parse'
import type { BotConfig } from '@/lib/types'

/** Envía y guarda; si Meta rechaza, deja el mensaje como fallido y avisa al llamador. */
async function enviarYGuardar(
  config: BotConfig,
  contactId: string,
  to: string,
  text: string,
): Promise<boolean> {
  try {
    const { waMessageId } = await sendWhatsAppText({
      phoneNumberId: config.phone_number_id,
      token: config.meta_token,
      to,
      text,
    })
    await insertOutboundMessage({ contactId, body: text, sender: 'bot', waMessageId, status: 'sent' })
    return true
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    await insertOutboundMessage({
      contactId, body: text, sender: 'bot', waMessageId: null, status: 'failed', error: detalle,
    })
    return false
  }
}

/** Nunca lanza: corre en segundo plano después de responderle 200 a Meta. */
export async function handleInbound(message: InboundMessage, now: Date = new Date()): Promise<void> {
  let contactId: string | null = null

  try {
    const config = await getConfig()
    const { contact, isNew } = await upsertContact({
      waId: message.from,
      profileName: message.profileName,
    })
    contactId = contact.id

    const { inserted } = await insertInboundMessage(contact.id, message)
    if (!inserted) return // Meta reintentó una entrega que ya procesamos.

    const decision = decideBotAction({ config, contact, isNewContact: isNew, message, now })

    if (decision.action === 'silent') {
      if (decision.needsAttention) await setContactFlags(contact.id, { needs_attention: true })
      return
    }

    if (decision.action === 'canned') {
      if (decision.text.trim() === '') return
      const ok = await enviarYGuardar(config, contact.id, message.from, decision.text)
      if (!ok) await setContactFlags(contact.id, { needs_attention: true })
      return
    }

    if (decision.welcome) {
      await enviarYGuardar(config, contact.id, message.from, decision.welcome)
    }

    const history = await getRecentMessages(contact.id, HISTORY_LIMIT + 1)
    const chat = buildChatMessages({
      config,
      history: history.filter((m) => m.wa_message_id !== message.waMessageId),
      incoming: message,
    })

    const respuesta = await generateReply(chat, { model: config.openai_model })
    const ok = await enviarYGuardar(config, contact.id, message.from, respuesta)
    if (!ok) await setContactFlags(contact.id, { needs_attention: true })
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    // El manejador de errores no puede lanzar a su vez: nadie lo estaría escuchando.
    try {
      if (contactId) await setContactFlags(contactId, { needs_attention: true })
    } catch {
      // sin remedio
    }
    try {
      await logWebhookEvent(false, `Fallo procesando ${message.waMessageId}: ${detalle}`)
    } catch {
      // sin remedio
    }
  }
}
