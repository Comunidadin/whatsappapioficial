import { ejecutar, type Opciones } from '../ejecutar.js'

const VERCEL = ['--yes', 'vercel@latest']

function vercel(args: string[], opciones: Opciones = {}) {
  return ejecutar('npx', [...VERCEL, ...args], opciones)
}

export async function hayVercel(): Promise<boolean> {
  try {
    await vercel(['--version'])
    return true
  } catch {
    return false
  }
}

export async function estaLogueado(): Promise<boolean> {
  try {
    const { salida } = await vercel(['whoami'])
    return salida.trim() !== ''
  } catch {
    return false
  }
}

export async function iniciarSesion(): Promise<void> {
  await vercel(['login'], { heredar: true })
}

export async function enlazarProyecto(carpeta: string, nombre: string): Promise<void> {
  await vercel(['link', '--yes', '--project', nombre], { cwd: carpeta })
}

/**
 * El valor viaja por la entrada estándar, no por la línea de comandos:
 * así no queda en el historial del shell ni se rompe con comillas o espacios.
 */
export async function cargarVariables(
  carpeta: string,
  variables: Record<string, string>,
): Promise<void> {
  for (const [clave, valor] of Object.entries(variables)) {
    await vercel(['env', 'add', clave, 'production', '--force'], {
      cwd: carpeta,
      entrada: valor,
    })
  }
}

export async function desplegar(carpeta: string): Promise<{ url: string }> {
  const { salida } = await vercel(['deploy', '--prod', '--yes'], { cwd: carpeta })
  const urls = salida.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) ?? []
  if (urls.length === 0) {
    throw new Error('Vercel no devolvió ninguna URL. Revisa la salida del despliegue.')
  }
  return { url: urls[urls.length - 1] }
}
