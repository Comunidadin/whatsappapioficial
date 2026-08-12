import { MENSAJES, NODE_MINIMO } from './mensajes.js'

const mayor = Number(process.versions.node.split('.')[0])
if (mayor < NODE_MINIMO) {
  console.error(MENSAJES.nodeViejo(process.versions.node))
  process.exit(1)
}

console.log(MENSAJES.bienvenida)
