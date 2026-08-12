export type ContactStatus = 'nuevo' | 'en_conversacion' | 'calificado' | 'atendido_humano'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageSender = 'contacto' | 'bot' | 'humano'
export type MessageType = 'text' | 'image' | 'audio' | 'other'
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

/** Franjas por día de la semana: "0" domingo … "6" sábado. */
export type BusinessHours = {
  enabled: boolean
  tz: string
  days: Record<string, [string, string][]>
}

export type BotConfig = {
  phone_number_id: string
  waba_id: string
  meta_token: string
  meta_app_secret: string
  verify_token: string
  bot_enabled: boolean
  bot_role: string
  system_prompt: string
  welcome_message: string
  business_hours: BusinessHours
  out_of_hours_message: string
  escalation_keywords: string[]
  openai_model: string
  updated_at: string
}

export type Contact = {
  id: string
  wa_id: string
  profile_name: string | null
  status: ContactStatus
  bot_paused: boolean
  needs_attention: boolean
  last_message_at: string
  created_at: string
}

export type Message = {
  id: string
  contact_id: string
  wa_message_id: string | null
  direction: MessageDirection
  sender: MessageSender
  type: MessageType
  body: string
  status: MessageStatus
  error: string | null
  created_at: string
}
