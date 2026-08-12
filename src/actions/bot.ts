'use server'

import { revalidatePath } from 'next/cache'
import { getConfig, updateConfig } from '@/lib/db/config'
import { buildChatMessages } from '@/lib/bot/prompt'
import { generateReply } from '@/lib/bot/openai'
import { exigirSesion } from '@/actions/sesion'
import type { BusinessHours } from '@/lib/types'

const DIAS = ['0', '1', '2', '3', '4', '5', '6']

export async function guardarBot(formData: FormData): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()

  const horarioActivo = formData.get('horario_activo') === 'on'
  const days: BusinessHours['days'] = {}
  for (const dia of DIAS) {
    if (formData.get(`dia_${dia}`) !== 'on') continue
    const desde = String(formData.get(`desde_${dia}`) ?? '09:00')
    const hasta = String(formData.get(`hasta_${dia}`) ?? '18:00')
    days[dia] = [[desde, hasta]]
  }

  await updateConfig({
    bot_enabled: formData.get('bot_enabled') === 'on',
    bot_role: String(formData.get('bot_role') ?? 'personalizado'),
    system_prompt: String(formData.get('system_prompt') ?? '').trim(),
    welcome_message: String(formData.get('welcome_message') ?? '').trim(),
    out_of_hours_message: String(formData.get('out_of_hours_message') ?? '').trim(),
    openai_model: String(formData.get('openai_model') ?? 'gpt-4o-mini').trim(),
    escalation_keywords: String(formData.get('escalation_keywords') ?? '')
      .split(',').map((k) => k.trim()).filter(Boolean),
    business_hours: {
      enabled: horarioActivo,
      tz: String(formData.get('tz') ?? 'America/Guayaquil'),
      days,
    },
  })

  revalidatePath('/bot')
  return { ok: true, mensaje: 'Configuración guardada.' }
}

/** Arma el prompt real y llama a OpenAI. No toca WhatsApp ni crea contactos. */
export async function probarBot(texto: string): Promise<{ ok: boolean; respuesta: string }> {
  await exigirSesion()
  if (texto.trim() === '') return { ok: false, respuesta: 'Escribe un mensaje de prueba.' }

  const config = await getConfig()
  const chat = buildChatMessages({
    config,
    history: [],
    incoming: {
      waMessageId: 'prueba', from: 'prueba', profileName: 'Prueba',
      type: 'text', body: texto.trim(),
    },
  })

  try {
    return { ok: true, respuesta: await generateReply(chat, { model: config.openai_model }) }
  } catch (err) {
    return { ok: false, respuesta: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
