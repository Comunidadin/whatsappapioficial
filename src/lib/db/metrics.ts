import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function contar(
  tabla: 'contacts' | 'messages',
  columna: string,
  valor: string | boolean,
): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq(columna, valor)
  if (error) return 0
  return count ?? 0
}

export async function getMetrics(): Promise<{
  nuevos: number; recibidos: number; respondidosBot: number; escalados: number
}> {
  const [nuevos, recibidos, respondidosBot, escalados] = await Promise.all([
    contar('contacts', 'status', 'nuevo'),
    contar('messages', 'direction', 'inbound'),
    contar('messages', 'sender', 'bot'),
    contar('contacts', 'needs_attention', true),
  ])

  return { nuevos, recibidos, respondidosBot, escalados }
}
