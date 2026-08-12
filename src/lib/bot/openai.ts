import 'server-only'
import OpenAI from 'openai'
import type { ChatMessage } from '@/lib/bot/prompt'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY')
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

async function llamar(messages: ChatMessage[], model: string): Promise<string> {
  const res = await getClient().chat.completions.create({
    model,
    messages,
    max_tokens: 500,
    temperature: 0.7,
  })
  const texto = res.choices?.[0]?.message?.content ?? ''
  if (texto.trim() === '') throw new Error('OpenAI devolvió una respuesta vacía')
  return texto.trim()
}

/** Un reintento y a la cárcel: si falla dos veces, el llamador marca el chat como "requiere atención". */
export async function generateReply(
  messages: ChatMessage[],
  opts: { model: string },
): Promise<string> {
  try {
    return await llamar(messages, opts.model)
  } catch (primerError) {
    if (primerError instanceof Error && primerError.message.includes('respuesta vacía')) {
      throw primerError
    }
    return await llamar(messages, opts.model)
  }
}
