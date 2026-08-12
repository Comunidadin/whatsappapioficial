import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function logWebhookEvent(ok: boolean, detail: string): Promise<void> {
  await supabaseAdmin().from('webhook_events').insert({ ok, detail: detail.slice(0, 500) })
}

export async function getLastWebhookEvents(
  limit: number,
): Promise<{ received_at: string; ok: boolean; detail: string }[]> {
  const { data, error } = await supabaseAdmin()
    .from('webhook_events')
    .select('received_at, ok, detail')
    .order('received_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`No se pudieron leer los eventos: ${error.message}`)
  return data ?? []
}
