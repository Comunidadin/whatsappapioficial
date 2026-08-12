import { cp, rm, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const panel = join(aqui, '..', '..') // [Bot Clase]
const destino = join(aqui, '..', 'plantilla')

const EXCLUIR = new Set([
  'node_modules', '.next', '.git', '.vercel', 'dist',
  'crear-bot-whatsapp', 'docs', '.crear-bot.json', '.DS_Store',
])

await rm(destino, { recursive: true, force: true })

for (const entrada of await readdir(panel, { withFileTypes: true })) {
  if (EXCLUIR.has(entrada.name)) continue
  // Nunca copiar credenciales; el .env.example sí, que es la plantilla vacía.
  if (entrada.name.startsWith('.env') && entrada.name !== '.env.example') continue
  await cp(join(panel, entrada.name), join(destino, entrada.name), { recursive: true })
}

console.log('plantilla sincronizada')
