import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Contact } from '@/lib/types'

export async function upsertContact(input: {
  waId: string
  profileName: string | null
}): Promise<{ contact: Contact; isNew: boolean }> {
  const db = supabaseAdmin()
  const { data: existente } = await db
    .from('contacts').select('*').eq('wa_id', input.waId).maybeSingle()

  if (existente) {
    const { data, error } = await db
      .from('contacts')
      .update({
        profile_name: input.profileName ?? existente.profile_name,
        last_message_at: new Date().toISOString(),
        status: existente.status === 'nuevo' ? 'en_conversacion' : existente.status,
      })
      .eq('id', existente.id)
      .select()
      .single()
    if (error) throw new Error(`No se pudo actualizar el contacto: ${error.message}`)
    return { contact: data as Contact, isNew: false }
  }

  const { data, error } = await db
    .from('contacts')
    .insert({ wa_id: input.waId, profile_name: input.profileName, status: 'nuevo' })
    .select()
    .single()
  if (error) throw new Error(`No se pudo crear el contacto: ${error.message}`)
  return { contact: data as Contact, isNew: true }
}

export async function setContactFlags(
  id: string,
  patch: Partial<Pick<Contact, 'bot_paused' | 'needs_attention' | 'status' | 'last_message_at'>>,
): Promise<void> {
  const { error } = await supabaseAdmin().from('contacts').update(patch).eq('id', id)
  if (error) throw new Error(`No se pudo actualizar el contacto: ${error.message}`)
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabaseAdmin()
    .from('contacts').select('*').order('last_message_at', { ascending: false })
  if (error) throw new Error(`No se pudieron leer los contactos: ${error.message}`)
  return (data ?? []) as Contact[]
}
