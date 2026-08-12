import { createClient } from '@supabase/supabase-js'

/** Crea el único usuario del panel. Uso: npx tsx --env-file=.env.local scripts/crear-usuario.ts correo contraseña */
async function main() {
  const [email, password] = process.argv.slice(2)
  if (!email || !password) throw new Error('Uso: crear-usuario.ts <correo> <contraseña>')

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  console.log('usuario creado:', data.user?.email)
}

main().catch((err) => { console.error(err.message ?? err); process.exit(1) })
