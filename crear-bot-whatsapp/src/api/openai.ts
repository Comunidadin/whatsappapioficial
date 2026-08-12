export async function comprobarKeyOpenai(key: string): Promise<{ ok: boolean; motivo?: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ok' }],
      max_tokens: 5,
    }),
  })

  if (res.ok) return { ok: true }

  if (res.status === 401) {
    return {
      ok: false,
      motivo: 'Esa key de OpenAI no es válida. Cópiala otra vez desde platform.openai.com.',
    }
  }
  if (res.status === 429) {
    return {
      ok: false,
      motivo:
        'La key es correcta pero la cuenta no tiene saldo. Carga crédito en platform.openai.com y vuelve a intentarlo.',
    }
  }
  return { ok: false, motivo: `OpenAI respondió HTTP ${res.status}.` }
}
