'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { cargarMensajes, responderManual, alternarPausa } from '@/actions/inbox'
import type { Contact, Message } from '@/lib/types'

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })

function Burbuja({ mensaje }: { mensaje: Message }) {
  const esContacto = mensaje.sender === 'contacto'
  const estilo = esContacto
    ? 'self-start border border-line bg-panel'
    : mensaje.sender === 'bot'
      ? 'self-end bg-navy-soft'
      : 'self-end bg-navy text-white'

  return (
    <div className={`max-w-[68%] rounded-lg px-3.5 py-2.5 ${estilo}`}>
      <p className="text-sm whitespace-pre-wrap">
        {mensaje.body || <span className="italic opacity-70">[{mensaje.type}]</span>}
      </p>
      <p
        className={`mt-1 font-mono text-[10px] ${
          mensaje.sender === 'humano' ? 'text-white/70' : 'text-muted'
        }`}
      >
        {hora(mensaje.created_at)}
        {!esContacto && ` · ${mensaje.sender === 'bot' ? 'bot' : 'tú'} · ${mensaje.status}`}
      </p>
      {mensaje.error && <p className="mt-1 text-[11px] text-danger">{mensaje.error}</p>}
    </div>
  )
}

export function Inbox({ contactosIniciales }: { contactosIniciales: Contact[] }) {
  const [contactos, setContactos] = useState(contactosIniciales)
  const [activo, setActivo] = useState<Contact | null>(contactosIniciales[0] ?? null)
  const [mensajes, setMensajes] = useState<Message[]>([])
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  const refrescarMensajes = useCallback(async (id: string) => {
    setMensajes(await cargarMensajes(id))
  }, [])

  useEffect(() => {
    if (activo) void refrescarMensajes(activo.id)
  }, [activo, refrescarMensajes])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes])

  useEffect(() => {
    const supabase = supabaseBrowser()
    const canal = supabase
      .channel('inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const fila = payload.new as Message
        if (activo && fila.contact_id === activo.id) void refrescarMensajes(activo.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, (payload) => {
        const fila = payload.new as Contact
        setContactos((prev) => {
          const resto = prev.filter((c) => c.id !== fila.id)
          return [fila, ...resto].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
        })
        setActivo((prev) => (prev && prev.id === fila.id ? fila : prev))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [activo, refrescarMensajes])

  async function enviar() {
    if (!activo || enviando) return
    setEnviando(true)
    const r = await responderManual(activo.id, texto)
    setEnviando(false)
    setAviso(r.ok ? null : r.mensaje)
    if (r.ok) {
      setTexto('')
      void refrescarMensajes(activo.id)
    }
  }

  async function pausar() {
    if (!activo) return
    const nuevo = !activo.bot_paused
    await alternarPausa(activo.id, nuevo)
    setActivo({ ...activo, bot_paused: nuevo })
  }

  return (
    <div className="flex h-screen">
      <ul className="w-80 shrink-0 overflow-y-auto border-r border-line bg-panel">
        {contactos.map((contacto) => (
          <li key={contacto.id}>
            <button
              onClick={() => setActivo(contacto)}
              className={`w-full border-b border-line px-4 py-3 text-left hover:bg-paper ${
                activo?.id === contacto.id ? 'bg-navy-soft' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {contacto.profile_name || contacto.wa_id}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted">
                  {hora(contacto.last_message_at)}
                </span>
              </div>
              <div className="mt-1 flex gap-2 font-display text-[11px]">
                {contacto.needs_attention && <span className="text-signal">te toca a ti</span>}
                {contacto.bot_paused && <span className="text-muted">bot pausado</span>}
              </div>
            </button>
          </li>
        ))}
        {contactos.length === 0 && (
          <li className="p-4 text-sm text-muted">
            Todavía no ha escrito nadie. Cuando llegue el primer mensaje, aparece aquí.
          </li>
        )}
      </ul>

      {activo ? (
        <section className="flex flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line bg-panel px-6 py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-medium">
                {activo.profile_name || activo.wa_id}
              </p>
              <p className="font-mono text-xs text-muted">{activo.wa_id}</p>
            </div>
            <button
              onClick={pausar}
              className={`shrink-0 rounded-md px-3 py-1.5 font-display text-xs ${
                activo.bot_paused
                  ? 'bg-navy text-white'
                  : 'border border-line hover:bg-navy-soft'
              }`}
            >
              {activo.bot_paused ? 'Reactivar el bot aquí' : 'Pausar el bot aquí'}
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-6 py-5">
            {mensajes.map((mensaje) => (
              <Burbuja key={mensaje.id} mensaje={mensaje} />
            ))}
            <div ref={finRef} />
          </div>

          <footer className="border-t border-line bg-panel px-6 py-4">
            {aviso && <p className="mb-2 text-sm text-danger">{aviso}</p>}
            <div className="flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void enviar()
                }}
                placeholder="Responde tú mismo…"
                className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
              />
              <button
                onClick={enviar}
                disabled={enviando}
                className="rounded-md bg-navy px-4 font-display text-sm font-medium text-white disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </footer>
        </section>
      ) : (
        <section className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
          Elige una conversación de la izquierda.
        </section>
      )}
    </div>
  )
}
