import 'server-only'
import { supabaseServer } from '@/lib/supabase/server'

/** Toda server action del panel empieza por aquí: sin sesión, no se toca nada. */
export async function exigirSesion(): Promise<void> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión')
}
