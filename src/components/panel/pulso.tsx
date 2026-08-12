import { getConfig } from '@/lib/db/config'
import { getLastWebhookEvents } from '@/lib/db/events'

export function haceCuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

/**
 * El único sitio del panel donde se ve, de un vistazo, si esto está vivo:
 * si el bot responde y si Meta sigue entregando mensajes.
 */
export async function Pulso() {
  let botActivo = false
  let ultimoEvento: string | null = null
  let roto = false

  try {
    const [config, eventos] = await Promise.all([getConfig(), getLastWebhookEvents(1)])
    botActivo = config.bot_enabled
    ultimoEvento = eventos[0]?.received_at ?? null
  } catch {
    roto = true
  }

  if (roto) {
    return (
      <div className="rounded-md border border-signal bg-signal-soft px-3 py-2.5">
        <p className="font-display text-xs font-medium text-signal">Sin base de datos</p>
        <p className="mt-0.5 text-xs text-muted">Revisa las credenciales de Supabase.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-2 rounded-full ${botActivo ? 'bg-navy latido' : 'bg-line'}`}
        />
        <span className="font-display text-xs font-medium">
          {botActivo ? 'Bot respondiendo' : 'Bot en pausa'}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted">
        {ultimoEvento ? `Meta entregó ${haceCuanto(ultimoEvento)}` : 'Meta no ha entregado nada'}
      </p>
    </div>
  )
}
