import { listContacts } from '@/lib/db/contacts'
import { Inbox } from '@/components/inbox/inbox'
import { FaltanTablas, esTablaFaltante } from '@/components/panel/faltan-tablas'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  try {
    const contactos = await listContacts()
    return <Inbox contactosIniciales={contactos} />
  } catch (err) {
    if (esTablaFaltante(err)) return <FaltanTablas />
    throw err
  }
}
