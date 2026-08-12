import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Valida la cabecera X-Hub-Signature-256 de Meta.
 * El cuerpo debe ser el texto crudo, sin volver a serializar el JSON.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false
  if (!header.startsWith('sha256=')) return false

  const esperada = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const recibida = header.slice('sha256='.length)
  if (recibida.length !== esperada.length) return false

  return timingSafeEqual(Buffer.from(recibida, 'hex'), Buffer.from(esperada, 'hex'))
}
