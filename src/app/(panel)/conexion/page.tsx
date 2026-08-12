import { headers } from 'next/headers'
import { getConfig } from '@/lib/db/config'
import { getLastWebhookEvents } from '@/lib/db/events'
import { ConexionForm } from '@/components/conexion/conexion-form'
import { haceCuanto } from '@/components/panel/pulso'
import { FaltanTablas, esTablaFaltante } from '@/components/panel/faltan-tablas'

export const dynamic = 'force-dynamic'

export default async function ConexionPage() {
  let config, eventos
  try {
    ;[config, eventos] = await Promise.all([getConfig(), getLastWebhookEvents(10)])
  } catch (err) {
    if (esTablaFaltante(err)) return <FaltanTablas />
    throw err
  }
  // La URL se deduce de la propia petición: así siempre coincide con el dominio
  // por el que estás entrando, sin tener que configurarla a mano en cada despliegue.
  const cabeceras = await headers()
  const host = cabeceras.get('x-forwarded-host') ?? cabeceras.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const base = process.env.APP_BASE_URL ?? `${protocolo}://${host}`

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="eyebrow">Conexión</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          El número y su webhook
        </h1>

        <section className="mt-6 rounded-lg border border-line bg-panel p-5">
          <p className="eyebrow">Último evento recibido de Meta</p>
          <p className="mt-1 font-display text-xl">
            {eventos.length ? haceCuanto(eventos[0].received_at) : 'nunca'}
          </p>

          {eventos.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-xs">
              {eventos.map((evento, i) => (
                <li key={i} className={evento.ok ? 'text-muted' : 'text-danger'}>
                  {new Date(evento.received_at).toLocaleString('es-EC')} — {evento.detail}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8">
          <ConexionForm
            webhookUrl={`${base}/api/whatsapp/webhook`}
            config={{
              phone_number_id: config.phone_number_id,
              waba_id: config.waba_id,
              verify_token: config.verify_token,
              tieneToken: config.meta_token !== '',
              tieneSecret: config.meta_app_secret !== '',
            }}
          />
        </div>
      </div>
    </div>
  )
}
