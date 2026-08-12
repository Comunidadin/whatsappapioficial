# Bot de WhatsApp con panel — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un panel web que conecta un número de WhatsApp (Cloud API de Meta) con un bot que responde usando OpenAI, con inbox en vivo, configuración del bot y lista de leads.

**Architecture:** Monolito Next.js (App Router) desplegado en Vercel. El endpoint `/api/whatsapp/webhook` recibe los mensajes de Meta, valida la firma, guarda contacto y mensaje en Supabase, responde `200` inmediatamente y procesa la respuesta en segundo plano con `after()`. La lógica pura (parseo, reglas, prompt) vive en módulos sin dependencias de red para poder testearla; la persistencia y las APIs externas se aíslan en módulos delgados.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS v4, Supabase (Postgres + Auth + Realtime), OpenAI (`openai` npm), Vitest, npm, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-12-bot-whatsapp-cloud-design.md`

## Global Constraints

- Idioma de toda la interfaz y de los mensajes al usuario final: **español**.
- Un solo número de WhatsApp, un solo usuario del panel. Nada de multi-tenant.
- Gestor de paquetes: **npm**. Tests: **Vitest**.
- Versión de la Graph API de Meta: **`v21.0`**, fijada en una constante única.
- Credenciales de Meta (token, app secret, phone number id, waba id, verify token) viven en la tabla `config` de Supabase y **solo se leen desde el servidor** con la secret key.
- `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY` son variables de entorno del servidor. Nunca con prefijo `NEXT_PUBLIC_`.
- El proyecto de Supabase usa el **esquema nuevo de keys**: `sb_publishable_…` (navegador) y `sb_secret_…` (servidor, salta RLS), no las antiguas anon/service_role.
- RLS activo en todas las tablas. `config` y `webhook_events` no tienen políticas para `authenticated`: se leen solo con la secret key desde el servidor.
- Todo texto que ve el usuario final por WhatsApp sale de `config`, no hardcodeado en el código.
- Commits en español, formato `feat:` / `fix:` / `test:` / `chore:`.
- Directorio de trabajo: `/Users/joffrellerena/Desktop/[Bot Clase]`. El repo git está en `/Users/joffrellerena` — al hacer `git add`, usar siempre rutas explícitas de este proyecto, nunca `git add -A`.

## Credenciales necesarias (pedirlas al usuario antes de la Tarea 2)

- Supabase (proyecto `nxieepcukyekvcticrqo`):
  - `NEXT_PUBLIC_SUPABASE_URL=https://nxieepcukyekvcticrqo.supabase.co` — sin `/rest/v1/`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AMJG3eKfidaRvKPru-yoBQ_LzJeTN2E`
  - `SUPABASE_SECRET_KEY=sb_secret_…` — pendiente de que el usuario la revele en Settings → API Keys
- OpenAI: `OPENAI_API_KEY`
- Meta (se pegan en el panel, no en `.env`): Phone Number ID, WABA ID, token permanente, App Secret
- Repositorio: `https://github.com/Comunidadin/whatsappapioficial.git` (remoto `origin`, rama `main`)

---

## Estructura de archivos

```
src/
  app/
    layout.tsx                      # html/body + Tailwind
    page.tsx                        # redirige a /inbox
    login/page.tsx                  # login (Supabase Auth)
    (panel)/layout.tsx              # navegación lateral + guardia de sesión
    (panel)/conexion/page.tsx
    (panel)/inbox/page.tsx
    (panel)/bot/page.tsx
    (panel)/leads/page.tsx
    api/whatsapp/webhook/route.ts   # GET verificación + POST ingesta
  components/
    inbox/chat-list.tsx
    inbox/thread.tsx                # cliente, Realtime
    bot/bot-form.tsx
    conexion/conexion-form.tsx
    leads/leads-table.tsx
  actions/
    config.ts                       # guardar config, probar conexión
    inbox.ts                        # responder a mano, pausar bot
    leads.ts                        # cambiar estado del lead
    bot.ts                          # probador del bot
  lib/
    types.ts                        # tipos compartidos
    supabase/admin.ts               # cliente secret key (servidor)
    supabase/server.ts              # cliente con cookies (servidor, sesión)
    supabase/client.ts              # cliente de navegador
    whatsapp/constants.ts           # GRAPH_VERSION
    whatsapp/signature.ts           # verificación HMAC
    whatsapp/parse.ts               # payload -> mensajes/estados
    whatsapp/send.ts                # envío de texto a Meta
    bot/rules.ts                    # decideBotAction, isWithinHours, matchEscalation
    bot/prompt.ts                   # buildChatMessages
    bot/openai.ts                   # generateReply
    bot/roles.ts                    # prompts base por rol
    bot/handle-inbound.ts           # orquestador
    db/config.ts  db/contacts.ts  db/messages.ts  db/events.ts
  middleware.ts                     # refresco de sesión + protección de rutas
supabase/migrations/0001_init.sql
tests/
  whatsapp/signature.test.ts  whatsapp/parse.test.ts  whatsapp/send.test.ts
  bot/rules.test.ts  bot/prompt.test.ts  bot/openai.test.ts  bot/handle-inbound.test.ts
  api/webhook.test.ts
scripts/check-db.ts
```

---

### Task 1: Andamiaje del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `src/lib/whatsapp/constants.ts`
- Test: `tests/setup.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `GRAPH_VERSION: string` (`'v21.0'`) desde `src/lib/whatsapp/constants.ts`; scripts npm `dev`, `build`, `test`.

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*" --yes
```

Si `create-next-app` se queja de que el directorio no está vacío por `docs/`, responder que sí, continuar.

- [ ] **Step 2: Instalar dependencias**

```bash
npm install @supabase/supabase-js @supabase/ssr openai
npm install -D vitest
```

- [ ] **Step 3: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

Añadir a `package.json` en `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Escribir el test de arranque**

Crear `src/lib/whatsapp/constants.ts` vacío y `tests/setup.test.ts`:

```ts
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
```

- [ ] **Step 5: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `GRAPH_VERSION` no está exportado.

- [ ] **Step 6: Implementar las constantes**

`src/lib/whatsapp/constants.ts`:

```ts
export const GRAPH_VERSION = 'v21.0'

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`
}
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS (2 tests)

- [ ] **Step 8: Crear `.env.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
APP_BASE_URL=http://localhost:3000
```

Verificar que `.gitignore` incluye `.env*` y `node_modules`.

- [ ] **Step 9: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .env.example .gitignore src tests
git commit -m "chore: andamiaje Next.js con Tailwind y Vitest"
```

---

### Task 2: Esquema de base de datos y clientes de Supabase

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `src/lib/types.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- Create: `scripts/check-db.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Tipos: `BotConfig`, `Contact`, `Message`, `ContactStatus`, `MessageDirection`, `MessageSender`, `MessageStatus`, `MessageType`, `BusinessHours`.
  - `supabaseAdmin(): SupabaseClient` — cliente con la secret key, solo servidor.
  - `supabaseServer(): Promise<SupabaseClient>` — cliente con cookies para sesión.
  - `supabaseBrowser(): SupabaseClient` — cliente de navegador.

- [ ] **Step 1: Escribir la migración**

`supabase/migrations/0001_init.sql`:

```sql
create table if not exists config (
  id boolean primary key default true check (id),
  phone_number_id text default '',
  waba_id text default '',
  meta_token text default '',
  meta_app_secret text default '',
  verify_token text default '',
  bot_enabled boolean not null default false,
  bot_role text not null default 'ventas',
  system_prompt text not null default '',
  welcome_message text not null default '',
  business_hours jsonb not null default '{"enabled":false,"tz":"America/Guayaquil","days":{}}'::jsonb,
  out_of_hours_message text not null default '',
  escalation_keywords text[] not null default '{}',
  openai_model text not null default 'gpt-4o-mini',
  updated_at timestamptz not null default now()
);

insert into config (id) values (true) on conflict (id) do nothing;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  profile_name text,
  status text not null default 'nuevo'
    check (status in ('nuevo','en_conversacion','calificado','atendido_humano')),
  bot_paused boolean not null default false,
  needs_attention boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  wa_message_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  sender text not null check (sender in ('contacto','bot','humano')),
  type text not null default 'text' check (type in ('text','image','audio','other')),
  body text not null default '',
  status text not null default 'pending'
    check (status in ('pending','sent','delivered','read','failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists messages_contact_created_idx on messages (contact_id, created_at desc);
create index if not exists contacts_last_message_idx on contacts (last_message_at desc);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  ok boolean not null,
  detail text not null default ''
);

create index if not exists webhook_events_received_idx on webhook_events (received_at desc);

alter table config enable row level security;
alter table contacts enable row level security;
alter table messages enable row level security;
alter table webhook_events enable row level security;

-- El panel (usuario logueado) lee contactos y mensajes; el resto pasa por el servidor.
create policy "auth lee contactos" on contacts for select to authenticated using (true);
create policy "auth lee mensajes"  on messages for select to authenticated using (true);

-- config y webhook_events: sin políticas. Solo la secret key (que salta RLS).

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table contacts;
```

- [ ] **Step 2: Aplicar la migración en el proyecto de Supabase del usuario**

Pegar el SQL en el editor SQL del proyecto (o `execute_sql` del MCP de Supabase). Después, en el dashboard, verificar que las 4 tablas existen y que `config` tiene exactamente una fila.

- [ ] **Step 3: Escribir los tipos compartidos**

`src/lib/types.ts`:

```ts
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
```

- [ ] **Step 4: Escribir los clientes de Supabase**

`src/lib/supabase/admin.ts`:

```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Cliente con la secret key: salta RLS. Nunca importar desde un componente cliente. */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY')
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}
```

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Llamado desde un Server Component: el middleware refresca la sesión.
          }
        },
      },
    },
  )
}
```

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
```

Instalar el guard de servidor: `npm install server-only`.

- [ ] **Step 5: Escribir el script de verificación**

`scripts/check-db.ts`:

```ts
import { supabaseAdmin } from '../src/lib/supabase/admin'

async function main() {
  const db = supabaseAdmin()
  const { data: config, error: e1 } = await db.from('config').select('*').single()
  if (e1) throw e1
  console.log('config ok, modelo:', config.openai_model)

  const { data: contact, error: e2 } = await db
    .from('contacts')
    .upsert({ wa_id: '000_prueba', profile_name: 'Prueba' }, { onConflict: 'wa_id' })
    .select()
    .single()
  if (e2) throw e2
  console.log('contacto ok:', contact.id)

  const { error: e3 } = await db.from('messages').insert({
    contact_id: contact.id, wa_message_id: 'wamid.prueba', direction: 'inbound',
    sender: 'contacto', body: 'hola',
  })
  if (e3) throw e3

  const { error: e4 } = await db.from('messages').insert({
    contact_id: contact.id, wa_message_id: 'wamid.prueba', direction: 'inbound',
    sender: 'contacto', body: 'hola otra vez',
  })
  console.log('duplicado rechazado:', e4?.code === '23505' ? 'sí' : 'NO — revisar índice único')

  await db.from('contacts').delete().eq('wa_id', '000_prueba')
  console.log('limpieza lista')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 6: Correr el script de verificación**

Crear `.env.local` con las credenciales reales del usuario, luego:

Run: `npx tsx scripts/check-db.ts` (instalar con `npm install -D tsx` si hace falta)
Expected: imprime `config ok`, `contacto ok`, `duplicado rechazado: sí`, `limpieza lista`.

Si el duplicado NO se rechaza, el índice único no se aplicó: revisar el paso 2 antes de seguir. Todo el anti-duplicados depende de esto.

- [ ] **Step 7: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add supabase src/lib/types.ts src/lib/supabase scripts package.json package-lock.json
git commit -m "feat: esquema de Supabase, tipos y clientes"
```

---

### Task 3: Verificación del webhook (GET)

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`
- Create: `src/lib/db/config.ts`
- Test: `tests/api/webhook.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin()`, `BotConfig`.
- Produces:
  - `getConfig(): Promise<BotConfig>` y `updateConfig(patch: Partial<BotConfig>): Promise<void>` desde `@/lib/db/config`.
  - `GET(request: Request): Promise<Response>` en la ruta del webhook.

- [ ] **Step 1: Escribir el test que falla**

`tests/api/webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/config', () => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}))

import { getConfig } from '@/lib/db/config'
import { GET } from '@/app/api/whatsapp/webhook/route'

const config = { verify_token: 'mi-token-secreto' }

describe('GET /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockResolvedValue(config as never)
  })

  it('devuelve el challenge cuando el verify token coincide', async () => {
    const url = 'https://x.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=mi-token-secreto&hub.challenge=12345'
    const res = await GET(new Request(url))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('12345')
  })

  it('rechaza con 403 si el verify token no coincide', async () => {
    const url = 'https://x.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=12345'
    const res = await GET(new Request(url))
    expect(res.status).toBe(403)
  })

  it('rechaza con 403 si el verify token está vacío en la config', async () => {
    vi.mocked(getConfig).mockResolvedValue({ verify_token: '' } as never)
    const url = 'https://x.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=12345'
    const res = await GET(new Request(url))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/api/webhook.test.ts`
Expected: FAIL — no existe el módulo de la ruta.

- [ ] **Step 3: Implementar `getConfig` / `updateConfig`**

`src/lib/db/config.ts`:

```ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { BotConfig } from '@/lib/types'

export async function getConfig(): Promise<BotConfig> {
  const { data, error } = await supabaseAdmin().from('config').select('*').single()
  if (error) throw new Error(`No se pudo leer la config: ${error.message}`)
  return data as BotConfig
}

export async function updateConfig(patch: Partial<BotConfig>): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw new Error(`No se pudo guardar la config: ${error.message}`)
}
```

- [ ] **Step 4: Implementar el GET de la ruta**

`src/app/api/whatsapp/webhook/route.ts`:

```ts
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
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- tests/api/webhook.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/app/api/whatsapp/webhook/route.ts src/lib/db/config.ts tests/api/webhook.test.ts
git commit -m "feat: verificación del webhook de Meta"
```

---

### Task 4: Validación de la firma HMAC

**Files:**
- Create: `src/lib/whatsapp/signature.ts`
- Test: `tests/whatsapp/signature.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `verifySignature(rawBody: string, header: string | null, appSecret: string): boolean`.

- [ ] **Step 1: Escribir el test que falla**

`tests/whatsapp/signature.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifySignature } from '@/lib/whatsapp/signature'

const secret = 'app-secret-de-prueba'
const body = JSON.stringify({ object: 'whatsapp_business_account' })
const firma = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

describe('verifySignature', () => {
  it('acepta una firma correcta', () => {
    expect(verifySignature(body, firma, secret)).toBe(true)
  })

  it('rechaza una firma alterada', () => {
    const mala = firma.slice(0, -1) + (firma.endsWith('a') ? 'b' : 'a')
    expect(verifySignature(body, mala, secret)).toBe(false)
  })

  it('rechaza si el cuerpo cambió', () => {
    expect(verifySignature(body + ' ', firma, secret)).toBe(false)
  })

  it('rechaza si no hay cabecera', () => {
    expect(verifySignature(body, null, secret)).toBe(false)
  })

  it('rechaza si no hay app secret configurado', () => {
    expect(verifySignature(body, firma, '')).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/whatsapp/signature.test.ts`
Expected: FAIL — `verifySignature` no existe.

- [ ] **Step 3: Implementar**

`src/lib/whatsapp/signature.ts`:

```ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/whatsapp/signature.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/whatsapp/signature.ts tests/whatsapp/signature.test.ts
git commit -m "feat: validación de firma del webhook"
```

---

### Task 5: Parseo del payload de Meta

**Files:**
- Create: `src/lib/whatsapp/parse.ts`
- Test: `tests/whatsapp/parse.test.ts`

**Interfaces:**
- Consumes: `MessageType`, `MessageStatus` de `@/lib/types`.
- Produces:
  - `type InboundMessage = { waMessageId: string; from: string; profileName: string | null; type: MessageType; body: string }`
  - `type StatusUpdate = { waMessageId: string; status: MessageStatus; error: string | null }`
  - `type ParsedWebhook = { messages: InboundMessage[]; statuses: StatusUpdate[] }`
  - `parseWebhook(payload: unknown): ParsedWebhook`

- [ ] **Step 1: Escribir el test que falla**

`tests/whatsapp/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseWebhook } from '@/lib/whatsapp/parse'

const mensajeTexto = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '111',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '593999', phone_number_id: '222' },
        contacts: [{ profile: { name: 'Ana' }, wa_id: '593987654321' }],
        messages: [{ from: '593987654321', id: 'wamid.AAA', timestamp: '1754000000', type: 'text', text: { body: 'Hola, ¿cuánto cuesta?' } }],
      },
    }],
  }],
}

const mensajeAudio = {
  object: 'whatsapp_business_account',
  entry: [{ id: '111', changes: [{ field: 'messages', value: {
    contacts: [{ profile: { name: 'Luis' }, wa_id: '593911111111' }],
    messages: [{ from: '593911111111', id: 'wamid.BBB', timestamp: '1754000001', type: 'audio', audio: { id: 'media-1' } }],
  } }] }],
}

const estado = {
  object: 'whatsapp_business_account',
  entry: [{ id: '111', changes: [{ field: 'messages', value: {
    statuses: [{ id: 'wamid.CCC', status: 'delivered', timestamp: '1754000002', recipient_id: '593987654321' }],
  } }] }],
}

const estadoFallido = {
  object: 'whatsapp_business_account',
  entry: [{ id: '111', changes: [{ field: 'messages', value: {
    statuses: [{ id: 'wamid.DDD', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] }],
  } }] }],
}

describe('parseWebhook', () => {
  it('extrae un mensaje de texto', () => {
    const r = parseWebhook(mensajeTexto)
    expect(r.messages).toEqual([{
      waMessageId: 'wamid.AAA', from: '593987654321', profileName: 'Ana',
      type: 'text', body: 'Hola, ¿cuánto cuesta?',
    }])
    expect(r.statuses).toEqual([])
  })

  it('marca los audios como tipo audio con cuerpo vacío', () => {
    const r = parseWebhook(mensajeAudio)
    expect(r.messages[0].type).toBe('audio')
    expect(r.messages[0].body).toBe('')
  })

  it('extrae actualizaciones de estado', () => {
    expect(parseWebhook(estado).statuses).toEqual([
      { waMessageId: 'wamid.CCC', status: 'delivered', error: null },
    ])
  })

  it('incluye el error en los estados fallidos', () => {
    const s = parseWebhook(estadoFallido).statuses[0]
    expect(s.status).toBe('failed')
    expect(s.error).toContain('131047')
  })

  it('devuelve listas vacías ante un payload desconocido', () => {
    expect(parseWebhook({ hola: 'mundo' })).toEqual({ messages: [], statuses: [] })
    expect(parseWebhook(null)).toEqual({ messages: [], statuses: [] })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/whatsapp/parse.test.ts`
Expected: FAIL — `parseWebhook` no existe.

- [ ] **Step 3: Implementar**

`src/lib/whatsapp/parse.ts`:

```ts
import type { MessageStatus, MessageType } from '@/lib/types'

export type InboundMessage = {
  waMessageId: string
  from: string
  profileName: string | null
  type: MessageType
  body: string
}

export type StatusUpdate = {
  waMessageId: string
  status: MessageStatus
  error: string | null
}

export type ParsedWebhook = { messages: InboundMessage[]; statuses: StatusUpdate[] }

const TIPOS: Record<string, MessageType> = { text: 'text', image: 'image', audio: 'audio' }
const ESTADOS: Record<string, MessageStatus> = {
  sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed',
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function parseWebhook(payload: unknown): ParsedWebhook {
  const messages: InboundMessage[] = []
  const statuses: StatusUpdate[] = []
  const entries = asArray((payload as { entry?: unknown })?.entry)

  for (const entry of entries) {
    for (const change of asArray((entry as { changes?: unknown })?.changes)) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {}
      const contactos = asArray(value.contacts) as { wa_id?: string; profile?: { name?: string } }[]

      for (const raw of asArray(value.messages) as Record<string, unknown>[]) {
        const from = String(raw.from ?? '')
        const contacto = contactos.find((c) => c.wa_id === from) ?? contactos[0]
        const tipo = TIPOS[String(raw.type)] ?? 'other'
        const body = tipo === 'text'
          ? String((raw.text as { body?: string })?.body ?? '')
          : ''

        messages.push({
          waMessageId: String(raw.id ?? ''),
          from,
          profileName: contacto?.profile?.name ?? null,
          type: tipo,
          body,
        })
      }

      for (const raw of asArray(value.statuses) as Record<string, unknown>[]) {
        const errores = asArray(raw.errors) as { code?: number; title?: string }[]
        statuses.push({
          waMessageId: String(raw.id ?? ''),
          status: ESTADOS[String(raw.status)] ?? 'sent',
          error: errores.length
            ? errores.map((e) => `${e.code ?? ''} ${e.title ?? ''}`.trim()).join('; ')
            : null,
        })
      }
    }
  }

  return { messages, statuses }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/whatsapp/parse.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/whatsapp/parse.ts tests/whatsapp/parse.test.ts
git commit -m "feat: parseo del payload del webhook"
```

---

### Task 6: Reglas de silencio del bot

**Files:**
- Create: `src/lib/bot/rules.ts`
- Test: `tests/bot/rules.test.ts`

**Interfaces:**
- Consumes: `BotConfig`, `Contact`, `BusinessHours`; `InboundMessage` de `@/lib/whatsapp/parse`.
- Produces:
  - `type BotDecision = { action: 'ai'; welcome: string | null } | { action: 'canned'; text: string } | { action: 'silent'; reason: string; needsAttention: boolean }`
  - `decideBotAction(input: { config: BotConfig; contact: Contact; isNewContact: boolean; message: InboundMessage; now: Date }): BotDecision`
  - `isWithinHours(hours: BusinessHours, now: Date): boolean`
  - `matchEscalation(text: string, keywords: string[]): boolean`

- [ ] **Step 1: Escribir el test que falla**

`tests/bot/rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decideBotAction, isWithinHours, matchEscalation } from '@/lib/bot/rules'
import type { BotConfig, Contact } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'

const config: BotConfig = {
  phone_number_id: '1', waba_id: '1', meta_token: 't', meta_app_secret: 's', verify_token: 'v',
  bot_enabled: true, bot_role: 'ventas', system_prompt: 'Eres un asesor.',
  welcome_message: '¡Hola! Soy el asistente.',
  business_hours: { enabled: false, tz: 'America/Guayaquil', days: {} },
  out_of_hours_message: 'Estamos fuera de horario, te respondemos mañana.',
  escalation_keywords: ['asesor', 'humano'],
  openai_model: 'gpt-4o-mini', updated_at: '',
}

const contact: Contact = {
  id: 'c1', wa_id: '593987654321', profile_name: 'Ana', status: 'en_conversacion',
  bot_paused: false, needs_attention: false, last_message_at: '', created_at: '',
}

const mensaje: InboundMessage = {
  waMessageId: 'wamid.1', from: '593987654321', profileName: 'Ana',
  type: 'text', body: '¿Cuánto cuesta?',
}

const ahora = new Date('2026-08-12T15:00:00Z') // 10:00 en Guayaquil (UTC-5)
const base = { config, contact, isNewContact: false, message: mensaje, now: ahora }

describe('matchEscalation', () => {
  it('detecta la palabra clave sin importar mayúsculas ni tildes del texto', () => {
    expect(matchEscalation('Quiero hablar con un ASESOR', ['asesor'])).toBe(true)
  })
  it('no detecta si no aparece', () => {
    expect(matchEscalation('¿cuánto cuesta?', ['asesor', 'humano'])).toBe(false)
  })
  it('ignora una lista vacía', () => {
    expect(matchEscalation('asesor', [])).toBe(false)
  })
})

describe('isWithinHours', () => {
  const horario = {
    enabled: true, tz: 'America/Guayaquil',
    days: { '3': [['09:00', '18:00']] as [string, string][] }, // miércoles
  }
  it('acepta dentro de la franja', () => {
    expect(isWithinHours(horario, new Date('2026-08-12T15:00:00Z'))).toBe(true)
  })
  it('rechaza fuera de la franja', () => {
    expect(isWithinHours(horario, new Date('2026-08-12T04:00:00Z'))).toBe(false)
  })
  it('rechaza un día sin franjas', () => {
    expect(isWithinHours(horario, new Date('2026-08-16T15:00:00Z'))).toBe(false)
  })
  it('siempre acepta si el horario está desactivado', () => {
    expect(isWithinHours({ enabled: false, tz: 'America/Guayaquil', days: {} }, ahora)).toBe(true)
  })
})

describe('decideBotAction', () => {
  it('responde con IA en el caso normal', () => {
    expect(decideBotAction(base)).toEqual({ action: 'ai', welcome: null })
  })

  it('incluye la bienvenida si el contacto es nuevo', () => {
    expect(decideBotAction({ ...base, isNewContact: true }))
      .toEqual({ action: 'ai', welcome: '¡Hola! Soy el asistente.' })
  })

  it('calla si el bot global está apagado', () => {
    const d = decideBotAction({ ...base, config: { ...config, bot_enabled: false } })
    expect(d).toEqual({ action: 'silent', reason: 'bot_apagado', needsAttention: false })
  })

  it('calla si el chat está pausado', () => {
    const d = decideBotAction({ ...base, contact: { ...contact, bot_paused: true } })
    expect(d).toEqual({ action: 'silent', reason: 'chat_pausado', needsAttention: false })
  })

  it('calla y marca atención ante una palabra clave de escalamiento', () => {
    const d = decideBotAction({ ...base, message: { ...mensaje, body: 'quiero un asesor' } })
    expect(d).toEqual({ action: 'silent', reason: 'escalado', needsAttention: true })
  })

  it('manda el mensaje fuera de horario', () => {
    const config2 = {
      ...config,
      business_hours: { enabled: true, tz: 'America/Guayaquil', days: { '3': [['09:00', '10:00']] as [string, string][] } },
    }
    const d = decideBotAction({ ...base, config: config2, now: new Date('2026-08-12T20:00:00Z') })
    expect(d).toEqual({ action: 'canned', text: 'Estamos fuera de horario, te respondemos mañana.' })
  })

  it('pide texto ante un audio', () => {
    const d = decideBotAction({ ...base, message: { ...mensaje, type: 'audio', body: '' } })
    expect(d).toEqual({
      action: 'canned',
      text: 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?',
    })
  })

  it('el escalamiento gana sobre el fuera de horario', () => {
    const config2 = {
      ...config,
      business_hours: { enabled: true, tz: 'America/Guayaquil', days: {} },
    }
    const d = decideBotAction({ ...base, config: config2, message: { ...mensaje, body: 'un humano por favor' } })
    expect(d).toEqual({ action: 'silent', reason: 'escalado', needsAttention: true })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/bot/rules.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

`src/lib/bot/rules.ts`:

```ts
import type { BotConfig, BusinessHours, Contact } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'

export const TEXTO_SOLO_TEXTO =
  'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?'

export type BotDecision =
  | { action: 'ai'; welcome: string | null }
  | { action: 'canned'; text: string }
  | { action: 'silent'; reason: string; needsAttention: boolean }

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function matchEscalation(text: string, keywords: string[]): boolean {
  const cuerpo = normalizar(text)
  return keywords.some((k) => k.trim() !== '' && cuerpo.includes(normalizar(k)))
}

/** Hora local en la zona indicada, como minutos desde medianoche, y día de la semana (0 = domingo). */
function horaLocal(tz: string, now: Date): { minutos: number; dia: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
  const partes = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const dias: Record<string, string> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' }
  const hora = Number(partes.hour === '24' ? '0' : partes.hour)
  return { minutos: hora * 60 + Number(partes.minute), dia: dias[partes.weekday] ?? '0' }
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function isWithinHours(hours: BusinessHours, now: Date): boolean {
  if (!hours?.enabled) return true
  const { minutos, dia } = horaLocal(hours.tz || 'UTC', now)
  const franjas = hours.days?.[dia] ?? []
  return franjas.some(([desde, hasta]) => minutos >= aMinutos(desde) && minutos < aMinutos(hasta))
}

export function decideBotAction(input: {
  config: BotConfig
  contact: Contact
  isNewContact: boolean
  message: InboundMessage
  now: Date
}): BotDecision {
  const { config, contact, isNewContact, message, now } = input

  if (!config.bot_enabled) return { action: 'silent', reason: 'bot_apagado', needsAttention: false }
  if (contact.bot_paused) return { action: 'silent', reason: 'chat_pausado', needsAttention: false }

  if (matchEscalation(message.body, config.escalation_keywords)) {
    return { action: 'silent', reason: 'escalado', needsAttention: true }
  }

  if (!isWithinHours(config.business_hours, now)) {
    return { action: 'canned', text: config.out_of_hours_message }
  }

  if (message.type !== 'text' || message.body.trim() === '') {
    return { action: 'canned', text: TEXTO_SOLO_TEXTO }
  }

  return { action: 'ai', welcome: isNewContact ? config.welcome_message || null : null }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/bot/rules.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/bot/rules.ts tests/bot/rules.test.ts
git commit -m "feat: reglas de silencio y horario del bot"
```

---

### Task 7: Armado del prompt

**Files:**
- Create: `src/lib/bot/prompt.ts`, `src/lib/bot/roles.ts`
- Test: `tests/bot/prompt.test.ts`

**Interfaces:**
- Consumes: `BotConfig`, `Message`; `InboundMessage`.
- Produces:
  - `type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }`
  - `buildChatMessages(input: { config: BotConfig; history: Message[]; incoming: InboundMessage }): ChatMessage[]`
  - `HISTORY_LIMIT = 15`
  - `ROLE_PROMPTS: Record<'soporte' | 'ventas' | 'agendamiento' | 'personalizado', string>` desde `@/lib/bot/roles`

- [ ] **Step 1: Escribir el test que falla**

`tests/bot/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildChatMessages, HISTORY_LIMIT } from '@/lib/bot/prompt'
import { ROLE_PROMPTS } from '@/lib/bot/roles'
import type { BotConfig, Message } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'

const config = {
  system_prompt: 'Eres el asesor de Clases IA. Sé breve.',
  bot_role: 'ventas',
} as BotConfig

const incoming: InboundMessage = {
  waMessageId: 'wamid.9', from: '593987654321', profileName: 'Ana',
  type: 'text', body: '¿Cuánto cuesta?',
}

function msg(i: number, sender: 'contacto' | 'bot'): Message {
  return {
    id: `m${i}`, contact_id: 'c1', wa_message_id: `w${i}`,
    direction: sender === 'contacto' ? 'inbound' : 'outbound',
    sender, type: 'text', body: `mensaje ${i}`, status: 'sent', error: null,
    created_at: `2026-08-12T10:${String(i).padStart(2, '0')}:00Z`,
  }
}

describe('buildChatMessages', () => {
  it('pone el prompt del usuario en el mensaje de sistema', () => {
    const r = buildChatMessages({ config, history: [], incoming })
    expect(r[0].role).toBe('system')
    expect(r[0].content).toContain('Eres el asesor de Clases IA.')
  })

  it('termina con el mensaje entrante como user', () => {
    const r = buildChatMessages({ config, history: [], incoming })
    expect(r.at(-1)).toEqual({ role: 'user', content: '¿Cuánto cuesta?' })
  })

  it('mapea el historial en orden cronológico con los roles correctos', () => {
    const history = [msg(1, 'contacto'), msg(2, 'bot')]
    const r = buildChatMessages({ config, history, incoming })
    expect(r.slice(1, 3)).toEqual([
      { role: 'user', content: 'mensaje 1' },
      { role: 'assistant', content: 'mensaje 2' },
    ])
  })

  it('recorta el historial a los últimos HISTORY_LIMIT mensajes', () => {
    const history = Array.from({ length: 40 }, (_, i) => msg(i, i % 2 ? 'bot' : 'contacto'))
    const r = buildChatMessages({ config, history, incoming })
    expect(r).toHaveLength(HISTORY_LIMIT + 2) // sistema + historial + entrante
    expect(r[1].content).toBe('mensaje 25')
  })

  it('descarta mensajes con cuerpo vacío del historial', () => {
    const vacio = { ...msg(3, 'contacto'), body: '   ' }
    const r = buildChatMessages({ config, history: [vacio], incoming })
    expect(r).toHaveLength(2)
  })

  it('usa el prompt base del rol si el usuario no escribió el suyo', () => {
    const r = buildChatMessages({ config: { ...config, system_prompt: '' }, history: [], incoming })
    expect(r[0].content).toContain(ROLE_PROMPTS.ventas)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/bot/prompt.test.ts`
Expected: FAIL — los módulos no existen.

- [ ] **Step 3: Implementar los prompts base**

`src/lib/bot/roles.ts`:

```ts
export type BotRole = 'soporte' | 'ventas' | 'agendamiento' | 'personalizado'

export const ROLE_LABELS: Record<BotRole, string> = {
  soporte: 'Soporte',
  ventas: 'Ventas',
  agendamiento: 'Agendamiento',
  personalizado: 'Personalizado',
}

export const ROLE_PROMPTS: Record<BotRole, string> = {
  soporte:
    'Eres el asistente de soporte de la empresa por WhatsApp. Resuelves dudas sobre el producto o servicio con respuestas cortas y concretas. Si no sabes algo o el caso es delicado, dices que un compañero del equipo continuará la conversación.',
  ventas:
    'Eres el asesor comercial de la empresa por WhatsApp. Entiendes qué necesita la persona, resuelves sus dudas y la acercas a la compra. Preguntas una cosa a la vez y no presionas.',
  agendamiento:
    'Eres el asistente de agenda de la empresa por WhatsApp. Tu objetivo es acordar día y hora para una cita o llamada. Propones opciones concretas y confirmas los datos al final.',
  personalizado: 'Eres el asistente de la empresa por WhatsApp.',
}
```

- [ ] **Step 4: Implementar el armado del prompt**

`src/lib/bot/prompt.ts`:

```ts
import type { BotConfig, Message } from '@/lib/types'
import type { InboundMessage } from '@/lib/whatsapp/parse'
import { ROLE_PROMPTS, type BotRole } from '@/lib/bot/roles'

export const HISTORY_LIMIT = 15

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const REGLAS_CANAL = [
  'Estás conversando por WhatsApp: responde en 1 o 2 párrafos cortos, sin listas largas ni formato markdown.',
  'Escribe en español, en el mismo tono con el que te escriben.',
  'Nunca inventes precios, fechas ni datos que no estén en tus instrucciones.',
].join(' ')

export function buildChatMessages(input: {
  config: BotConfig
  history: Message[]
  incoming: InboundMessage
}): ChatMessage[] {
  const { config, history, incoming } = input
  const base = config.system_prompt.trim() || ROLE_PROMPTS[(config.bot_role as BotRole)] || ROLE_PROMPTS.personalizado

  const previos: ChatMessage[] = history
    .filter((m) => m.body.trim() !== '')
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.sender === 'contacto' ? 'user' : 'assistant', content: m.body }))

  return [
    { role: 'system', content: `${base}\n\n${REGLAS_CANAL}` },
    ...previos,
    { role: 'user', content: incoming.body },
  ]
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- tests/bot/prompt.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/bot/prompt.ts src/lib/bot/roles.ts tests/bot/prompt.test.ts
git commit -m "feat: armado del prompt con historial y roles base"
```

---

### Task 8: Llamada a OpenAI con reintento

**Files:**
- Create: `src/lib/bot/openai.ts`
- Test: `tests/bot/openai.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` de `@/lib/bot/prompt`.
- Produces: `generateReply(messages: ChatMessage[], opts: { model: string }): Promise<string>` — reintenta una vez y lanza `Error` si vuelve a fallar o si la respuesta viene vacía.

- [ ] **Step 1: Escribir el test que falla**

`tests/bot/openai.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } }
  },
}))

import { generateReply } from '@/lib/bot/openai'

const messages = [{ role: 'user' as const, content: 'hola' }]

function respuesta(texto: string) {
  return { choices: [{ message: { content: texto } }] }
}

describe('generateReply', () => {
  beforeEach(() => {
    create.mockReset()
    process.env.OPENAI_API_KEY = 'sk-test'
  })

  it('devuelve el texto de la respuesta', async () => {
    create.mockResolvedValue(respuesta('¡Hola! ¿En qué te ayudo?'))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' }))
      .resolves.toBe('¡Hola! ¿En qué te ayudo?')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('pasa el modelo configurado', async () => {
    create.mockResolvedValue(respuesta('ok'))
    await generateReply(messages, { model: 'mi-modelo' })
    expect(create.mock.calls[0][0].model).toBe('mi-modelo')
  })

  it('reintenta una vez si la primera llamada falla', async () => {
    create.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(respuesta('listo'))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' })).resolves.toBe('listo')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('lanza si falla dos veces', async () => {
    create.mockRejectedValue(new Error('caído'))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' })).rejects.toThrow('caído')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('lanza si la respuesta viene vacía', async () => {
    create.mockResolvedValue(respuesta('   '))
    await expect(generateReply(messages, { model: 'gpt-4o-mini' }))
      .rejects.toThrow('respuesta vacía')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/bot/openai.test.ts`
Expected: FAIL — `generateReply` no existe.

- [ ] **Step 3: Implementar**

`src/lib/bot/openai.ts`:

```ts
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
    if (primerError instanceof Error && primerError.message.includes('respuesta vacía')) throw primerError
    return await llamar(messages, opts.model)
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/bot/openai.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/bot/openai.ts tests/bot/openai.test.ts
git commit -m "feat: generación de respuestas con OpenAI"
```

---

### Task 9: Envío de mensajes a Meta

**Files:**
- Create: `src/lib/whatsapp/send.ts`
- Test: `tests/whatsapp/send.test.ts`

**Interfaces:**
- Consumes: `graphUrl` de `@/lib/whatsapp/constants`.
- Produces:
  - `sendWhatsAppText(input: { phoneNumberId: string; token: string; to: string; text: string }): Promise<{ waMessageId: string }>` — lanza `Error` con el detalle de Meta si la API responde error.
  - `fetchPhoneNumberInfo(input: { phoneNumberId: string; token: string }): Promise<{ displayPhoneNumber: string; verifiedName: string }>`

- [ ] **Step 1: Escribir el test que falla**

`tests/whatsapp/send.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendWhatsAppText, fetchPhoneNumberInfo } from '@/lib/whatsapp/send'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function ok(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}
function fail(status: number, body: unknown) {
  return { ok: false, status, text: async () => JSON.stringify(body) }
}

describe('sendWhatsAppText', () => {
  it('llama a la URL correcta con el token y devuelve el id del mensaje', async () => {
    fetchMock.mockResolvedValue(ok({ messages: [{ id: 'wamid.OUT1' }] }))

    const r = await sendWhatsAppText({
      phoneNumberId: '222', token: 'tok', to: '593987654321', text: 'Hola',
    })

    expect(r).toEqual({ waMessageId: 'wamid.OUT1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v21.0/222/messages')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '593987654321',
      type: 'text',
      text: { preview_url: false, body: 'Hola' },
    })
  })

  it('lanza con el mensaje de error de Meta', async () => {
    fetchMock.mockResolvedValue(fail(400, { error: { message: 'Invalid parameter', code: 100 } }))
    await expect(
      sendWhatsAppText({ phoneNumberId: '222', token: 'tok', to: '1', text: 'x' }),
    ).rejects.toThrow('Invalid parameter')
  })
})

describe('fetchPhoneNumberInfo', () => {
  it('devuelve el número y el nombre verificado', async () => {
    fetchMock.mockResolvedValue(ok({ display_phone_number: '+593 99', verified_name: 'Clases IA' }))
    const r = await fetchPhoneNumberInfo({ phoneNumberId: '222', token: 'tok' })
    expect(r).toEqual({ displayPhoneNumber: '+593 99', verifiedName: 'Clases IA' })
  })

  it('lanza si el token es inválido', async () => {
    fetchMock.mockResolvedValue(fail(401, { error: { message: 'Invalid OAuth access token' } }))
    await expect(fetchPhoneNumberInfo({ phoneNumberId: '222', token: 'malo' }))
      .rejects.toThrow('Invalid OAuth access token')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/whatsapp/send.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

`src/lib/whatsapp/send.ts`:

```ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/whatsapp/send.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/whatsapp/send.ts tests/whatsapp/send.test.ts
git commit -m "feat: envío de mensajes de texto a la API de Meta"
```

---

### Task 10: Capa de datos (contactos, mensajes, eventos)

**Files:**
- Create: `src/lib/db/contacts.ts`, `src/lib/db/messages.ts`, `src/lib/db/events.ts`
- Modify: `scripts/check-db.ts`

**Interfaces:**
- Consumes: `supabaseAdmin()`, tipos de `@/lib/types`, `InboundMessage`, `StatusUpdate`.
- Produces:
  - `upsertContact(input: { waId: string; profileName: string | null }): Promise<{ contact: Contact; isNew: boolean }>`
  - `setContactFlags(id: string, patch: Partial<Pick<Contact, 'bot_paused' | 'needs_attention' | 'status' | 'last_message_at'>>): Promise<void>`
  - `listContacts(): Promise<Contact[]>`
  - `insertInboundMessage(contactId: string, message: InboundMessage): Promise<{ inserted: boolean }>`
  - `insertOutboundMessage(input: { contactId: string; body: string; sender: 'bot' | 'humano'; waMessageId?: string | null; status?: MessageStatus; error?: string | null }): Promise<string>`
  - `updateMessageStatus(update: StatusUpdate): Promise<void>`
  - `getRecentMessages(contactId: string, limit: number): Promise<Message[]>`
  - `logWebhookEvent(ok: boolean, detail: string): Promise<void>`
  - `getLastWebhookEvents(limit: number): Promise<{ received_at: string; ok: boolean; detail: string }[]>`

- [ ] **Step 1: Implementar contactos**

`src/lib/db/contacts.ts`:

```ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Contact } from '@/lib/types'

export async function upsertContact(input: {
  waId: string
  profileName: string | null
}): Promise<{ contact: Contact; isNew: boolean }> {
  const db = supabaseAdmin()
  const { data: existente } = await db
    .from('contacts').select('*').eq('wa_id', input.waId).maybeSingle()

  if (existente) {
    const { data, error } = await db
      .from('contacts')
      .update({
        profile_name: input.profileName ?? existente.profile_name,
        last_message_at: new Date().toISOString(),
        status: existente.status === 'nuevo' ? 'en_conversacion' : existente.status,
      })
      .eq('id', existente.id)
      .select()
      .single()
    if (error) throw new Error(`No se pudo actualizar el contacto: ${error.message}`)
    return { contact: data as Contact, isNew: false }
  }

  const { data, error } = await db
    .from('contacts')
    .insert({ wa_id: input.waId, profile_name: input.profileName, status: 'nuevo' })
    .select()
    .single()
  if (error) throw new Error(`No se pudo crear el contacto: ${error.message}`)
  return { contact: data as Contact, isNew: true }
}

export async function setContactFlags(
  id: string,
  patch: Partial<Pick<Contact, 'bot_paused' | 'needs_attention' | 'status' | 'last_message_at'>>,
): Promise<void> {
  const { error } = await supabaseAdmin().from('contacts').update(patch).eq('id', id)
  if (error) throw new Error(`No se pudo actualizar el contacto: ${error.message}`)
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabaseAdmin()
    .from('contacts').select('*').order('last_message_at', { ascending: false })
  if (error) throw new Error(`No se pudieron leer los contactos: ${error.message}`)
  return (data ?? []) as Contact[]
}
```

- [ ] **Step 2: Implementar mensajes**

`src/lib/db/messages.ts`:

```ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Message, MessageStatus } from '@/lib/types'
import type { InboundMessage, StatusUpdate } from '@/lib/whatsapp/parse'

/** Devuelve inserted=false si el mensaje ya existía (Meta reintenta las entregas). */
export async function insertInboundMessage(
  contactId: string,
  message: InboundMessage,
): Promise<{ inserted: boolean }> {
  const { error } = await supabaseAdmin().from('messages').insert({
    contact_id: contactId,
    wa_message_id: message.waMessageId,
    direction: 'inbound',
    sender: 'contacto',
    type: message.type,
    body: message.body,
    status: 'delivered',
  })

  if (error) {
    if (error.code === '23505') return { inserted: false }
    throw new Error(`No se pudo guardar el mensaje entrante: ${error.message}`)
  }
  return { inserted: true }
}

export async function insertOutboundMessage(input: {
  contactId: string
  body: string
  sender: 'bot' | 'humano'
  waMessageId?: string | null
  status?: MessageStatus
  error?: string | null
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .insert({
      contact_id: input.contactId,
      wa_message_id: input.waMessageId ?? null,
      direction: 'outbound',
      sender: input.sender,
      type: 'text',
      body: input.body,
      status: input.status ?? 'sent',
      error: input.error ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo guardar el mensaje saliente: ${error.message}`)
  return data.id as string
}

export async function updateMessageStatus(update: StatusUpdate): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('messages')
    .update({ status: update.status, error: update.error })
    .eq('wa_message_id', update.waMessageId)
  if (error) throw new Error(`No se pudo actualizar el estado: ${error.message}`)
}

export async function getRecentMessages(contactId: string, limit: number): Promise<Message[]> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`No se pudieron leer los mensajes: ${error.message}`)
  return ((data ?? []) as Message[]).reverse()
}
```

- [ ] **Step 3: Implementar eventos del webhook**

`src/lib/db/events.ts`:

```ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function logWebhookEvent(ok: boolean, detail: string): Promise<void> {
  await supabaseAdmin().from('webhook_events').insert({ ok, detail: detail.slice(0, 500) })
}

export async function getLastWebhookEvents(
  limit: number,
): Promise<{ received_at: string; ok: boolean; detail: string }[]> {
  const { data, error } = await supabaseAdmin()
    .from('webhook_events')
    .select('received_at, ok, detail')
    .order('received_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`No se pudieron leer los eventos: ${error.message}`)
  return data ?? []
}
```

- [ ] **Step 4: Ampliar el script de verificación**

Reemplazar el contenido de `scripts/check-db.ts` por:

```ts
import { upsertContact, setContactFlags, listContacts } from '../src/lib/db/contacts'
import { insertInboundMessage, insertOutboundMessage, getRecentMessages, updateMessageStatus } from '../src/lib/db/messages'
import { logWebhookEvent, getLastWebhookEvents } from '../src/lib/db/events'
import { getConfig } from '../src/lib/db/config'
import { supabaseAdmin } from '../src/lib/supabase/admin'

async function main() {
  const config = await getConfig()
  console.log('config ok, modelo:', config.openai_model)

  const primero = await upsertContact({ waId: '000_prueba', profileName: 'Prueba' })
  console.log('contacto nuevo:', primero.isNew === true ? 'sí' : 'NO')

  const segundo = await upsertContact({ waId: '000_prueba', profileName: 'Prueba' })
  console.log('segundo upsert reconoce existente:', segundo.isNew === false ? 'sí' : 'NO')

  const entrante = { waMessageId: 'wamid.prueba', from: '000_prueba', profileName: 'Prueba', type: 'text' as const, body: 'hola' }
  console.log('primer insert:', (await insertInboundMessage(primero.contact.id, entrante)).inserted === true ? 'sí' : 'NO')
  console.log('duplicado rechazado:', (await insertInboundMessage(primero.contact.id, entrante)).inserted === false ? 'sí' : 'NO')

  await insertOutboundMessage({ contactId: primero.contact.id, body: 'respuesta', sender: 'bot', waMessageId: 'wamid.out' })
  await updateMessageStatus({ waMessageId: 'wamid.out', status: 'read', error: null })

  const historial = await getRecentMessages(primero.contact.id, 15)
  console.log('historial en orden cronológico:', historial.map((m) => m.body).join(' -> '))

  await setContactFlags(primero.contact.id, { needs_attention: true })
  console.log('contactos listados:', (await listContacts()).length)

  await logWebhookEvent(true, 'prueba')
  console.log('eventos:', (await getLastWebhookEvents(5)).length)

  await supabaseAdmin().from('contacts').delete().eq('wa_id', '000_prueba')
  await supabaseAdmin().from('webhook_events').delete().eq('detail', 'prueba')
  console.log('limpieza lista')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 5: Correr el script contra Supabase**

Run: `npx tsx scripts/check-db.ts`
Expected: todas las líneas dicen `sí`, el historial imprime `hola -> respuesta`, y termina en `limpieza lista`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/db scripts/check-db.ts
git commit -m "feat: capa de datos de contactos, mensajes y eventos"
```

---

### Task 11: Orquestador del mensaje entrante

**Files:**
- Create: `src/lib/bot/handle-inbound.ts`
- Test: `tests/bot/handle-inbound.test.ts`

**Interfaces:**
- Consumes: todo lo anterior (`getConfig`, `upsertContact`, `insertInboundMessage`, `getRecentMessages`, `insertOutboundMessage`, `setContactFlags`, `decideBotAction`, `buildChatMessages`, `generateReply`, `sendWhatsAppText`).
- Produces: `handleInbound(message: InboundMessage, now?: Date): Promise<void>` — nunca lanza; registra el fallo y marca `needs_attention`.

- [ ] **Step 1: Escribir el test que falla**

`tests/bot/handle-inbound.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/config', () => ({ getConfig: vi.fn(), updateConfig: vi.fn() }))
vi.mock('@/lib/db/contacts', () => ({ upsertContact: vi.fn(), setContactFlags: vi.fn(), listContacts: vi.fn() }))
vi.mock('@/lib/db/messages', () => ({
  insertInboundMessage: vi.fn(), insertOutboundMessage: vi.fn(),
  getRecentMessages: vi.fn(), updateMessageStatus: vi.fn(),
}))
vi.mock('@/lib/db/events', () => ({ logWebhookEvent: vi.fn(), getLastWebhookEvents: vi.fn() }))
vi.mock('@/lib/bot/openai', () => ({ generateReply: vi.fn() }))
vi.mock('@/lib/whatsapp/send', () => ({ sendWhatsAppText: vi.fn(), fetchPhoneNumberInfo: vi.fn() }))

import { getConfig } from '@/lib/db/config'
import { upsertContact, setContactFlags } from '@/lib/db/contacts'
import { insertInboundMessage, insertOutboundMessage, getRecentMessages } from '@/lib/db/messages'
import { generateReply } from '@/lib/bot/openai'
import { sendWhatsAppText } from '@/lib/whatsapp/send'
import { handleInbound } from '@/lib/bot/handle-inbound'
import type { InboundMessage } from '@/lib/whatsapp/parse'

const config = {
  phone_number_id: '222', waba_id: '1', meta_token: 'tok', meta_app_secret: 's', verify_token: 'v',
  bot_enabled: true, bot_role: 'ventas', system_prompt: 'Eres un asesor.',
  welcome_message: '¡Hola! Soy el asistente.',
  business_hours: { enabled: false, tz: 'America/Guayaquil', days: {} },
  out_of_hours_message: 'Fuera de horario.', escalation_keywords: ['asesor'],
  openai_model: 'gpt-4o-mini', updated_at: '',
}

const contact = {
  id: 'c1', wa_id: '593987654321', profile_name: 'Ana', status: 'en_conversacion',
  bot_paused: false, needs_attention: false, last_message_at: '', created_at: '',
}

const mensaje: InboundMessage = {
  waMessageId: 'wamid.1', from: '593987654321', profileName: 'Ana',
  type: 'text', body: '¿Cuánto cuesta?',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getConfig).mockResolvedValue(config as never)
  vi.mocked(upsertContact).mockResolvedValue({ contact, isNew: false } as never)
  vi.mocked(insertInboundMessage).mockResolvedValue({ inserted: true })
  vi.mocked(getRecentMessages).mockResolvedValue([])
  vi.mocked(insertOutboundMessage).mockResolvedValue('m1')
  vi.mocked(generateReply).mockResolvedValue('Cuesta 100 dólares.')
  vi.mocked(sendWhatsAppText).mockResolvedValue({ waMessageId: 'wamid.out' })
})

describe('handleInbound', () => {
  it('responde con IA y guarda el mensaje saliente', async () => {
    await handleInbound(mensaje)

    expect(generateReply).toHaveBeenCalledTimes(1)
    expect(sendWhatsAppText).toHaveBeenCalledWith({
      phoneNumberId: '222', token: 'tok', to: '593987654321', text: 'Cuesta 100 dólares.',
    })
    expect(insertOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'c1', body: 'Cuesta 100 dólares.', sender: 'bot', waMessageId: 'wamid.out' }),
    )
  })

  it('no hace nada si el mensaje ya estaba guardado (reintento de Meta)', async () => {
    vi.mocked(insertInboundMessage).mockResolvedValue({ inserted: false })
    await handleInbound(mensaje)
    expect(generateReply).not.toHaveBeenCalled()
    expect(sendWhatsAppText).not.toHaveBeenCalled()
  })

  it('envía la bienvenida antes de la respuesta cuando el contacto es nuevo', async () => {
    vi.mocked(upsertContact).mockResolvedValue({ contact, isNew: true } as never)
    await handleInbound(mensaje)
    expect(vi.mocked(sendWhatsAppText).mock.calls.map((c) => c[0].text))
      .toEqual(['¡Hola! Soy el asistente.', 'Cuesta 100 dólares.'])
  })

  it('envía el mensaje predefinido sin llamar a OpenAI cuando la decisión es canned', async () => {
    vi.mocked(getConfig).mockResolvedValue({
      ...config,
      business_hours: { enabled: true, tz: 'America/Guayaquil', days: {} },
    } as never)
    await handleInbound(mensaje)
    expect(generateReply).not.toHaveBeenCalled()
    expect(vi.mocked(sendWhatsAppText).mock.calls[0][0].text).toBe('Fuera de horario.')
  })

  it('calla y marca atención ante una palabra clave', async () => {
    await handleInbound({ ...mensaje, body: 'quiero un asesor' })
    expect(sendWhatsAppText).not.toHaveBeenCalled()
    expect(setContactFlags).toHaveBeenCalledWith('c1', { needs_attention: true })
  })

  it('marca atención y no envía nada si OpenAI falla', async () => {
    vi.mocked(generateReply).mockRejectedValue(new Error('caído'))
    await handleInbound(mensaje)
    expect(sendWhatsAppText).not.toHaveBeenCalled()
    expect(setContactFlags).toHaveBeenCalledWith('c1', { needs_attention: true })
  })

  it('guarda el mensaje como fallido si Meta rechaza el envío', async () => {
    vi.mocked(sendWhatsAppText).mockRejectedValue(new Error('Meta rechazó el envío: token inválido'))
    await handleInbound(mensaje)
    expect(insertOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: expect.stringContaining('token inválido') }),
    )
    expect(setContactFlags).toHaveBeenCalledWith('c1', { needs_attention: true })
  })

  it('no lanza aunque falle todo', async () => {
    vi.mocked(getConfig).mockRejectedValue(new Error('sin base de datos'))
    await expect(handleInbound(mensaje)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/bot/handle-inbound.test.ts`
Expected: FAIL — `handleInbound` no existe.

- [ ] **Step 3: Implementar**

`src/lib/bot/handle-inbound.ts`:

```ts
import 'server-only'
import { getConfig } from '@/lib/db/config'
import { upsertContact, setContactFlags } from '@/lib/db/contacts'
import { insertInboundMessage, insertOutboundMessage, getRecentMessages } from '@/lib/db/messages'
import { logWebhookEvent } from '@/lib/db/events'
import { decideBotAction } from '@/lib/bot/rules'
import { buildChatMessages, HISTORY_LIMIT } from '@/lib/bot/prompt'
import { generateReply } from '@/lib/bot/openai'
import { sendWhatsAppText } from '@/lib/whatsapp/send'
import type { InboundMessage } from '@/lib/whatsapp/parse'
import type { BotConfig } from '@/lib/types'

/** Envía y guarda; si Meta rechaza, deja el mensaje como fallido y avisa al llamador. */
async function enviarYGuardar(
  config: BotConfig,
  contactId: string,
  to: string,
  text: string,
): Promise<boolean> {
  try {
    const { waMessageId } = await sendWhatsAppText({
      phoneNumberId: config.phone_number_id,
      token: config.meta_token,
      to,
      text,
    })
    await insertOutboundMessage({ contactId, body: text, sender: 'bot', waMessageId, status: 'sent' })
    return true
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    await insertOutboundMessage({
      contactId, body: text, sender: 'bot', waMessageId: null, status: 'failed', error: detalle,
    })
    return false
  }
}

/** Nunca lanza: corre en segundo plano después de responderle 200 a Meta. */
export async function handleInbound(message: InboundMessage, now: Date = new Date()): Promise<void> {
  let contactId: string | null = null

  try {
    const config = await getConfig()
    const { contact, isNew } = await upsertContact({
      waId: message.from,
      profileName: message.profileName,
    })
    contactId = contact.id

    const { inserted } = await insertInboundMessage(contact.id, message)
    if (!inserted) return // Meta reintentó una entrega que ya procesamos.

    const decision = decideBotAction({ config, contact, isNewContact: isNew, message, now })

    if (decision.action === 'silent') {
      if (decision.needsAttention) await setContactFlags(contact.id, { needs_attention: true })
      return
    }

    if (decision.action === 'canned') {
      if (decision.text.trim() === '') return
      const ok = await enviarYGuardar(config, contact.id, message.from, decision.text)
      if (!ok) await setContactFlags(contact.id, { needs_attention: true })
      return
    }

    if (decision.welcome) {
      await enviarYGuardar(config, contact.id, message.from, decision.welcome)
    }

    const history = await getRecentMessages(contact.id, HISTORY_LIMIT + 1)
    const chat = buildChatMessages({
      config,
      history: history.filter((m) => m.wa_message_id !== message.waMessageId),
      incoming: message,
    })

    const respuesta = await generateReply(chat, { model: config.openai_model })
    const ok = await enviarYGuardar(config, contact.id, message.from, respuesta)
    if (!ok) await setContactFlags(contact.id, { needs_attention: true })
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    if (contactId) {
      await setContactFlags(contactId, { needs_attention: true }).catch(() => {})
    }
    await logWebhookEvent(false, `Fallo procesando ${message.waMessageId}: ${detalle}`).catch(() => {})
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/bot/handle-inbound.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: PASS, todos los archivos.

- [ ] **Step 6: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/lib/bot/handle-inbound.ts tests/bot/handle-inbound.test.ts
git commit -m "feat: orquestador del mensaje entrante"
```

---

### Task 12: POST del webhook

**Files:**
- Modify: `src/app/api/whatsapp/webhook/route.ts`
- Modify: `tests/api/webhook.test.ts`

**Interfaces:**
- Consumes: `verifySignature`, `parseWebhook`, `handleInbound`, `updateMessageStatus`, `logWebhookEvent`, `getConfig`.
- Produces: `POST(request: Request): Promise<Response>`.

- [ ] **Step 1: Añadir los tests del POST**

Añadir al principio de `tests/api/webhook.test.ts` los mocks nuevos (junto al de `@/lib/db/config` que ya existe):

```ts
vi.mock('@/lib/bot/handle-inbound', () => ({ handleInbound: vi.fn() }))
vi.mock('@/lib/db/messages', () => ({ updateMessageStatus: vi.fn() }))
vi.mock('@/lib/db/events', () => ({ logWebhookEvent: vi.fn() }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { void fn() } }))
```

Y añadir al final del archivo:

```ts
import { createHmac } from 'node:crypto'
import { POST } from '@/app/api/whatsapp/webhook/route'
import { handleInbound } from '@/lib/bot/handle-inbound'
import { updateMessageStatus } from '@/lib/db/messages'

const appSecret = 'secreto'

function pedido(payload: unknown, firmar = true) {
  const body = JSON.stringify(payload)
  const firma = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex')
  return new Request('https://x.com/api/whatsapp/webhook', {
    method: 'POST',
    headers: firmar ? { 'x-hub-signature-256': firma } : {},
    body,
  })
}

const payloadMensaje = {
  entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: 'Ana' }, wa_id: '593987654321' }],
    messages: [{ from: '593987654321', id: 'wamid.AAA', type: 'text', text: { body: 'hola' } }],
  } }] }],
}

const payloadEstado = {
  entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.OUT', status: 'read' }] } }] }],
}

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockResolvedValue({ meta_app_secret: appSecret } as never)
  })

  it('acepta un mensaje firmado y lo pasa al orquestador', async () => {
    const res = await POST(pedido(payloadMensaje))
    expect(res.status).toBe(200)
    expect(handleInbound).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: 'wamid.AAA', from: '593987654321', body: 'hola' }),
    )
  })

  it('rechaza con 401 si la firma no es válida', async () => {
    const res = await POST(pedido(payloadMensaje, false))
    expect(res.status).toBe(401)
    expect(handleInbound).not.toHaveBeenCalled()
  })

  it('actualiza los estados de entrega', async () => {
    const res = await POST(pedido(payloadEstado))
    expect(res.status).toBe(200)
    expect(updateMessageStatus).toHaveBeenCalledWith({ waMessageId: 'wamid.OUT', status: 'read', error: null })
  })

  it('devuelve 200 aunque el payload sea desconocido', async () => {
    const res = await POST(pedido({ hola: 'mundo' }))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- tests/api/webhook.test.ts`
Expected: FAIL — `POST` no está exportado.

- [ ] **Step 3: Implementar el POST**

Añadir a `src/app/api/whatsapp/webhook/route.ts`:

```ts
import { after } from 'next/server'
import { verifySignature } from '@/lib/whatsapp/signature'
import { parseWebhook } from '@/lib/whatsapp/parse'
import { handleInbound } from '@/lib/bot/handle-inbound'
import { updateMessageStatus } from '@/lib/db/messages'
import { logWebhookEvent } from '@/lib/db/events'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const config = await getConfig()

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'), config.meta_app_secret)) {
    await logWebhookEvent(false, 'Firma inválida').catch(() => {})
    return new Response('Unauthorized', { status: 401 })
  }

  let parsed
  try {
    parsed = parseWebhook(JSON.parse(rawBody))
  } catch {
    await logWebhookEvent(false, 'Cuerpo no es JSON válido').catch(() => {})
    return new Response('OK', { status: 200 })
  }

  await logWebhookEvent(
    true,
    `${parsed.messages.length} mensaje(s), ${parsed.statuses.length} estado(s)`,
  ).catch(() => {})

  // Responder rápido: Meta reintenta si tardamos más de ~10 s y eso duplicaría respuestas.
  after(async () => {
    for (const estado of parsed.statuses) {
      await updateMessageStatus(estado).catch(() => {})
    }
    for (const mensaje of parsed.messages) {
      await handleInbound(mensaje)
    }
  })

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- tests/api/webhook.test.ts`
Expected: PASS (7 tests: 3 del GET + 4 del POST)

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/app/api/whatsapp/webhook/route.ts tests/api/webhook.test.ts
git commit -m "feat: ingesta de mensajes del webhook"
```

---

### Task 13: Login y estructura del panel

**Files:**
- Create: `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/(panel)/layout.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: `supabaseServer()`, `supabaseBrowser()`.
- Produces: rutas protegidas bajo `(panel)`; redirección a `/login` si no hay sesión.

- [ ] **Step 1: Crear el usuario del panel en Supabase**

En el dashboard de Supabase → Authentication → Users → *Add user* → crear con email y contraseña. Desactivar el registro público en Authentication → Providers → Email → *Enable sign ups* en off. Es un panel de un solo usuario: si el registro queda abierto, cualquiera entra.

- [ ] **Step 2: Escribir el middleware**

`src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

El `matcher` excluye `/api` a propósito: el webhook de Meta no tiene sesión y debe seguir entrando.

- [ ] **Step 3: Escribir la página de login**

`src/app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) return setError('No pudimos entrar. Revisa el correo y la contraseña.')
    router.push('/inbox')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl bg-neutral-900 p-8">
        <h1 className="text-xl font-semibold text-white">Panel del bot</h1>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo" required
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-white"
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña" required
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-white"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit" disabled={cargando}
          className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Escribir el layout del panel**

`src/app/(panel)/layout.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

const NAV = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/leads', label: 'Leads' },
  { href: '/bot', label: 'Bot' },
  { href: '/conexion', label: 'Conexión' },
]

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="w-52 shrink-0 border-r border-neutral-800 p-4">
        <p className="mb-6 text-sm font-semibold text-neutral-400">Bot de WhatsApp</p>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href} href={item.href}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Redirigir la raíz**

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/inbox')
}
```

- [ ] **Step 6: Verificar a mano**

Run: `npm run dev`
Abrir `http://localhost:3000` → debe redirigir a `/login`. Entrar con el usuario creado → debe llegar a `/inbox` (todavía 404 hasta la tarea 15; basta con que la URL cambie y no rebote a login).

- [ ] **Step 7: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/middleware.ts src/app/login src/app/\(panel\) src/app/page.tsx
git commit -m "feat: login y estructura del panel"
```

---

### Task 14: Pantalla de Conexión

**Files:**
- Create: `src/app/(panel)/conexion/page.tsx`, `src/components/conexion/conexion-form.tsx`, `src/actions/config.ts`

**Interfaces:**
- Consumes: `getConfig`, `updateConfig`, `fetchPhoneNumberInfo`, `getLastWebhookEvents`.
- Produces (server actions en `@/actions/config`):
  - `guardarConexion(formData: FormData): Promise<{ ok: boolean; mensaje: string }>`
  - `probarConexion(): Promise<{ ok: boolean; mensaje: string }>`

- [ ] **Step 1: Escribir las server actions**

`src/actions/config.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getConfig, updateConfig } from '@/lib/db/config'
import { fetchPhoneNumberInfo } from '@/lib/whatsapp/send'
import { supabaseServer } from '@/lib/supabase/server'

async function exigirSesion() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión')
}

export async function guardarConexion(formData: FormData): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()

  const patch: Record<string, string> = {}
  for (const campo of ['phone_number_id', 'waba_id', 'verify_token'] as const) {
    patch[campo] = String(formData.get(campo) ?? '').trim()
  }
  // Los secretos solo se sobrescriben si el usuario escribió algo nuevo.
  for (const campo of ['meta_token', 'meta_app_secret'] as const) {
    const valor = String(formData.get(campo) ?? '').trim()
    if (valor !== '') patch[campo] = valor
  }

  await updateConfig(patch)
  revalidatePath('/conexion')
  return { ok: true, mensaje: 'Datos guardados.' }
}

export async function probarConexion(): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()
  const config = await getConfig()

  if (!config.phone_number_id || !config.meta_token) {
    return { ok: false, mensaje: 'Faltan el Phone Number ID o el token.' }
  }

  try {
    const info = await fetchPhoneNumberInfo({
      phoneNumberId: config.phone_number_id,
      token: config.meta_token,
    })
    return { ok: true, mensaje: `Conectado a ${info.displayPhoneNumber} (${info.verifiedName}).` }
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
```

- [ ] **Step 2: Escribir el formulario**

`src/components/conexion/conexion-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { guardarConexion, probarConexion } from '@/actions/config'

type Props = {
  webhookUrl: string
  config: {
    phone_number_id: string
    waba_id: string
    verify_token: string
    tieneToken: boolean
    tieneSecret: boolean
  }
}

function Campo({ label, name, defaultValue, placeholder, type = 'text' }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; type?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-neutral-400">{label}</span>
      <input
        name={name} type={type} defaultValue={defaultValue} placeholder={placeholder}
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
      />
    </label>
  )
}

export function ConexionForm({ webhookUrl, config }: Props) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [probando, setProbando] = useState(false)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Pegar en Meta</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500">URL de devolución de llamada</dt>
            <dd className="select-all break-all font-mono text-emerald-400">{webhookUrl}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Token de verificación</dt>
            <dd className="select-all font-mono text-emerald-400">{config.verify_token || '(sin definir)'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          En Meta: WhatsApp → Configuración → Webhooks. Suscríbete al campo <code>messages</code>.
        </p>
      </section>

      <form
        action={async (formData) => setAviso(await guardarConexion(formData))}
        className="space-y-4 rounded-xl border border-neutral-800 p-4"
      >
        <Campo label="Phone Number ID" name="phone_number_id" defaultValue={config.phone_number_id} />
        <Campo label="WABA ID" name="waba_id" defaultValue={config.waba_id} />
        <Campo label="Token de verificación (lo eliges tú)" name="verify_token" defaultValue={config.verify_token} />
        <Campo
          label="Token permanente de Meta" name="meta_token" type="password"
          placeholder={config.tieneToken ? '•••••• (guardado, escribe para cambiarlo)' : 'Pegar token'}
        />
        <Campo
          label="App Secret" name="meta_app_secret" type="password"
          placeholder={config.tieneSecret ? '•••••• (guardado, escribe para cambiarlo)' : 'Pegar app secret'}
        />
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950">
            Guardar
          </button>
          <button
            type="button"
            onClick={async () => { setProbando(true); setAviso(await probarConexion()); setProbando(false) }}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm"
          >
            {probando ? 'Probando…' : 'Probar conexión'}
          </button>
        </div>
        {aviso && (
          <p className={`text-sm ${aviso.ok ? 'text-emerald-400' : 'text-red-400'}`}>{aviso.mensaje}</p>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Escribir la página**

`src/app/(panel)/conexion/page.tsx`:

```tsx
import { getConfig } from '@/lib/db/config'
import { getLastWebhookEvents } from '@/lib/db/events'
import { ConexionForm } from '@/components/conexion/conexion-form'

export const dynamic = 'force-dynamic'

function haceCuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'hace menos de un minuto'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} d`
}

export default async function ConexionPage() {
  const config = await getConfig()
  const eventos = await getLastWebhookEvents(10)
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'

  return (
    <div className="h-screen overflow-y-auto p-8">
      <h1 className="mb-6 text-2xl font-semibold">Conexión</h1>

      <div className="mb-6 rounded-xl border border-neutral-800 p-4 text-sm">
        <p className="text-neutral-400">Último evento recibido de Meta</p>
        <p className="mt-1 text-lg">
          {eventos.length ? haceCuanto(eventos[0].received_at) : 'nunca'}
        </p>
        {eventos.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-neutral-500">
            {eventos.map((e, i) => (
              <li key={i} className={e.ok ? '' : 'text-red-400'}>
                {new Date(e.received_at).toLocaleString('es-EC')} — {e.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConexionForm
        webhookUrl={`${base}/api/whatsapp/webhook`}
        config={{
          phone_number_id: config.phone_number_id,
          waba_id: config.waba_id,
          verify_token: config.verify_token,
          tieneToken: config.meta_token !== '',
          tieneSecret: config.meta_app_secret !== '',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev`, abrir `/conexion`.
Expected: se ven la URL del webhook y los campos. Guardar Phone Number ID y token reales, pulsar **Probar conexión** → mensaje verde con el número y el nombre verificado. Con un token inválido → mensaje rojo con el error de Meta.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/app/\(panel\)/conexion src/components/conexion src/actions/config.ts
git commit -m "feat: pantalla de conexión con Meta"
```

---

### Task 15: Inbox con tiempo real

**Files:**
- Create: `src/app/(panel)/inbox/page.tsx`, `src/components/inbox/inbox.tsx`, `src/actions/inbox.ts`

**Interfaces:**
- Consumes: `listContacts`, `getRecentMessages`, `getConfig`, `sendWhatsAppText`, `insertOutboundMessage`, `setContactFlags`, `supabaseBrowser`.
- Produces (server actions en `@/actions/inbox`):
  - `responderManual(contactId: string, texto: string): Promise<{ ok: boolean; mensaje: string }>`
  - `alternarPausa(contactId: string, pausado: boolean): Promise<void>`
  - `cargarMensajes(contactId: string): Promise<Message[]>`

- [ ] **Step 1: Escribir las server actions**

`src/actions/inbox.ts`:

```ts
'use server'

import { getConfig } from '@/lib/db/config'
import { setContactFlags } from '@/lib/db/contacts'
import { getRecentMessages, insertOutboundMessage } from '@/lib/db/messages'
import { sendWhatsAppText } from '@/lib/whatsapp/send'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import type { Message } from '@/lib/types'

async function exigirSesion() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión')
}

export async function cargarMensajes(contactId: string): Promise<Message[]> {
  await exigirSesion()
  return getRecentMessages(contactId, 100)
}

export async function alternarPausa(contactId: string, pausado: boolean): Promise<void> {
  await exigirSesion()
  await setContactFlags(contactId, { bot_paused: pausado })
}

export async function responderManual(
  contactId: string,
  texto: string,
): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()
  if (texto.trim() === '') return { ok: false, mensaje: 'El mensaje está vacío.' }

  const config = await getConfig()
  const { data: contacto } = await supabaseAdmin()
    .from('contacts').select('wa_id').eq('id', contactId).single()
  if (!contacto) return { ok: false, mensaje: 'Contacto no encontrado.' }

  try {
    const { waMessageId } = await sendWhatsAppText({
      phoneNumberId: config.phone_number_id,
      token: config.meta_token,
      to: contacto.wa_id,
      text: texto.trim(),
    })
    await insertOutboundMessage({
      contactId, body: texto.trim(), sender: 'humano', waMessageId, status: 'sent',
    })
    await setContactFlags(contactId, { needs_attention: false, status: 'atendido_humano' })
    return { ok: true, mensaje: 'Enviado.' }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : 'Error desconocido'
    await insertOutboundMessage({
      contactId, body: texto.trim(), sender: 'humano', status: 'failed', error: detalle,
    })
    return { ok: false, mensaje: detalle }
  }
}
```

- [ ] **Step 2: Escribir el componente del inbox**

`src/components/inbox/inbox.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { cargarMensajes, responderManual, alternarPausa } from '@/actions/inbox'
import type { Contact, Message } from '@/lib/types'

const COLOR_SENDER: Record<string, string> = {
  contacto: 'bg-neutral-800 text-neutral-100 self-start',
  bot: 'bg-emerald-600/90 text-neutral-950 self-end',
  humano: 'bg-sky-600 text-white self-end',
}

export function Inbox({ contactosIniciales }: { contactosIniciales: Contact[] }) {
  const [contactos, setContactos] = useState(contactosIniciales)
  const [activo, setActivo] = useState<Contact | null>(contactosIniciales[0] ?? null)
  const [mensajes, setMensajes] = useState<Message[]>([])
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  const refrescarMensajes = useCallback(async (id: string) => {
    setMensajes(await cargarMensajes(id))
  }, [])

  useEffect(() => {
    if (activo) void refrescarMensajes(activo.id)
  }, [activo, refrescarMensajes])

  useEffect(() => {
    const supabase = supabaseBrowser()
    const canal = supabase
      .channel('inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const fila = payload.new as Message
        if (activo && fila.contact_id === activo.id) void refrescarMensajes(activo.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, (payload) => {
        const fila = payload.new as Contact
        setContactos((prev) => {
          const resto = prev.filter((c) => c.id !== fila.id)
          return [fila, ...resto].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
        })
        setActivo((prev) => (prev && prev.id === fila.id ? fila : prev))
      })
      .subscribe()

    return () => { void supabase.removeChannel(canal) }
  }, [activo, refrescarMensajes])

  async function enviar() {
    if (!activo) return
    const r = await responderManual(activo.id, texto)
    setAviso(r.ok ? null : r.mensaje)
    if (r.ok) { setTexto(''); void refrescarMensajes(activo.id) }
  }

  async function pausar() {
    if (!activo) return
    const nuevo = !activo.bot_paused
    await alternarPausa(activo.id, nuevo)
    setActivo({ ...activo, bot_paused: nuevo })
  }

  return (
    <div className="flex h-screen">
      <ul className="w-72 shrink-0 overflow-y-auto border-r border-neutral-800">
        {contactos.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => setActivo(c)}
              className={`w-full border-b border-neutral-900 px-4 py-3 text-left hover:bg-neutral-900 ${
                activo?.id === c.id ? 'bg-neutral-900' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.profile_name || c.wa_id}</span>
                {c.needs_attention && <span className="text-xs text-amber-400">atención</span>}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                <span>{new Date(c.last_message_at).toLocaleString('es-EC')}</span>
                {c.bot_paused && <span className="text-sky-400">bot pausado</span>}
              </div>
            </button>
          </li>
        ))}
        {contactos.length === 0 && (
          <li className="p-4 text-sm text-neutral-500">Todavía no hay conversaciones.</li>
        )}
      </ul>

      {activo ? (
        <section className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
            <div>
              <p className="font-medium">{activo.profile_name || activo.wa_id}</p>
              <p className="text-xs text-neutral-500">{activo.wa_id}</p>
            </div>
            <button
              onClick={pausar}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                activo.bot_paused ? 'bg-sky-600 text-white' : 'border border-neutral-700'
              }`}
            >
              {activo.bot_paused ? 'Bot pausado aquí' : 'Pausar bot en este chat'}
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-6">
            {mensajes.map((m) => (
              <div key={m.id} className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${COLOR_SENDER[m.sender]}`}>
                <p className="whitespace-pre-wrap">{m.body || `[${m.type}]`}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString('es-EC')}
                  {m.sender !== 'contacto' && ` · ${m.status}`}
                  {m.error && ` · ${m.error}`}
                </p>
              </div>
            ))}
          </div>

          <footer className="border-t border-neutral-800 p-4">
            {aviso && <p className="mb-2 text-sm text-red-400">{aviso}</p>}
            <div className="flex gap-2">
              <input
                value={texto} onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void enviar() }}
                placeholder="Escribe una respuesta…"
                className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm"
              />
              <button onClick={enviar} className="rounded-lg bg-emerald-500 px-4 text-sm font-medium text-neutral-950">
                Enviar
              </button>
            </div>
          </footer>
        </section>
      ) : (
        <section className="flex flex-1 items-center justify-center text-neutral-500">
          Selecciona una conversación
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Escribir la página**

`src/app/(panel)/inbox/page.tsx`:

```tsx
import { listContacts } from '@/lib/db/contacts'
import { Inbox } from '@/components/inbox/inbox'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const contactos = await listContacts()
  return <Inbox contactosIniciales={contactos} />
}
```

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev`, abrir `/inbox`.
Insertar un contacto y un mensaje de prueba con `npx tsx scripts/check-db.ts` corriendo en paralelo (o desde el editor SQL de Supabase) y comprobar que la conversación aparece **sin recargar** la página. Si no aparece, revisar que la tabla esté en la publicación `supabase_realtime` (migración, tarea 2).

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/app/\(panel\)/inbox src/components/inbox src/actions/inbox.ts
git commit -m "feat: inbox en vivo con respuesta manual y pausa del bot"
```

---

### Task 16: Pantalla del Bot con probador

**Files:**
- Create: `src/app/(panel)/bot/page.tsx`, `src/components/bot/bot-form.tsx`, `src/actions/bot.ts`

**Interfaces:**
- Consumes: `getConfig`, `updateConfig`, `ROLE_PROMPTS`, `ROLE_LABELS`, `buildChatMessages`, `generateReply`.
- Produces (server actions en `@/actions/bot`):
  - `guardarBot(formData: FormData): Promise<{ ok: boolean; mensaje: string }>`
  - `probarBot(texto: string): Promise<{ ok: boolean; respuesta: string }>`

- [ ] **Step 1: Escribir las server actions**

`src/actions/bot.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getConfig, updateConfig } from '@/lib/db/config'
import { buildChatMessages } from '@/lib/bot/prompt'
import { generateReply } from '@/lib/bot/openai'
import { supabaseServer } from '@/lib/supabase/server'
import type { BusinessHours } from '@/lib/types'

async function exigirSesion() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión')
}

const DIAS = ['0', '1', '2', '3', '4', '5', '6']

export async function guardarBot(formData: FormData): Promise<{ ok: boolean; mensaje: string }> {
  await exigirSesion()

  const horarioActivo = formData.get('horario_activo') === 'on'
  const days: BusinessHours['days'] = {}
  for (const dia of DIAS) {
    if (formData.get(`dia_${dia}`) !== 'on') continue
    const desde = String(formData.get(`desde_${dia}`) ?? '09:00')
    const hasta = String(formData.get(`hasta_${dia}`) ?? '18:00')
    days[dia] = [[desde, hasta]]
  }

  await updateConfig({
    bot_enabled: formData.get('bot_enabled') === 'on',
    bot_role: String(formData.get('bot_role') ?? 'personalizado'),
    system_prompt: String(formData.get('system_prompt') ?? '').trim(),
    welcome_message: String(formData.get('welcome_message') ?? '').trim(),
    out_of_hours_message: String(formData.get('out_of_hours_message') ?? '').trim(),
    openai_model: String(formData.get('openai_model') ?? 'gpt-4o-mini').trim(),
    escalation_keywords: String(formData.get('escalation_keywords') ?? '')
      .split(',').map((k) => k.trim()).filter(Boolean),
    business_hours: {
      enabled: horarioActivo,
      tz: String(formData.get('tz') ?? 'America/Guayaquil'),
      days,
    },
  })

  revalidatePath('/bot')
  return { ok: true, mensaje: 'Configuración guardada.' }
}

export async function probarBot(texto: string): Promise<{ ok: boolean; respuesta: string }> {
  await exigirSesion()
  if (texto.trim() === '') return { ok: false, respuesta: 'Escribe un mensaje de prueba.' }

  const config = await getConfig()
  const chat = buildChatMessages({
    config,
    history: [],
    incoming: {
      waMessageId: 'prueba', from: 'prueba', profileName: 'Prueba',
      type: 'text', body: texto.trim(),
    },
  })

  try {
    return { ok: true, respuesta: await generateReply(chat, { model: config.openai_model }) }
  } catch (err) {
    return { ok: false, respuesta: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
```

El probador no toca WhatsApp ni crea contactos: solo arma el prompt y llama a OpenAI.

- [ ] **Step 2: Escribir el formulario**

`src/components/bot/bot-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { guardarBot, probarBot } from '@/actions/bot'
import { ROLE_LABELS, ROLE_PROMPTS, type BotRole } from '@/lib/bot/roles'
import type { BotConfig } from '@/lib/types'

const DIAS: [string, string][] = [
  ['1', 'Lunes'], ['2', 'Martes'], ['3', 'Miércoles'], ['4', 'Jueves'],
  ['5', 'Viernes'], ['6', 'Sábado'], ['0', 'Domingo'],
]

export function BotForm({ config }: { config: BotConfig }) {
  const [prompt, setPrompt] = useState(config.system_prompt)
  const [aviso, setAviso] = useState<string | null>(null)
  const [prueba, setPrueba] = useState('')
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [probando, setProbando] = useState(false)

  return (
    <div className="space-y-6">
      <form
        action={async (fd) => setAviso((await guardarBot(fd)).mensaje)}
        className="space-y-5 rounded-xl border border-neutral-800 p-5"
      >
        <label className="flex items-center gap-3">
          <input type="checkbox" name="bot_enabled" defaultChecked={config.bot_enabled} className="size-4" />
          <span className="text-sm">Bot activo (si lo apagas, no responde ningún chat)</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-400">Rol</span>
          <select
            name="bot_role" defaultValue={config.bot_role}
            onChange={(e) => setPrompt(ROLE_PROMPTS[e.target.value as BotRole] ?? '')}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
          >
            {Object.entries(ROLE_LABELS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">Al cambiar el rol se carga su prompt base; puedes reescribirlo.</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-400">Instrucciones del bot</span>
          <textarea
            name="system_prompt" rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 font-mono text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-400">Mensaje de bienvenida (primer contacto)</span>
          <textarea
            name="welcome_message" rows={2} defaultValue={config.welcome_message}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="space-y-2 rounded-lg border border-neutral-800 p-4">
          <legend className="px-1 text-sm text-neutral-400">Horario de atención</legend>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="horario_activo" defaultChecked={config.business_hours.enabled} className="size-4" />
            <span className="text-sm">Responder solo dentro del horario</span>
          </label>
          <input
            name="tz" defaultValue={config.business_hours.tz || 'America/Guayaquil'}
            className="w-64 rounded-lg bg-neutral-800 px-3 py-1.5 text-sm"
          />
          {DIAS.map(([valor, etiqueta]) => {
            const franja = config.business_hours.days?.[valor]?.[0]
            return (
              <div key={valor} className="flex items-center gap-3 text-sm">
                <label className="flex w-32 items-center gap-2">
                  <input type="checkbox" name={`dia_${valor}`} defaultChecked={Boolean(franja)} className="size-4" />
                  {etiqueta}
                </label>
                <input type="time" name={`desde_${valor}`} defaultValue={franja?.[0] ?? '09:00'} className="rounded bg-neutral-800 px-2 py-1" />
                <input type="time" name={`hasta_${valor}`} defaultValue={franja?.[1] ?? '18:00'} className="rounded bg-neutral-800 px-2 py-1" />
              </div>
            )
          })}
          <label className="block space-y-1 pt-2">
            <span className="text-sm text-neutral-400">Mensaje fuera de horario</span>
            <input
              name="out_of_hours_message" defaultValue={config.out_of_hours_message}
              className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-400">Palabras que pasan el chat a un humano (separadas por coma)</span>
          <input
            name="escalation_keywords" defaultValue={config.escalation_keywords.join(', ')}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-400">Modelo de OpenAI</span>
          <input
            name="openai_model" defaultValue={config.openai_model}
            className="w-64 rounded-lg bg-neutral-800 px-3 py-2 font-mono text-sm"
          />
        </label>

        <button type="submit" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950">
          Guardar
        </button>
        {aviso && <p className="text-sm text-emerald-400">{aviso}</p>}
      </form>

      <section className="space-y-3 rounded-xl border border-neutral-800 p-5">
        <h2 className="text-sm font-semibold text-neutral-300">Probador</h2>
        <p className="text-xs text-neutral-500">Usa la configuración guardada. No envía nada por WhatsApp.</p>
        <div className="flex gap-2">
          <input
            value={prueba} onChange={(e) => setPrueba(e.target.value)}
            placeholder="Escribe lo que diría un cliente…"
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm"
          />
          <button
            onClick={async () => { setProbando(true); setRespuesta((await probarBot(prueba)).respuesta); setProbando(false) }}
            className="rounded-lg border border-neutral-700 px-4 text-sm"
          >
            {probando ? 'Pensando…' : 'Probar'}
          </button>
        </div>
        {respuesta && (
          <p className="whitespace-pre-wrap rounded-lg bg-neutral-900 p-4 text-sm">{respuesta}</p>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Escribir la página**

`src/app/(panel)/bot/page.tsx`:

```tsx
import { getConfig } from '@/lib/db/config'
import { BotForm } from '@/components/bot/bot-form'

export const dynamic = 'force-dynamic'

export default async function BotPage() {
  const config = await getConfig()
  return (
    <div className="h-screen overflow-y-auto p-8">
      <h1 className="mb-6 text-2xl font-semibold">Bot</h1>
      <BotForm config={config} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev`, abrir `/bot`.
Expected: cambiar el rol carga el prompt base; guardar y recargar mantiene los valores; el probador devuelve una respuesta real de OpenAI.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/app/\(panel\)/bot src/components/bot src/actions/bot.ts
git commit -m "feat: pantalla de configuración del bot con probador"
```

---

### Task 17: Pantalla de Leads

**Files:**
- Create: `src/app/(panel)/leads/page.tsx`, `src/components/leads/leads-table.tsx`, `src/actions/leads.ts`
- Create: `src/lib/db/metrics.ts`

**Interfaces:**
- Consumes: `listContacts`, `setContactFlags`, `supabaseAdmin`.
- Produces:
  - `getMetrics(): Promise<{ nuevos: number; recibidos: number; respondidosBot: number; escalados: number }>` desde `@/lib/db/metrics`
  - `cambiarEstadoLead(contactId: string, estado: ContactStatus): Promise<void>` desde `@/actions/leads`

- [ ] **Step 1: Escribir las métricas**

`src/lib/db/metrics.ts`:

```ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function contar(
  tabla: 'contacts' | 'messages',
  columna: string,
  valor: string | boolean,
): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq(columna, valor)
  if (error) return 0
  return count ?? 0
}

export async function getMetrics(): Promise<{
  nuevos: number; recibidos: number; respondidosBot: number; escalados: number
}> {
  const [nuevos, recibidos, respondidosBot, escalados] = await Promise.all([
    contar('contacts', 'status', 'nuevo'),
    contar('messages', 'direction', 'inbound'),
    contar('messages', 'sender', 'bot'),
    contar('contacts', 'needs_attention', true),
  ])

  return { nuevos, recibidos, respondidosBot, escalados }
}
```

- [ ] **Step 2: Escribir la server action**

`src/actions/leads.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { setContactFlags } from '@/lib/db/contacts'
import { supabaseServer } from '@/lib/supabase/server'
import type { ContactStatus } from '@/lib/types'

export async function cambiarEstadoLead(contactId: string, estado: ContactStatus): Promise<void> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión')

  await setContactFlags(contactId, { status: estado })
  revalidatePath('/leads')
}
```

- [ ] **Step 3: Escribir la tabla**

`src/components/leads/leads-table.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { cambiarEstadoLead } from '@/actions/leads'
import type { Contact, ContactStatus } from '@/lib/types'

const ESTADOS: [ContactStatus, string][] = [
  ['nuevo', 'Nuevo'],
  ['en_conversacion', 'En conversación'],
  ['calificado', 'Calificado'],
  ['atendido_humano', 'Atendido por humano'],
]

export function LeadsTable({ contactos }: { contactos: Contact[] }) {
  const [filtro, setFiltro] = useState<ContactStatus | 'todos'>('todos')
  const visibles = filtro === 'todos' ? contactos : contactos.filter((c) => c.status === filtro)

  return (
    <div className="space-y-4">
      <select
        value={filtro} onChange={(e) => setFiltro(e.target.value as ContactStatus | 'todos')}
        className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
      >
        <option value="todos">Todos</option>
        {ESTADOS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
      </select>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr>
            <th className="py-2">Contacto</th>
            <th>Número</th>
            <th>Último mensaje</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((c) => (
            <tr key={c.id} className="border-t border-neutral-800">
              <td className="py-2">{c.profile_name || '—'}</td>
              <td className="font-mono text-xs">{c.wa_id}</td>
              <td className="text-neutral-400">{new Date(c.last_message_at).toLocaleString('es-EC')}</td>
              <td>
                <select
                  defaultValue={c.status}
                  onChange={(e) => cambiarEstadoLead(c.id, e.target.value as ContactStatus)}
                  className="rounded bg-neutral-800 px-2 py-1 text-xs"
                >
                  {ESTADOS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibles.length === 0 && <p className="text-sm text-neutral-500">Sin contactos con ese estado.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Escribir la página**

`src/app/(panel)/leads/page.tsx`:

```tsx
import { listContacts } from '@/lib/db/contacts'
import { getMetrics } from '@/lib/db/metrics'
import { LeadsTable } from '@/components/leads/leads-table'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [contactos, metricas] = await Promise.all([listContacts(), getMetrics()])

  const tarjetas = [
    ['Conversaciones nuevas', metricas.nuevos],
    ['Mensajes recibidos', metricas.recibidos],
    ['Respondidos por el bot', metricas.respondidosBot],
    ['Escalados a humano', metricas.escalados],
  ] as const

  return (
    <div className="h-screen overflow-y-auto p-8">
      <h1 className="mb-6 text-2xl font-semibold">Leads</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tarjetas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-xl border border-neutral-800 p-4">
            <p className="text-xs text-neutral-500">{etiqueta}</p>
            <p className="mt-1 text-2xl font-semibold">{valor}</p>
          </div>
        ))}
      </div>

      <LeadsTable contactos={contactos} />
    </div>
  )
}
```

- [ ] **Step 5: Verificar a mano**

Run: `npm run dev`, abrir `/leads`.
Expected: se ven las 4 tarjetas y la tabla; cambiar el estado de un contacto y recargar mantiene el nuevo estado.

- [ ] **Step 6: Correr la suite completa y compilar**

Run: `npm test && npm run build`
Expected: PASS y build sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add src/app/\(panel\)/leads src/components/leads src/actions/leads.ts src/lib/db/metrics.ts
git commit -m "feat: pantalla de leads con métricas"
```

---

### Task 18: Despliegue y prueba real de punta a punta

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: app desplegada en Vercel, webhook suscrito en Meta, bot respondiendo a un mensaje real.

- [ ] **Step 1: Desplegar en Vercel**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
npx vercel --yes
```

En el dashboard de Vercel, añadir las variables de entorno de producción: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, y `APP_BASE_URL` con la URL definitiva del despliegue. Luego `npx vercel --prod`.

- [ ] **Step 2: Configurar el webhook en Meta**

En developers.facebook.com → tu app → WhatsApp → Configuración → Webhooks:
- URL de devolución de llamada: `https://<tu-dominio>/api/whatsapp/webhook`
- Token de verificación: el mismo que guardaste en la pantalla de Conexión.
- Suscribirse al campo **`messages`**.

Si Meta responde "The callback URL or verify token couldn't be validated", el verify token guardado no coincide o la app no está desplegada aún.

- [ ] **Step 3: Prueba real**

Con el bot activo en `/bot`, escribir desde un celular al número de WhatsApp.

Expected:
1. El mensaje aparece en `/inbox` en pocos segundos.
2. Llega el mensaje de bienvenida (si es el primer contacto) y luego la respuesta del bot.
3. En `/conexion`, "último evento recibido" dice *hace menos de un minuto*.
4. En `/leads` sube el contador de mensajes recibidos.

- [ ] **Step 4: Prueba de las reglas**

- Escribir la palabra clave de escalamiento → el bot no responde y el chat sale marcado como *atención* en el inbox.
- Pausar el bot en ese chat y volver a escribir → sigue sin responder.
- Responder a mano desde el inbox → llega al celular.
- Apagar el bot global en `/bot` y escribir → no responde nada.

- [ ] **Step 5: Escribir el README**

`README.md`:

```markdown
# Bot de WhatsApp — panel

Panel para conectar un número de WhatsApp (Cloud API de Meta) con un bot que responde con OpenAI.

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env.local` y rellenar las variables.
3. Aplicar `supabase/migrations/0001_init.sql` en el proyecto de Supabase.
4. Crear el usuario del panel en Supabase → Authentication → Users, y desactivar el registro público.
5. `npm run dev`

## Configurar Meta

En la pantalla **Conexión** están la URL del webhook y el token de verificación que hay que pegar en
developers.facebook.com → WhatsApp → Configuración → Webhooks, suscribiéndose al campo `messages`.
Los demás datos (Phone Number ID, WABA ID, token permanente, App Secret) se guardan desde esa misma pantalla.

## Comandos

- `npm run dev` — desarrollo
- `npm test` — pruebas
- `npm run build` — compilación
- `npx tsx scripts/check-db.ts` — verifica la conexión a Supabase y el anti-duplicados

## Límites conocidos

- Un solo número y un solo usuario.
- El bot solo responde mensajes de texto; a audios e imágenes contesta pidiendo texto.
- No se pueden iniciar conversaciones fuera de la ventana de 24 h de Meta (haría falta plantillas aprobadas).
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add README.md
git commit -m "docs: instrucciones de puesta en marcha"
```

---

## Notas para quien ejecute el plan

- **El modelo de OpenAI por defecto es `gpt-4o-mini`.** Es un valor de arranque editable desde `/bot`; confirmar contra los modelos disponibles en la cuenta del usuario antes de la prueba real de la tarea 18.
- **Meta reintenta las entregas.** Cualquier cambio que afecte a `insertInboundMessage` o al índice único de `wa_message_id` puede provocar respuestas duplicadas. Es el punto más frágil del sistema.
- **El `matcher` del middleware excluye `/api`.** Si se toca, verificar que el webhook siga entrando sin sesión.
- **La tabla `config` guarda secretos.** No añadir políticas RLS para `authenticated` ni leerla desde componentes cliente.
