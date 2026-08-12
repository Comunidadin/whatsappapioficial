import { cp, writeFile, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ejecutar } from './ejecutar.js'

export const RAIZ_PLANTILLA = join(dirname(fileURLToPath(import.meta.url)), '..', 'plantilla')

export async function copiarPlantilla(destino: string): Promise<void> {
  await cp(RAIZ_PLANTILLA, destino, { recursive: true })
}

/**
 * ¿Hay ya un proyecto instalado aquí? Se mira antes de copiar encima:
 * correr el comando en la carpeta equivocada no debería borrarle el trabajo a nadie.
 */
export async function carpetaOcupada(destino: string): Promise<boolean> {
  const señales = ['package.json', 'src']
  for (const señal of señales) {
    try {
      await stat(join(destino, señal))
      return true
    } catch {
      // No está: seguimos mirando.
    }
  }
  return false
}

export async function escribirEnv(
  destino: string,
  variables: Record<string, string>,
): Promise<void> {
  const contenido = Object.entries(variables).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  await writeFile(join(destino, '.env.local'), contenido, 'utf8')
}

export async function instalarDependencias(destino: string): Promise<void> {
  await ejecutar('npm', ['install'], { cwd: destino, heredar: true })
}
