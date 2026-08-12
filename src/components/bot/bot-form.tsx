'use client'

import { useState } from 'react'
import { guardarBot, probarBot } from '@/actions/bot'
import { ROLE_LABELS, ROLE_PROMPTS, type BotRole } from '@/lib/bot/roles'
import type { BotConfig } from '@/lib/types'

const DIAS: [string, string][] = [
  ['1', 'Lunes'], ['2', 'Martes'], ['3', 'Miércoles'], ['4', 'Jueves'],
  ['5', 'Viernes'], ['6', 'Sábado'], ['0', 'Domingo'],
]

export function BotForm({ config }: { config: BotConfig }) {
  // Sin instrucciones propias todavía, arranca con el texto base del rol para no dejar el campo mudo.
  const [prompt, setPrompt] = useState(
    config.system_prompt || ROLE_PROMPTS[config.bot_role as BotRole] || ROLE_PROMPTS.personalizado,
  )
  const [aviso, setAviso] = useState<string | null>(null)
  const [prueba, setPrueba] = useState('')
  const [respuesta, setRespuesta] = useState<{ ok: boolean; texto: string } | null>(null)
  const [probando, setProbando] = useState(false)

  return (
    <div className="space-y-8">
      <form
        action={async (fd) => setAviso((await guardarBot(fd)).mensaje)}
        className="space-y-6 rounded-lg border border-line bg-panel p-5"
      >
        <label className="flex items-start gap-3">
          <input
            type="checkbox" name="bot_enabled" defaultChecked={config.bot_enabled}
            className="mt-0.5 size-4 accent-[#1f2b4d]"
          />
          <span>
            <span className="block text-sm font-medium">Bot activo</span>
            <span className="block text-xs text-muted">
              Apagado, no responde ningún chat. Los mensajes se siguen guardando.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Rol</span>
          <select
            name="bot_role"
            defaultValue={config.bot_role}
            onChange={(e) => setPrompt(ROLE_PROMPTS[e.target.value as BotRole] ?? '')}
            className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
          >
            {Object.entries(ROLE_LABELS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Al cambiar el rol se carga su texto base. Reescríbelo como quieras.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Instrucciones del bot</span>
          <textarea
            name="system_prompt" rows={9} value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm leading-relaxed"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Mensaje de bienvenida</span>
          <span className="ml-2 text-xs text-muted">solo la primera vez que alguien escribe</span>
          <textarea
            name="welcome_message" rows={2} defaultValue={config.welcome_message}
            className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="space-y-3 rounded-md border border-line p-4">
          <legend className="eyebrow px-1">Horario de atención</legend>

          <label className="flex items-center gap-3">
            <input
              type="checkbox" name="horario_activo"
              defaultChecked={config.business_hours.enabled}
              className="size-4 accent-[#1f2b4d]"
            />
            <span className="text-sm">Responder solo dentro del horario</span>
          </label>

          <label className="block">
            <span className="text-xs text-muted">Zona horaria</span>
            <input
              name="tz" defaultValue={config.business_hours.tz || 'America/Guayaquil'}
              className="mt-1 block w-64 rounded-md border border-line px-3 py-1.5 font-mono text-sm"
            />
          </label>

          <div className="space-y-1.5 pt-1">
            {DIAS.map(([valor, etiqueta]) => {
              const franja = config.business_hours.days?.[valor]?.[0]
              return (
                <div key={valor} className="flex items-center gap-3 text-sm">
                  <label className="flex w-32 items-center gap-2">
                    <input
                      type="checkbox" name={`dia_${valor}`} defaultChecked={Boolean(franja)}
                      className="size-4 accent-[#1f2b4d]"
                    />
                    {etiqueta}
                  </label>
                  <input
                    type="time" name={`desde_${valor}`} defaultValue={franja?.[0] ?? '09:00'}
                    className="rounded border border-line px-2 py-1 font-mono text-xs"
                  />
                  <input
                    type="time" name={`hasta_${valor}`} defaultValue={franja?.[1] ?? '18:00'}
                    className="rounded border border-line px-2 py-1 font-mono text-xs"
                  />
                </div>
              )
            })}
          </div>

          <label className="block pt-1">
            <span className="text-sm font-medium">Mensaje fuera de horario</span>
            <input
              name="out_of_hours_message" defaultValue={config.out_of_hours_message}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium">Palabras que te pasan el chat a ti</span>
          <span className="ml-2 text-xs text-muted">separadas por coma</span>
          <input
            name="escalation_keywords" defaultValue={config.escalation_keywords.join(', ')}
            placeholder="asesor, humano, reclamo"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            El bot se calla y el chat se marca en ámbar en el inbox.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Modelo de OpenAI</span>
          <input
            name="openai_model" defaultValue={config.openai_model}
            className="mt-1 block w-72 rounded-md border border-line px-3 py-2 font-mono text-sm"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-navy px-4 py-2 font-display text-sm font-medium text-white"
          >
            Guardar
          </button>
          {aviso && <p className="text-sm text-navy">{aviso}</p>}
        </div>
      </form>

      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="font-display text-base font-medium">Probador</h2>
        <p className="mt-0.5 text-sm text-muted">
          Usa la configuración guardada. No envía nada por WhatsApp.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={prueba}
            onChange={(e) => setPrueba(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return
              setProbando(true)
              const r = await probarBot(prueba)
              setRespuesta({ ok: r.ok, texto: r.respuesta })
              setProbando(false)
            }}
            placeholder="Escribe lo que diría un cliente…"
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              setProbando(true)
              const r = await probarBot(prueba)
              setRespuesta({ ok: r.ok, texto: r.respuesta })
              setProbando(false)
            }}
            className="rounded-md border border-line px-4 font-display text-sm hover:bg-navy-soft"
          >
            {probando ? 'Pensando…' : 'Probar'}
          </button>
        </div>

        {respuesta && (
          <p
            className={`mt-4 rounded-md px-4 py-3 text-sm whitespace-pre-wrap ${
              respuesta.ok ? 'bg-navy-soft' : 'bg-signal-soft text-signal'
            }`}
          >
            {respuesta.texto}
          </p>
        )}
      </section>
    </div>
  )
}
