'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) {
      setError('No pudimos entrar. Revisa el correo y la contraseña.')
      return
    }
    router.push('/inbox')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Sala de control</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          Bot de WhatsApp
        </h1>

        <form onSubmit={entrar} className="mt-8 space-y-3">
          <label className="block">
            <span className="text-sm text-muted">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-md bg-navy px-4 py-2.5 font-display text-sm font-medium text-white disabled:opacity-50"
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
