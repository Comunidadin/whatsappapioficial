import { getConfig } from '@/lib/db/config'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge') ?? ''

  const config = await getConfig()
  const expected = config.verify_token

  if (mode === 'subscribe' && expected !== '' && token === expected) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}
