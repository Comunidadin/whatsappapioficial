import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Message, MessageStatus } from '@/lib/types'
import type { InboundMessage, StatusUpdate } from '@/lib/whatsapp/parse'

/** Devuelve inserted=false si el mensaje ya existía (Meta reintenta las entregas). */
export async function insertInboundMessage(
  contactId: string,
  message: InboundMessage,
): Promise<{ inserted: boolean }> {
  const { error } = await supabaseAdmin().from('messages').insert({
    contact_id: contactId,
    wa_message_id: message.waMessageId,
    direction: 'inbound',
    sender: 'contacto',
    type: message.type,
    body: message.body,
    status: 'delivered',
  })

  if (error) {
    if (error.code === '23505') return { inserted: false }
    throw new Error(`No se pudo guardar el mensaje entrante: ${error.message}`)
  }
  return { inserted: true }
}

export async function insertOutboundMessage(input: {
  contactId: string
  body: string
  sender: 'bot' | 'humano'
  waMessageId?: string | null
  status?: MessageStatus
  error?: string | null
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .insert({
      contact_id: input.contactId,
      wa_message_id: input.waMessageId ?? null,
      direction: 'outbound',
      sender: input.sender,
      type: 'text',
      body: input.body,
      status: input.status ?? 'sent',
      error: input.error ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo guardar el mensaje saliente: ${error.message}`)
  return data.id as string
}

export async function updateMessageStatus(update: StatusUpdate): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('messages')
    .update({ status: update.status, error: update.error })
    .eq('wa_message_id', update.waMessageId)
  if (error) throw new Error(`No se pudo actualizar el estado: ${error.message}`)
}

export async function getRecentMessages(contactId: string, limit: number): Promise<Message[]> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`No se pudieron leer los mensajes: ${error.message}`)
  return ((data ?? []) as Message[]).reverse()
}
