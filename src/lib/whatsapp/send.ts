import { graphUrl } from '@/lib/whatsapp/constants'

async function leerError(res: { status: number; text: () => Promise<string> }): Promise<string> {
  const crudo = await res.text()
  try {
    const json = JSON.parse(crudo)
    return json?.error?.message ?? crudo
  } catch {
    return crudo || `HTTP ${res.status}`
  }
}

export async function sendWhatsAppText(input: {
  phoneNumberId: string
  token: string
  to: string
  text: string
}): Promise<{ waMessageId: string }> {
  const res = await fetch(graphUrl(`${input.phoneNumberId}/messages`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'text',
      text: { preview_url: false, body: input.text },
    }),
  })

  if (!res.ok) throw new Error(`Meta rechazó el envío: ${await leerError(res)}`)

  const json = JSON.parse(await res.text())
  return { waMessageId: json?.messages?.[0]?.id ?? '' }
}

export async function fetchPhoneNumberInfo(input: {
  phoneNumberId: string
  token: string
}): Promise<{ displayPhoneNumber: string; verifiedName: string }> {
  const url = `${graphUrl(input.phoneNumberId)}?fields=display_phone_number,verified_name`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${input.token}` } })
  if (!res.ok) throw new Error(await leerError(res))

  const json = JSON.parse(await res.text())
  return {
    displayPhoneNumber: json.display_phone_number ?? '',
    verifiedName: json.verified_name ?? '',
  }
}
