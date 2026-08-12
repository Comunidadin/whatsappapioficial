import 'server-only'

/**
 * El panel no pide sesión: es una herramienta interna que se abre directo.
 * Este hueco queda a propósito — cuando el panel se publique en internet,
 * aquí vuelve la comprobación de usuario y nada más cambia.
 */
export async function exigirSesion(): Promise<void> {
  return
}
