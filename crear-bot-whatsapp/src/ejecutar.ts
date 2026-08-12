import { spawn } from 'node:child_process'

export type Opciones = {
  cwd?: string
  /** Deja que el alumno vea la salida en vivo: hace falta cuando Vercel abre el navegador. */
  heredar?: boolean
  /** Texto que se le escribe al comando por la entrada estándar. */
  entrada?: string
}

export function ejecutar(
  comando: string,
  args: string[],
  opciones: Opciones = {},
): Promise<{ salida: string }> {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(comando, args, {
      cwd: opciones.cwd,
      stdio: opciones.heredar
        ? 'inherit'
        : [opciones.entrada === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    })

    if (opciones.entrada !== undefined) {
      hijo.stdin?.write(opciones.entrada)
      hijo.stdin?.end()
    }

    let salida = ''
    hijo.stdout?.on('data', (d) => {
      salida += String(d)
    })
    hijo.stderr?.on('data', (d) => {
      salida += String(d)
    })

    hijo.on('error', (err) =>
      rechazar(new Error(`No se pudo ejecutar ${comando}: ${err.message}`)),
    )
    hijo.on('close', (codigo) => {
      if (codigo === 0) return resolver({ salida })
      rechazar(new Error(`${comando} terminó con error (código ${codigo}).\n${salida.slice(-800)}`))
    })
  })
}
