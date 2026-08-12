import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RAIZ_PLANTILLA, copiarPlantilla, escribirEnv, instalarDependencias } from './plantilla.js'
import { ejecutarSql, guardarConfig } from './api/supabase.js'
import { estadoNumero, registrarNumero, conectarAppAlWaba, configurarWebhook } from './api/meta.js'
import { estaLogueado, iniciarSesion, enlazarProyecto, cargarVariables, desplegar } from './api/vercel.js'
import { leerEstado, guardarEstado, marcarHecho, estaHecho, type Estado, type Paso } from './estado.js'
import { refDeSupabase } from './validar.js'

export type Datos = {
  carpeta: string
  nombreProyecto: string
  supabaseUrl: string
  publishableKey: string
  secretKey: string
  pat: string
  openaiKey: string
  appId: string
  appSecret: string
  metaToken: string
  wabaId: string
  numeroId: string
  pin: string | null
  verifyToken: string
}

export type Aviso = (texto: string) => void

function variablesDeEntorno(datos: Datos): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: datos.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: datos.publishableKey,
    SUPABASE_SECRET_KEY: datos.secretKey,
    OPENAI_API_KEY: datos.openaiKey,
  }
}

/**
 * El orden de estos pasos no es negociable: Meta llama a la URL del webhook
 * en el mismo instante en que se la configuramos, así que para entonces el
 * proyecto tiene que estar desplegado, con variables, y con el token de
 * verificación ya guardado en la base de datos.
 */
export async function ejecutarPasos(
  datos: Datos,
  avisar: Aviso,
): Promise<{ urlPanel: string; enlaceWa: string }> {
  let estado: Estado = await leerEstado(datos.carpeta)

  const hacer = async (
    paso: Paso,
    texto: string,
    accion: () => Promise<Record<string, string> | void>,
  ) => {
    if (estaHecho(estado, paso)) {
      avisar(`${texto} — ya estaba hecho, sigo`)
      return
    }
    avisar(texto)
    const datosNuevos = (await accion()) ?? {}
    estado = marcarHecho(estado, paso, datosNuevos)
    await guardarEstado(datos.carpeta, estado)
  }

  await hacer('plantilla', 'Copiando el proyecto e instalando dependencias', async () => {
    await copiarPlantilla(datos.carpeta)
    await escribirEnv(datos.carpeta, variablesDeEntorno(datos))
    await instalarDependencias(datos.carpeta)
  })

  await hacer('tablas', 'Creando las tablas en Supabase', async () => {
    const sql = await readFile(join(RAIZ_PLANTILLA, 'supabase/migrations/0001_init.sql'), 'utf8')
    await ejecutarSql(datos.pat, refDeSupabase(datos.supabaseUrl), sql)
  })

  const numero = await estadoNumero(datos.metaToken, datos.numeroId)

  await hacer('numero', 'Revisando el número en la Cloud API', async () => {
    if (numero.estado === 'PENDING' && datos.pin) {
      await registrarNumero(datos.metaToken, datos.numeroId, datos.pin)
    }
    return { numero: numero.numero }
  })

  await hacer('vercel', 'Desplegando en Vercel', async () => {
    // El login abre el navegador; sin él, `vercel link` falla con un error que no dice nada.
    if (!(await estaLogueado())) {
      avisar('Necesito que inicies sesión en Vercel: se abre tu navegador')
      await iniciarSesion()
    }
    await enlazarProyecto(datos.carpeta, datos.nombreProyecto)
    await cargarVariables(datos.carpeta, variablesDeEntorno(datos))
    const { url } = await desplegar(datos.carpeta)
    return { urlPanel: url }
  })

  const urlPanel = estado.datos.urlPanel
  if (!urlPanel) throw new Error('El despliegue no dejó ninguna URL guardada.')

  await hacer('config', 'Guardando la configuración de Meta en tu base de datos', async () => {
    await guardarConfig(datos.supabaseUrl, datos.secretKey, {
      verify_token: datos.verifyToken,
      phone_number_id: datos.numeroId,
      waba_id: datos.wabaId,
      meta_token: datos.metaToken,
      meta_app_secret: datos.appSecret,
    })
  })

  await hacer('webhook', 'Configurando el webhook en Meta', async () => {
    await configurarWebhook({
      appId: datos.appId,
      appSecret: datos.appSecret,
      url: `${urlPanel}/api/whatsapp/webhook`,
      verifyToken: datos.verifyToken,
    })
  })

  await hacer('waba', 'Conectando tu app a la cuenta de WhatsApp', async () => {
    await conectarAppAlWaba(datos.metaToken, datos.wabaId)
  })

  await hacer('comprobacion', 'Comprobando que el webhook responde', async () => {
    // La misma llamada que hace Meta para verificar. Si esto falla, el problema
    // está en el despliegue y no en Meta.
    const url =
      `${urlPanel}/api/whatsapp/webhook?hub.mode=subscribe` +
      `&hub.verify_token=${encodeURIComponent(datos.verifyToken)}&hub.challenge=prueba`
    const res = await fetch(url)
    const cuerpo = await res.text()
    if (!res.ok || cuerpo.trim() !== 'prueba') {
      throw new Error(
        `Tu webhook desplegado no respondió como debía (HTTP ${res.status}). ` +
          'Suele ser que el despliegue quedó sin variables de entorno.',
      )
    }
  })

  const soloDigitos = (estado.datos.numero ?? numero.numero).replace(/\D/g, '')

  return { urlPanel, enlaceWa: `https://wa.me/${soloDigitos}` }
}
