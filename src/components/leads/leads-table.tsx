'use client'

import { useState } from 'react'
import { cambiarEstadoLead } from '@/actions/leads'
import type { Contact, ContactStatus } from '@/lib/types'

const ESTADOS: [ContactStatus, string][] = [
  ['nuevo', 'Nuevo'],
  ['en_conversacion', 'En conversación'],
  ['calificado', 'Calificado'],
  ['atendido_humano', 'Atendido por ti'],
]

export function LeadsTable({ contactos }: { contactos: Contact[] }) {
  const [filtro, setFiltro] = useState<ContactStatus | 'todos'>('todos')
  const visibles = filtro === 'todos' ? contactos : contactos.filter((c) => c.status === filtro)

  return (
    <div>
      <label className="flex items-center gap-2">
        <span className="eyebrow">Filtrar</span>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as ContactStatus | 'todos')}
          className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm"
        >
          <option value="todos">Todos</option>
          {ESTADOS.map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </label>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="eyebrow px-4 py-2.5">Contacto</th>
              <th className="eyebrow px-4 py-2.5">Número</th>
              <th className="eyebrow px-4 py-2.5">Último mensaje</th>
              <th className="eyebrow px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((contacto) => (
              <tr key={contacto.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  {contacto.profile_name || <span className="text-muted">sin nombre</span>}
                  {contacto.needs_attention && (
                    <span className="ml-2 font-display text-[11px] text-signal">te toca a ti</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{contacto.wa_id}</td>
                <td className="px-4 py-2.5 text-muted">
                  {new Date(contacto.last_message_at).toLocaleString('es-EC')}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    defaultValue={contacto.status}
                    onChange={(e) => cambiarEstadoLead(contacto.id, e.target.value as ContactStatus)}
                    className="rounded border border-line px-2 py-1 text-xs"
                  >
                    {ESTADOS.map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>{etiqueta}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">
            {contactos.length === 0
              ? 'Aún no ha escrito nadie al número.'
              : 'Ningún contacto con ese estado.'}
          </p>
        )}
      </div>
    </div>
  )
}
