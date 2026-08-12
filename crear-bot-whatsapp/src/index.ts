import * as p from '@clack/prompts'
import { MENSAJES, NODE_MINIMO } from './mensajes.js'
import { preguntarTodo } from './preguntas.js'
import { ejecutarPasos } from './pasos.js'

const mayor = Number(process.versions.node.split('.')[0])
if (mayor < NODE_MINIMO) {
  console.error(MENSAJES.nodeViejo(process.versions.node))
  process.exit(1)
}

try {
  const datos = await preguntarTodo()
  const resultado = await ejecutarPasos(datos, (texto) => p.log.step(texto))

  p.note(
    [
      `Panel:    ${resultado.urlPanel}`,
      `WhatsApp: ${resultado.enlaceWa}`,
      datos.pin ? `PIN del número: ${datos.pin}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    MENSAJES.listo,
  )
  p.outro(MENSAJES.pendiente)
} catch (err) {
  p.log.error(err instanceof Error ? err.message : String(err))
  p.outro(MENSAJES.seDetuvo)
  process.exit(1)
}
