import { getConfig } from '@/lib/db/config'
import { BotForm } from '@/components/bot/bot-form'
import { FaltanTablas, esTablaFaltante } from '@/components/panel/faltan-tablas'

export const dynamic = 'force-dynamic'

export default async function BotPage() {
  let config
  try {
    config = await getConfig()
  } catch (err) {
    if (esTablaFaltante(err)) return <FaltanTablas />
    throw err
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="eyebrow">Bot</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Qué dice y cuándo se calla
        </h1>
        <div className="mt-6">
          <BotForm config={config} />
        </div>
      </div>
    </div>
  )
}
