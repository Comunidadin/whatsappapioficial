import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { BotConfig } from '@/lib/types'

export async function getConfig(): Promise<BotConfig> {
  const { data, error } = await supabaseAdmin().from('config').select('*').single()
  if (error) throw new Error(`No se pudo leer la config: ${error.message}`)
  return data as BotConfig
}

export async function updateConfig(patch: Partial<BotConfig>): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw new Error(`No se pudo guardar la config: ${error.message}`)
}
