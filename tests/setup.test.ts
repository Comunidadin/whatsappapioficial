import { describe, it, expect } from 'vitest'
import { GRAPH_VERSION, graphUrl } from '@/lib/whatsapp/constants'

describe('constantes de Graph API', () => {
  it('usa la versión v21.0', () => {
    expect(GRAPH_VERSION).toBe('v21.0')
  })

  it('arma la URL de envío de mensajes', () => {
    expect(graphUrl('123456/messages')).toBe('https://graph.facebook.com/v21.0/123456/messages')
  })
})
