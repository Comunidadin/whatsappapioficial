import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { Nav } from '@/components/panel/nav'
import { Pulso } from '@/components/panel/pulso'

export default async function PanelLayout({ children }: LayoutProps<'/'>) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-paper p-5">
        <div>
          <p className="eyebrow">Sala de control</p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight">Bot de WhatsApp</p>
        </div>

        <Pulso />
        <Nav />

        <p className="mt-auto truncate font-mono text-[11px] text-muted" title={user.email ?? ''}>
          {user.email}
        </p>
      </aside>

      <main className="flex-1 overflow-hidden bg-paper">{children}</main>
    </div>
  )
}
