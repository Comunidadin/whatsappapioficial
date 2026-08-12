import { randomBytes } from 'node:crypto'
import * as p from '@clack/prompts'
import type { Numero } from './api/meta.js'
import { revisarToken, buscarWabas, listarNumeros } from './api/meta.js'
import { comprobarKeyOpenai } from './api/openai.js'
import { comprobarSecretKey } from './api/supabase.js'
import { MENSAJES } from './mensajes.js'
import { carpetaOcupada } from './plantilla.js'
import {
  validarUrlSupabase, validarSecretKey, validarPublishableKey,
  validarPat, validarPin, nombreDeProyecto, type Resultado,
} from './validar.js'
import type { Datos } from './pasos.js'

export function generarVerifyToken(): string {
  return `bot-${randomBytes(10).toString('hex')}`
}

export async function elegirNumero(
  numeros: Numero[],
  preguntar: (opciones: { valor: string; etiqueta: string }[]) => Promise<string>,
): Promise<Numero> {
  if (numeros.length === 0) {
    throw new Error('Tu cuenta de WhatsApp no tiene ningún número. Añade uno en Meta y vuelve.')
  }
  if (numeros.length === 1) return numeros[0]

  const elegido = await preguntar(
    numeros.map((n) => ({ valor: n.id, etiqueta: `${n.numero} — ${n.nombre} (${n.estado})` })),
  )
  const numero = numeros.find((n) => n.id === elegido)
  if (!numero) throw new Error('No se eligió ningún número.')
  return numero
}

function siCancela(valor: unknown): void {
  if (p.isCancel(valor)) {
    p.cancel(MENSAJES.cancelado)
    process.exit(0)
  }
}

async function pedirTexto(mensaje: string, validar?: (v: string) => Resultado): Promise<string> {
  const valor = await p.text({
    message: mensaje,
    validate: validar
      ? (v: string | undefined) => {
          const r = validar(v ?? '')
          return r.ok ? undefined : r.motivo
        }
      : undefined,
  })
  siCancela(valor)
  return String(valor).trim()
}

/** Pide una credencial y no sigue hasta que la API la acepta. */
async function pedirCredencial(
  mensaje: string,
  validarFormato: (v: string) => Resultado,
  comprobar: (v: string) => Promise<{ ok: boolean; motivo?: string }>,
): Promise<string> {
  for (;;) {
    const valor = await pedirTexto(mensaje, validarFormato)
    const espera = p.spinner()
    espera.start('Comprobando')
    let resultado: { ok: boolean; motivo?: string }
    try {
      resultado = await comprobar(valor)
    } catch (err) {
      resultado = { ok: false, motivo: err instanceof Error ? err.message : String(err) }
    }
    espera.stop(resultado.ok ? 'Correcto' : 'No sirve')
    if (resultado.ok) return valor
    p.log.error(resultado.motivo ?? 'No se pudo validar.')
  }
}

export async function preguntarTodo(): Promise<Datos> {
  p.intro(MENSAJES.bienvenida)
  p.note(MENSAJES.antesDeEmpezar, 'Ten a mano')

  // El bot se instala aquí mismo: el alumno ya está parado en la carpeta que quiere.
  const carpeta = process.cwd()
  const nombreProyecto = nombreDeProyecto(carpeta)

  if (await carpetaOcupada(carpeta)) {
    p.log.warn(MENSAJES.carpetaOcupada(carpeta))
    const seguir = await p.confirm({ message: '¿Instalo aquí de todas formas?', initialValue: false })
    siCancela(seguir)
    if (!seguir) throw new Error(MENSAJES.carpetaOcupadaSalida)
  }

  p.log.info(`Instalo en ${carpeta}`)

  const supabaseUrl = await pedirTexto('URL de tu proyecto de Supabase', validarUrlSupabase)
  const publishableKey = await pedirTexto(
    'Clave publicable de Supabase (sb_publishable_…)',
    validarPublishableKey,
  )
  const secretKey = await pedirCredencial(
    'Clave secreta de Supabase (sb_secret_…)',
    validarSecretKey,
    (v) => comprobarSecretKey(supabaseUrl, v),
  )
  const pat = await pedirTexto('Clave de acceso personal de Supabase (sbp_…)', validarPat)

  const openaiKey = await pedirCredencial('API key de OpenAI', () => ({ ok: true }), comprobarKeyOpenai)

  const appId = await pedirTexto('Identificador de tu app de Meta')
  const appSecret = await pedirTexto('Clave secreta de tu app de Meta')
  const metaToken = await pedirCredencial(
    'Token permanente de Meta',
    () => ({ ok: true }),
    async (v) => {
      const r = await revisarToken(v)
      return r.valido && r.tieneActivos ? { ok: true } : { ok: false, motivo: r.motivo }
    },
  )

  const espera = p.spinner()
  espera.start('Buscando tu cuenta de WhatsApp')
  const wabas = await buscarWabas(metaToken)
  if (wabas.length === 0) {
    espera.stop('No encontré ninguna')
    throw new Error(MENSAJES.tokenSinActivos)
  }
  const wabaId = wabas[0]
  const numeros = await listarNumeros(metaToken, wabaId)
  espera.stop(`Encontré ${numeros.length} número(s)`)

  const numero = await elegirNumero(numeros, async (opciones) => {
    const elegido = await p.select({
      message: '¿Qué número va a usar el bot?',
      options: opciones.map((o) => ({ value: o.valor, label: o.etiqueta })),
    })
    siCancela(elegido)
    return String(elegido)
  })

  let pin: string | null = null
  if (numero.estado === 'PENDING') {
    p.log.warn(MENSAJES.avisoNumero)
    const seguir = await p.confirm({ message: `¿Registro el número ${numero.numero}?` })
    siCancela(seguir)
    if (!seguir) throw new Error('Sin registrar el número, el bot no puede recibir mensajes.')
    pin = await pedirTexto(
      'Elige un PIN de 6 dígitos (anótalo, te lo pedirán en el futuro)',
      validarPin,
    )
  }

  return {
    carpeta, nombreProyecto, supabaseUrl, publishableKey, secretKey, pat,
    openaiKey, appId, appSecret, metaToken,
    wabaId, numeroId: numero.id, pin, verifyToken: generarVerifyToken(),
  }
}
