import { supabaseAdmin } from '../src/lib/supabase/admin'

async function main() {
  const db = supabaseAdmin()
  const { data: config, error: e1 } = await db.from('config').select('*').single()
  if (e1) throw e1
  console.log('config ok, modelo:', config.openai_model)

  const { data: contact, error: e2 } = await db
    .from('contacts')
    .upsert({ wa_id: '000_prueba', profile_name: 'Prueba' }, { onConflict: 'wa_id' })
    .select()
    .single()
  if (e2) throw e2
  console.log('contacto ok:', contact.id)

  const { error: e3 } = await db.from('messages').insert({
    contact_id: contact.id, wa_message_id: 'wamid.prueba', direction: 'inbound',
    sender: 'contacto', body: 'hola',
  })
  if (e3) throw e3

  const { error: e4 } = await db.from('messages').insert({
    contact_id: contact.id, wa_message_id: 'wamid.prueba', direction: 'inbound',
    sender: 'contacto', body: 'hola otra vez',
  })
  console.log('duplicado rechazado:', e4?.code === '23505' ? 'sí' : 'NO — revisar índice único')

  await db.from('contacts').delete().eq('wa_id', '000_prueba')
  console.log('limpieza lista')
}

main().catch((err) => { console.error(err); process.exit(1) })
