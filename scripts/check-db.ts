import { upsertContact, setContactFlags, listContacts } from '../src/lib/db/contacts'
import { insertInboundMessage, insertOutboundMessage, getRecentMessages, updateMessageStatus } from '../src/lib/db/messages'
import { logWebhookEvent, getLastWebhookEvents } from '../src/lib/db/events'
import { getConfig } from '../src/lib/db/config'
import { supabaseAdmin } from '../src/lib/supabase/admin'

async function main() {
  const config = await getConfig()
  console.log('config ok, modelo:', config.openai_model)

  const primero = await upsertContact({ waId: '000_prueba', profileName: 'Prueba' })
  console.log('contacto nuevo:', primero.isNew === true ? 'sí' : 'NO')

  const segundo = await upsertContact({ waId: '000_prueba', profileName: 'Prueba' })
  console.log('segundo upsert reconoce existente:', segundo.isNew === false ? 'sí' : 'NO')

  const entrante = { waMessageId: 'wamid.prueba', from: '000_prueba', profileName: 'Prueba', type: 'text' as const, body: 'hola' }
  console.log('primer insert:', (await insertInboundMessage(primero.contact.id, entrante)).inserted === true ? 'sí' : 'NO')
  console.log('duplicado rechazado:', (await insertInboundMessage(primero.contact.id, entrante)).inserted === false ? 'sí' : 'NO')

  await insertOutboundMessage({ contactId: primero.contact.id, body: 'respuesta', sender: 'bot', waMessageId: 'wamid.out' })
  await updateMessageStatus({ waMessageId: 'wamid.out', status: 'read', error: null })

  const historial = await getRecentMessages(primero.contact.id, 15)
  console.log('historial en orden cronológico:', historial.map((m) => m.body).join(' -> '))

  await setContactFlags(primero.contact.id, { needs_attention: true })
  console.log('contactos listados:', (await listContacts()).length)

  await logWebhookEvent(true, 'prueba')
  console.log('eventos:', (await getLastWebhookEvents(5)).length)

  await supabaseAdmin().from('contacts').delete().eq('wa_id', '000_prueba')
  await supabaseAdmin().from('webhook_events').delete().eq('detail', 'prueba')
  console.log('limpieza lista')
}

main().catch((err) => { console.error(err); process.exit(1) })
