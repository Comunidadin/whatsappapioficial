import { listContacts } from '@/lib/db/contacts'
import { getMetrics } from '@/lib/db/metrics'
import { LeadsTable } from '@/components/leads/leads-table'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [contactos, metricas] = await Promise.all([listContacts(), getMetrics()])

  const tarjetas: [string, number, boolean][] = [
    ['Conversaciones nuevas', metricas.nuevos, false],
    ['Mensajes recibidos', metricas.recibidos, false],
    ['Respondidos por el bot', metricas.respondidosBot, false],
    ['Esperando por ti', metricas.escalados, metricas.escalados > 0],
  ]

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <p className="eyebrow">Leads</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Quién escribió y en qué quedó
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tarjetas.map(([etiqueta, valor, alerta]) => (
            <div
              key={etiqueta}
              className={`rounded-lg border p-4 ${
                alerta ? 'border-signal bg-signal-soft' : 'border-line bg-panel'
              }`}
            >
              <p className="eyebrow">{etiqueta}</p>
              <p
                className={`mt-1 font-display text-3xl font-bold ${alerta ? 'text-signal' : ''}`}
              >
                {valor}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <LeadsTable contactos={contactos} />
        </div>
      </div>
    </div>
  )
}
