'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const RUTAS = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/leads', label: 'Leads' },
  { href: '/bot', label: 'Bot' },
  { href: '/conexion', label: 'Conexión' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-0.5">
      {RUTAS.map((ruta) => {
        const activa = pathname === ruta.href
        return (
          <Link
            key={ruta.href}
            href={ruta.href}
            aria-current={activa ? 'page' : undefined}
            className={`block rounded-md px-3 py-2 font-display text-sm ${
              activa ? 'bg-navy text-white' : 'text-ink hover:bg-navy-soft'
            }`}
          >
            {ruta.label}
          </Link>
        )
      })}
    </nav>
  )
}
