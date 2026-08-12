import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Paso =
  | 'plantilla' | 'tablas' | 'numero' | 'config'
  | 'vercel' | 'webhook' | 'waba' | 'comprobacion'

export type Estado = { version: 1; hechos: Paso[]; datos: Record<string, string> }

const ARCHIVO = '.crear-bot.json'

/** Nada que huela a credencial entra en el archivo de estado. */
export const CLAVES_PROHIBIDAS = ['token', 'key', 'secret', 'pat', 'pin', 'password']

export async function leerEstado(carpeta: string): Promise<Estado> {
  try {
    const crudo = await readFile(join(carpeta, ARCHIVO), 'utf8')
    const leido = JSON.parse(crudo) as Estado
    return {
      version: 1,
      hechos: Array.isArray(leido.hechos) ? leido.hechos : [],
      datos: leido.datos ?? {},
    }
  } catch {
    return { version: 1, hechos: [], datos: {} }
  }
}

export async function guardarEstado(carpeta: string, estado: Estado): Promise<void> {
  for (const clave of Object.keys(estado.datos)) {
    const minuscula = clave.toLowerCase()
    if (CLAVES_PROHIBIDAS.some((p) => minuscula.includes(p))) {
      throw new Error(
        `No se guarda "${clave}": parece una credencial y esas van solo en .env.local`,
      )
    }
  }
  await writeFile(join(carpeta, ARCHIVO), JSON.stringify(estado, null, 2) + '\n', 'utf8')
}

export function marcarHecho(
  estado: Estado,
  paso: Paso,
  datos: Record<string, string> = {},
): Estado {
  return {
    version: 1,
    hechos: estado.hechos.includes(paso) ? estado.hechos : [...estado.hechos, paso],
    datos: { ...estado.datos, ...datos },
  }
}

export function estaHecho(estado: Estado, paso: Paso): boolean {
  return estado.hechos.includes(paso)
}
