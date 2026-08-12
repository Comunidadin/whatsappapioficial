import { listContacts } from '@/lib/db/contacts'
import { Inbox } from '@/components/inbox/inbox'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const contactos = await listContacts()
  return <Inbox contactosIniciales={contactos} />
}
