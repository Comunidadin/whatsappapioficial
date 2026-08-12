'use server'

import { revalidatePath } from 'next/cache'
import { setContactFlags } from '@/lib/db/contacts'
import { exigirSesion } from '@/actions/sesion'
import type { ContactStatus } from '@/lib/types'

export async function cambiarEstadoLead(contactId: string, estado: ContactStatus): Promise<void> {
  await exigirSesion()
  await setContactFlags(contactId, { status: estado })
  revalidatePath('/leads')
}
