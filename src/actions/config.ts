'use server'

import { revalidatePath } from 'next/cache'
import { getConfig, updateConfig } from '@/lib/db/config'
import { fetchPhoneNumberInfo } from '@/lib/whatsapp/send'
import { exigirSesion } from '@/actions/sesion'

export async function guardarConexion(formData: FormData): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()

  const patch: Record<string, string> = {}
  for (const campo of ['phone_number_id', 'waba_id', 'verify_token'] as const) {
    patch[campo] = String(formData.get(campo) ?? '').trim()
  }
  // Los secretos solo se sobrescriben si el usuario escribió algo nuevo.
  for (const campo of ['meta_token', 'meta_app_secret'] as const) {
    const valor = String(formData.get(campo) ?? '').trim()
    if (valor !== '') patch[campo] = valor
  }

  await updateConfig(patch)
  revalidatePath('/conexion')
  return { ok: true, mensaje: 'Datos guardados.' }
}

export async function probarConexion(): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()
  const config = await getConfig()

  if (!config.phone_number_id || !config.meta_token) {
    return { ok: false, mensaje: 'Faltan el Phone Number ID o el token.' }
  }

  try {
    const info = await fetchPhoneNumberInfo({
      phoneNumberId: config.phone_number_id,
      token: config.meta_token,
    })
    return { ok: true, mensaje: `Conectado a ${info.displayPhoneNumber} · ${info.verifiedName}` }
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
