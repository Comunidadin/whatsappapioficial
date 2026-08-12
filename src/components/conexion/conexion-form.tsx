'use client'

import { useState } from 'react'
import { guardarConexion, probarConexion } from '@/actions/config'

type Props = {
  webhookUrl: string
  config: {
    phone_number_id: string
    waba_id: string
    verify_token: string
    tieneToken: boolean
    tieneSecret: boolean
  }
}

function Campo({ label, name, defaultValue, placeholder, type = 'text', pista }: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  type?: string
  pista?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {pista && <span className="ml-2 text-xs text-muted">{pista}</span>}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm"
      />
    </label>
  )
}

function Copiable({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-sm">{valor}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(valor)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          }}
          className="shrink-0 rounded border border-line px-2 py-1 font-display text-xs hover:bg-navy-soft"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

export function ConexionForm({ webhookUrl, config }: Props) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [probando, setProbando] = useState(false)

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-line bg-panel p-5">
        <div>
          <h2 className="font-display text-base font-medium">Pegar en Meta</h2>
          <p className="mt-0.5 text-sm text-muted">
            developers.facebook.com → tu app → WhatsApp → Configuración → Webhooks. Suscríbete al
            campo <code className="font-mono">messages</code>.
          </p>
        </div>
        <Copiable label="URL de devolución de llamada" valor={webhookUrl} />
        <Copiable label="Token de verificación" valor={config.verify_token || '(sin definir)'} />
      </section>

      <form
        action={async (formData) => setAviso(await guardarConexion(formData))}
        className="space-y-4 rounded-lg border border-line bg-panel p-5"
      >
        <h2 className="font-display text-base font-medium">Credenciales del número</h2>

        <Campo label="Phone Number ID" name="phone_number_id" defaultValue={config.phone_number_id} />
        <Campo label="WABA ID" name="waba_id" defaultValue={config.waba_id} />
        <Campo
          label="Token de verificación"
          name="verify_token"
          defaultValue={config.verify_token}
          pista="lo eliges tú; el mismo va en Meta"
        />
        <Campo
          label="Token permanente de Meta"
          name="meta_token"
          type="password"
          placeholder={config.tieneToken ? 'Guardado — escribe para cambiarlo' : 'Pegar token'}
        />
        <Campo
          label="App Secret"
          name="meta_app_secret"
          type="password"
          placeholder={config.tieneSecret ? 'Guardado — escribe para cambiarlo' : 'Pegar app secret'}
          pista="firma cada mensaje que llega"
        />

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded-md bg-navy px-4 py-2 font-display text-sm font-medium text-white"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={async () => {
              setProbando(true)
              setAviso(await probarConexion())
              setProbando(false)
            }}
            className="rounded-md border border-line px-4 py-2 font-display text-sm hover:bg-navy-soft"
          >
            {probando ? 'Probando…' : 'Probar conexión'}
          </button>
        </div>

        {aviso && (
          <p className={`text-sm ${aviso.ok ? 'text-navy' : 'text-danger'}`}>{aviso.mensaje}</p>
        )}
      </form>
    </div>
  )
}
