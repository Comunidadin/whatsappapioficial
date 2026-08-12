'use server'

import { getConfig } from '@/lib/db/config'
import { setContactFlags } from '@/lib/db/contacts'
import { getRecentMessages, insertOutboundMessage } from '@/lib/db/messages'
import { sendWhatsAppText } from '@/lib/whatsapp/send'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { exigirSesion } from '@/actions/sesion'
import type { Message } from '@/lib/types'

export async function cargarMensajes(contactId: string): Promise<Message[]> {
  await exigirSesion()
  return getRecentMessages(contactId, 100)
}

export async function alternarPausa(contactId: string, pausado: boolean): Promise<void> {
  await exigirSesion()
  await setContactFlags(contactId, { bot_paused: pausado })
}

export async function responderManual(
  contactId: string,
  texto: string,
): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()
  if (texto.trim() === '') return { ok: false, mensaje: 'El mensaje está vacío.' }

  const config = await getConfig()
  const { data: contacto } = await supabaseAdmin()
    .from('contacts').select('wa_id').eq('id', contactId).single()
  if (!contacto) return { ok: false, mensaje: 'Contacto no encontrado.' }

  try {
    const { waMessageId } = await sendWhatsAppText({
      phoneNumberId: config.phone_number_id,
      token: config.meta_token,
      to: contacto.wa_id,
      text: texto.trim(),
    })
    await insertOutboundMessage({
      contactId, body: texto.trim(), sender: 'humano', waMessageId, status: 'sent',
    })
    await setContactFlags(contactId, { needs_attention: false, status: 'atendido_humano' })
    return { ok: true, mensaje: 'Enviado.' }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : 'Error desconocido'
    await insertOutboundMessage({
      contactId, body: texto.trim(), sender: 'humano', status: 'failed', error: detalle,
    })
    return { ok: false, mensaje: detalle }
  }
}
