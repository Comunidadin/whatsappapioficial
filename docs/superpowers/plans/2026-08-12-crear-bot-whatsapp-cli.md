# `crear-bot-whatsapp` — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un paquete de npm que con `npx crear-bot-whatsapp` deja a un alumno con su panel de bot de WhatsApp desplegado, con las tablas creadas, el número registrado y el webhook de Meta configurado.

**Architecture:** CLI en TypeScript compilado a `dist/`. La lógica pura (validaciones, orden de pasos, estado) vive en módulos sin red y se prueba con Vitest; cada API externa (Supabase, Meta, OpenAI, Vercel) tiene su módulo delgado que se simula en los tests. El proyecto del panel viaja dentro del paquete como carpeta `plantilla/`, sincronizada desde `[Bot Clase]` con un script.

**Tech Stack:** Node 20+, TypeScript, Vitest, `@clack/prompts`, `picocolors`. Sin dependencias de red: se usa el `fetch` global de Node.

**Spec:** `docs/superpowers/specs/2026-08-12-crear-bot-whatsapp-cli-design.md`

## Global Constraints

- Todo el texto que ve el alumno va en **español** y vive en `src/mensajes.ts`, nunca incrustado en la lógica.
- Node.js **20 o superior** (`engines` en `package.json`).
- Nombre del paquete: **`crear-bot-whatsapp`** (libre en npm al 2026-08-12).
- Versión de la Graph API de Meta: **`v21.0`**.
- Ningún módulo de red se prueba contra la API real: `fetch` y la ejecución de comandos se simulan.
- Las credenciales **nunca** se escriben en `.crear-bot.json`; solo en `.env.local` del proyecto generado.
- Orden obligatorio (del spec): tablas → variables en Vercel → desplegar → URL → token de verificación en `config` → webhook en Meta.
- Directorio del paquete: `/Users/joffrellerena/Desktop/[Bot Clase]/crear-bot-whatsapp`.
- Commits en español, formato `feat:` / `fix:` / `test:` / `chore:`.

---

## Estructura de archivos

```
crear-bot-whatsapp/
  package.json  tsconfig.json  vitest.config.mts
  bin/crear-bot-whatsapp.js        # shim ejecutable → dist/index.js
  src/
    index.ts                       # arranque: comprueba Node, lanza el orquestador
    mensajes.ts                    # todos los textos al alumno
    validar.ts                     # validaciones de formato, sin red
    estado.ts                      # .crear-bot.json: leer, escribir, marcar pasos
    ejecutar.ts                    # envoltorio de child_process
    api/openai.ts                  # validar la key
    api/supabase.ts                # ejecutar SQL (Management API), escribir config
    api/meta.ts                    # token, números, registro, webhook, subscribed_apps
    api/vercel.ts                  # proyecto, variables, despliegue
    plantilla.ts                   # copiar la plantilla e instalar dependencias
    pasos.ts                       # el orden, la reanudación, los errores
    preguntas.ts                   # el diálogo con el alumno
  plantilla/                       # el panel, sincronizado desde el proyecto padre
  scripts/sincronizar-plantilla.mjs
  web/index.html                   # landing con el botón de copiar
  tests/
```

---

### Task 1: Andamiaje del paquete

**Files:**
- Create: `crear-bot-whatsapp/package.json`, `tsconfig.json`, `vitest.config.mts`, `bin/crear-bot-whatsapp.js`, `src/index.ts`, `src/mensajes.ts`
- Test: `tests/mensajes.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `MENSAJES` (objeto con los textos), `NODE_MINIMO = 20`, ejecutable `crear-bot-whatsapp`.

- [ ] **Step 1: Crear el package.json**

```json
{
  "name": "crear-bot-whatsapp",
  "version": "0.1.0",
  "description": "Crea tu panel de bot de WhatsApp: base de datos, despliegue y webhook, en un solo comando",
  "type": "module",
  "bin": { "crear-bot-whatsapp": "bin/crear-bot-whatsapp.js" },
  "files": ["bin", "dist", "plantilla"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "sincronizar": "node scripts/sincronizar-plantilla.mjs",
    "prepublishOnly": "npm run sincronizar && npm run build && npm test"
  },
  "dependencies": { "@clack/prompts": "^0.11.0", "picocolors": "^1.1.1" },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^4.1.0", "@types/node": "^22.10.0" }
}
```

- [ ] **Step 2: Crear tsconfig.json y vitest.config.mts**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false
  },
  "include": ["src"]
}
```

`vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 3: Escribir el test que falla**

`tests/mensajes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MENSAJES, NODE_MINIMO } from '../src/mensajes.js'

describe('mensajes', () => {
  it('exige Node 20 o superior', () => {
    expect(NODE_MINIMO).toBe(20)
  })

  it('el aviso de Node viejo dice qué versión hace falta', () => {
    expect(MENSAJES.nodeViejo('18.0.0')).toContain('18.0.0')
    expect(MENSAJES.nodeViejo('18.0.0')).toContain('20')
  })

  it('todos los mensajes están en español, sin cadenas vacías', () => {
    const textos = Object.values(MENSAJES).filter((v) => typeof v === 'string') as string[]
    expect(textos.length).toBeGreaterThan(0)
    expect(textos.every((t) => t.trim() !== '')).toBe(true)
  })
})
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `cd "/Users/joffrellerena/Desktop/[Bot Clase]/crear-bot-whatsapp" && npm install && npm test`
Expected: FAIL — no existe `src/mensajes.ts`.

- [ ] **Step 5: Escribir los mensajes**

`src/mensajes.ts`:

```ts
export const NODE_MINIMO = 20

export const MENSAJES = {
  bienvenida: 'Vamos a crear tu bot de WhatsApp. Son unos minutos y te voy pidiendo lo que haga falta.',
  nodeViejo: (actual: string) =>
    `Tienes Node ${actual} y hace falta la 20 o superior. Instálala desde nodejs.org y vuelve a intentarlo.`,
  antesDeEmpezar: [
    'Antes de empezar necesitas tener a mano:',
    '  1. Un proyecto creado en Supabase (supabase.com)',
    '  2. Una API key de OpenAI con saldo (platform.openai.com)',
    '  3. Una app de Meta con WhatsApp y un número (developers.facebook.com)',
    '  4. Una cuenta de Vercel (vercel.com)',
  ].join('\n'),
  avisoNumero:
    'Ojo: al registrar el número en la API, deja de funcionar en la app normal de WhatsApp del celular. Usa una línea dedicada, no tu número personal.',
  tokenSinActivos: [
    'Tu token de Meta es válido pero no tiene ninguna cuenta de WhatsApp asignada.',
    'Ve a Business Suite → Configuración del negocio → Usuarios del sistema,',
    'asigna tu cuenta de WhatsApp con control total, y GENERA UN TOKEN NUEVO.',
    'El token actual no va a servir aunque asignes la cuenta ahora: los permisos',
    'quedan grabados dentro del token en el momento de crearlo.',
  ].join('\n'),
  listo: 'Listo. Tu bot está desplegado y respondiendo.',
  pendiente:
    'Solo te queda una cosa: entra al panel, escribe las instrucciones del bot y enciéndelo.',
}
```

- [ ] **Step 6: Escribir el ejecutable y el arranque**

`bin/crear-bot-whatsapp.js`:

```js
#!/usr/bin/env node
import('../dist/index.js')
```

`src/index.ts`:

```ts
import { MENSAJES, NODE_MINIMO } from './mensajes.js'

const mayor = Number(process.versions.node.split('.')[0])
if (mayor < NODE_MINIMO) {
  console.error(MENSAJES.nodeViejo(process.versions.node))
  process.exit(1)
}

console.log(MENSAJES.bienvenida)
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS (3 tests)

- [ ] **Step 8: Probar el ejecutable**

Run: `npm run build && node bin/crear-bot-whatsapp.js`
Expected: imprime la bienvenida.

- [ ] **Step 9: Commit**

```bash
cd "/Users/joffrellerena/Desktop/[Bot Clase]"
git add crear-bot-whatsapp
git commit -m "chore: andamiaje del paquete crear-bot-whatsapp"
```

---

### Task 2: Validaciones de formato

**Files:**
- Create: `crear-bot-whatsapp/src/validar.ts`
- Test: `tests/validar.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Resultado = { ok: true } | { ok: false; motivo: string }`
  - `validarUrlSupabase(valor: string): Resultado` — acepta `https://<ref>.supabase.co`, rechaza la que trae `/rest/v1`
  - `refDeSupabase(url: string): string` — devuelve `<ref>`
  - `validarSecretKey(valor: string): Resultado` — exige prefijo `sb_secret_`
  - `validarPublishableKey(valor: string): Resultado` — exige prefijo `sb_publishable_`
  - `validarPat(valor: string): Resultado` — exige prefijo `sbp_`
  - `validarPin(valor: string): Resultado` — exactamente 6 dígitos
  - `validarNombreCarpeta(valor: string): Resultado`

- [ ] **Step 1: Escribir el test que falla**

`tests/validar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  validarUrlSupabase, refDeSupabase, validarSecretKey, validarPublishableKey,
  validarPat, validarPin, validarNombreCarpeta,
} from '../src/validar.js'

describe('validarUrlSupabase', () => {
  it('acepta la URL del proyecto', () => {
    expect(validarUrlSupabase('https://nxieepcukyekvcticrqo.supabase.co')).toEqual({ ok: true })
  })

  it('rechaza la URL con /rest/v1 y lo explica', () => {
    const r = validarUrlSupabase('https://nxieepcukyekvcticrqo.supabase.co/rest/v1/')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('/rest/v1')
  })

  it('rechaza cualquier otra cosa', () => {
    expect(validarUrlSupabase('nxieepcukyekvcticrqo').ok).toBe(false)
    expect(validarUrlSupabase('https://google.com').ok).toBe(false)
  })
})

describe('refDeSupabase', () => {
  it('saca el identificador del proyecto', () => {
    expect(refDeSupabase('https://nxieepcukyekvcticrqo.supabase.co')).toBe('nxieepcukyekvcticrqo')
  })
})

describe('validaciones de claves', () => {
  it('distingue secret de publishable', () => {
    expect(validarSecretKey('sb_secret_abc').ok).toBe(true)
    expect(validarSecretKey('sb_publishable_abc').ok).toBe(false)
    expect(validarPublishableKey('sb_publishable_abc').ok).toBe(true)
    expect(validarPublishableKey('sb_secret_abc').ok).toBe(false)
  })

  it('el error de secret menciona el prefijo correcto', () => {
    const r = validarSecretKey('sb_publishable_abc')
    if (!r.ok) expect(r.motivo).toContain('sb_secret_')
  })

  it('el personal access token empieza por sbp_', () => {
    expect(validarPat('sbp_1234').ok).toBe(true)
    expect(validarPat('sb_secret_1234').ok).toBe(false)
  })
})

describe('validarPin', () => {
  it('exige exactamente 6 dígitos', () => {
    expect(validarPin('452817').ok).toBe(true)
    expect(validarPin('45281').ok).toBe(false)
    expect(validarPin('4528170').ok).toBe(false)
    expect(validarPin('45281a').ok).toBe(false)
  })
})

describe('validarNombreCarpeta', () => {
  it('acepta un nombre sencillo', () => {
    expect(validarNombreCarpeta('mi-bot').ok).toBe(true)
  })

  it('rechaza vacío, espacios y barras', () => {
    expect(validarNombreCarpeta('').ok).toBe(false)
    expect(validarNombreCarpeta('mi bot').ok).toBe(false)
    expect(validarNombreCarpeta('mi/bot').ok).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/validar.test.ts`
Expected: FAIL — no existe `src/validar.ts`.

- [ ] **Step 3: Implementar**

`src/validar.ts`:

```ts
export type Resultado = { ok: true } | { ok: false; motivo: string }

const ok: Resultado = { ok: true }
const mal = (motivo: string): Resultado => ({ ok: false, motivo })

const URL_SUPABASE = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/

export function validarUrlSupabase(valor: string): Resultado {
  const limpio = valor.trim()
  if (limpio.includes('/rest/v1')) {
    return mal('Quita el /rest/v1 del final: hace falta solo https://tuproyecto.supabase.co')
  }
  if (!URL_SUPABASE.test(limpio)) {
    return mal('No parece la URL de un proyecto de Supabase. Debe ser https://algo.supabase.co')
  }
  return ok
}

export function refDeSupabase(url: string): string {
  const m = url.trim().match(URL_SUPABASE)
  if (!m) throw new Error(`URL de Supabase no válida: ${url}`)
  return m[1]
}

function conPrefijo(prefijo: string, nombre: string) {
  return (valor: string): Resultado =>
    valor.trim().startsWith(prefijo)
      ? ok
      : mal(`Esa no es la ${nombre}: tiene que empezar por ${prefijo}`)
}

export const validarSecretKey = conPrefijo('sb_secret_', 'clave secreta')
export const validarPublishableKey = conPrefijo('sb_publishable_', 'clave publicable')
export const validarPat = conPrefijo('sbp_', 'clave de acceso personal')

export function validarPin(valor: string): Resultado {
  return /^\d{6}$/.test(valor.trim()) ? ok : mal('El PIN son exactamente 6 dígitos')
}

export function validarNombreCarpeta(valor: string): Resultado {
  const limpio = valor.trim()
  if (limpio === '') return mal('Escribe un nombre para la carpeta')
  if (!/^[a-zA-Z0-9._-]+$/.test(limpio)) {
    return mal('Usa solo letras, números, guiones y puntos, sin espacios')
  }
  return ok
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/validar.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add crear-bot-whatsapp/src/validar.ts crear-bot-whatsapp/tests/validar.test.ts
git commit -m "feat: validaciones de formato de las credenciales"
```

---

### Task 3: Estado y reanudación

**Files:**
- Create: `crear-bot-whatsapp/src/estado.ts`
- Test: `tests/estado.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Paso = 'plantilla' | 'tablas' | 'numero' | 'config' | 'vercel' | 'webhook' | 'waba' | 'comprobacion'`
  - `type Estado = { version: 1; hechos: Paso[]; datos: Record<string, string> }`
  - `leerEstado(carpeta: string): Promise<Estado>` — devuelve estado vacío si no hay archivo
  - `guardarEstado(carpeta: string, estado: Estado): Promise<void>`
  - `marcarHecho(estado: Estado, paso: Paso, datos?: Record<string, string>): Estado`
  - `estaHecho(estado: Estado, paso: Paso): boolean`
  - `CLAVES_PROHIBIDAS: string[]` — nombres que nunca deben guardarse

- [ ] **Step 1: Escribir el test que falla**

`tests/estado.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { leerEstado, guardarEstado, marcarHecho, estaHecho } from '../src/estado.js'

let carpeta: string

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'crear-bot-'))
})

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

describe('estado', () => {
  it('sin archivo devuelve un estado vacío', async () => {
    const e = await leerEstado(carpeta)
    expect(e.hechos).toEqual([])
    expect(e.datos).toEqual({})
  })

  it('guarda y vuelve a leer', async () => {
    await guardarEstado(carpeta, marcarHecho(await leerEstado(carpeta), 'tablas'))
    const e = await leerEstado(carpeta)
    expect(estaHecho(e, 'tablas')).toBe(true)
    expect(estaHecho(e, 'vercel')).toBe(false)
  })

  it('marcar dos veces el mismo paso no lo duplica', () => {
    const e = marcarHecho(marcarHecho({ version: 1, hechos: [], datos: {} }, 'tablas'), 'tablas')
    expect(e.hechos).toEqual(['tablas'])
  })

  it('guarda datos no secretos junto al paso', async () => {
    const e = marcarHecho({ version: 1, hechos: [], datos: {} }, 'vercel', {
      urlDesplegada: 'https://x.vercel.app',
    })
    await guardarEstado(carpeta, e)
    expect((await leerEstado(carpeta)).datos.urlDesplegada).toBe('https://x.vercel.app')
  })

  it('se niega a guardar credenciales', async () => {
    const e = marcarHecho({ version: 1, hechos: [], datos: {} }, 'tablas', {
      metaToken: 'EAAG...',
    })
    await expect(guardarEstado(carpeta, e)).rejects.toThrow(/credencial/i)
  })

  it('un archivo corrupto no rompe: se empieza de cero', async () => {
    await writeFile(join(carpeta, '.crear-bot.json'), '{esto no es json')
    expect((await leerEstado(carpeta)).hechos).toEqual([])
  })

  it('el archivo guardado es legible por una persona', async () => {
    await guardarEstado(carpeta, marcarHecho(await leerEstado(carpeta), 'tablas'))
    const crudo = await readFile(join(carpeta, '.crear-bot.json'), 'utf8')
    expect(crudo).toContain('\n')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/estado.test.ts`
Expected: FAIL — no existe `src/estado.ts`.

- [ ] **Step 3: Implementar**

`src/estado.ts`:

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Paso =
  | 'plantilla' | 'tablas' | 'numero' | 'config'
  | 'vercel' | 'webhook' | 'waba' | 'comprobacion'

export type Estado = { version: 1; hechos: Paso[]; datos: Record<string, string> }

const ARCHIVO = '.crear-bot.json'

/** Nada que huela a credencial entra en el archivo de estado. */
export const CLAVES_PROHIBIDAS = ['token', 'key', 'secret', 'pat', 'pin', 'password']

export async function leerEstado(carpeta: string): Promise<Estado> {
  try {
    const crudo = await readFile(join(carpeta, ARCHIVO), 'utf8')
    const leido = JSON.parse(crudo) as Estado
    return {
      version: 1,
      hechos: Array.isArray(leido.hechos) ? leido.hechos : [],
      datos: leido.datos ?? {},
    }
  } catch {
    return { version: 1, hechos: [], datos: {} }
  }
}

export async function guardarEstado(carpeta: string, estado: Estado): Promise<void> {
  for (const clave of Object.keys(estado.datos)) {
    const minuscula = clave.toLowerCase()
    if (CLAVES_PROHIBIDAS.some((p) => minuscula.includes(p))) {
      throw new Error(`No se guarda "${clave}": parece una credencial y esas van solo en .env.local`)
    }
  }
  await writeFile(join(carpeta, ARCHIVO), JSON.stringify(estado, null, 2) + '\n', 'utf8')
}

export function marcarHecho(
  estado: Estado,
  paso: Paso,
  datos: Record<string, string> = {},
): Estado {
  return {
    version: 1,
    hechos: estado.hechos.includes(paso) ? estado.hechos : [...estado.hechos, paso],
    datos: { ...estado.datos, ...datos },
  }
}

export function estaHecho(estado: Estado, paso: Paso): boolean {
  return estado.hechos.includes(paso)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/estado.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add crear-bot-whatsapp/src/estado.ts crear-bot-whatsapp/tests/estado.test.ts
git commit -m "feat: estado y reanudación del instalador"
```

---

### Task 4: Cliente de Meta

**Files:**
- Create: `crear-bot-whatsapp/src/api/meta.ts`
- Test: `tests/meta.test.ts`

**Interfaces:**
- Consumes: `MENSAJES` de `../mensajes.js`.
- Produces:
  - `type Numero = { id: string; numero: string; nombre: string; estado: string; plataforma: string }`
  - `revisarToken(token: string): Promise<{ valido: boolean; tieneActivos: boolean; motivo?: string }>`
  - `buscarWabas(token: string, businessId?: string): Promise<string[]>` — vía `/me/businesses` → `owned_whatsapp_business_accounts`
  - `listarNumeros(token: string, wabaId: string): Promise<Numero[]>`
  - `registrarNumero(token: string, numeroId: string, pin: string): Promise<void>`
  - `estadoNumero(token: string, numeroId: string): Promise<Numero>`
  - `conectarAppAlWaba(token: string, wabaId: string): Promise<void>`
  - `configurarWebhook(input: { appId: string; appSecret: string; url: string; verifyToken: string }): Promise<void>`

- [ ] **Step 1: Escribir el test que falla**

`tests/meta.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  revisarToken, listarNumeros, registrarNumero, estadoNumero,
  conectarAppAlWaba, configurarWebhook,
} from '../src/api/meta.js'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const json = (cuerpo: unknown, ok = true, status = 200) => ({
  ok, status, text: async () => JSON.stringify(cuerpo),
})

describe('revisarToken', () => {
  it('detecta un token válido con activos', async () => {
    fetchMock.mockResolvedValue(json({
      data: {
        is_valid: true,
        granular_scopes: [{ scope: 'whatsapp_business_messaging', target_ids: ['132'] }],
      },
    }))
    expect(await revisarToken('EAAG')).toEqual({ valido: true, tieneActivos: true })
  })

  it('detecta el token sin activos asignados', async () => {
    fetchMock.mockResolvedValue(json({
      data: { is_valid: true, granular_scopes: [{ scope: 'whatsapp_business_messaging' }] },
    }))
    const r = await revisarToken('EAAG')
    expect(r).toMatchObject({ valido: true, tieneActivos: false })
    expect(r.motivo).toContain('TOKEN NUEVO')
  })

  it('detecta un token inválido', async () => {
    fetchMock.mockResolvedValue(json({ data: { is_valid: false } }))
    expect(await revisarToken('malo')).toMatchObject({ valido: false })
  })
})

describe('listarNumeros', () => {
  it('devuelve los números del WABA', async () => {
    fetchMock.mockResolvedValue(json({
      data: [{
        id: '117', display_phone_number: '+593 96 884 4837',
        verified_name: 'Joffre', status: 'CONNECTED', platform_type: 'CLOUD_API',
      }],
    }))
    expect(await listarNumeros('EAAG', '132')).toEqual([
      { id: '117', numero: '+593 96 884 4837', nombre: 'Joffre', estado: 'CONNECTED', plataforma: 'CLOUD_API' },
    ])
  })

  it('lanza con el mensaje de Meta si falla', async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'Object does not exist' } }, false, 400))
    await expect(listarNumeros('EAAG', '132')).rejects.toThrow('Object does not exist')
  })
})

describe('estadoNumero y registrarNumero', () => {
  it('lee el estado del número', async () => {
    fetchMock.mockResolvedValue(json({
      id: '117', display_phone_number: '+593', verified_name: 'J',
      status: 'PENDING', platform_type: 'NOT_APPLICABLE',
    }))
    expect((await estadoNumero('EAAG', '117')).estado).toBe('PENDING')
  })

  it('registra el número con el PIN', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    await registrarNumero('EAAG', '117', '452817')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/117/register')
    expect(JSON.parse(init.body)).toEqual({ messaging_product: 'whatsapp', pin: '452817' })
  })

  it('no falla si el número ya estaba registrado', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { message: 'Phone number already registered', code: 133005 } }, false, 400),
    )
    await expect(registrarNumero('EAAG', '117', '452817')).resolves.toBeUndefined()
  })
})

describe('conectarAppAlWaba', () => {
  it('hace POST a subscribed_apps', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    await conectarAppAlWaba('EAAG', '132')
    expect(fetchMock.mock.calls[0][0]).toContain('/132/subscribed_apps')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})

describe('configurarWebhook', () => {
  it('usa el token de app y suscribe el campo messages', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    await configurarWebhook({
      appId: '225', appSecret: 'sec', url: 'https://x.vercel.app/api/whatsapp/webhook',
      verifyToken: 'tok-123',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/225/subscriptions')
    const cuerpo = JSON.parse(init.body)
    expect(cuerpo.object).toBe('whatsapp_business_account')
    expect(cuerpo.fields).toContain('messages')
    expect(cuerpo.callback_url).toBe('https://x.vercel.app/api/whatsapp/webhook')
    expect(cuerpo.verify_token).toBe('tok-123')
    expect(cuerpo.access_token).toBe('225|sec')
  })

  it('explica el fallo de verificación en lugar de soltar el error crudo', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { message: "The URL couldn't be validated" } }, false, 400),
    )
    await expect(
      configurarWebhook({ appId: '225', appSecret: 'sec', url: 'https://x', verifyToken: 't' }),
    ).rejects.toThrow(/verificar/i)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/meta.test.ts`
Expected: FAIL — no existe `src/api/meta.ts`.

- [ ] **Step 3: Implementar**

`src/api/meta.ts`:

```ts
import { MENSAJES } from '../mensajes.js'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type Numero = {
  id: string
  numero: string
  nombre: string
  estado: string
  plataforma: string
}

type Respuesta = { ok: boolean; status: number; text: () => Promise<string> }

async function leer(res: Respuesta): Promise<Record<string, unknown>> {
  const crudo = await res.text()
  let cuerpo: Record<string, unknown> = {}
  try {
    cuerpo = JSON.parse(crudo)
  } catch {
    throw new Error(`Meta respondió algo que no es JSON (HTTP ${res.status})`)
  }
  if (!res.ok) {
    const error = cuerpo.error as { message?: string } | undefined
    throw new Error(error?.message ?? `Meta respondió HTTP ${res.status}`)
  }
  return cuerpo
}

async function pedir(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  return leer(res as unknown as Respuesta)
}

export async function revisarToken(
  token: string,
): Promise<{ valido: boolean; tieneActivos: boolean; motivo?: string }> {
  const cuerpo = await pedir(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`,
    token,
  )
  const data = (cuerpo.data ?? {}) as {
    is_valid?: boolean
    granular_scopes?: { scope: string; target_ids?: string[] }[]
  }

  if (!data.is_valid) {
    return { valido: false, tieneActivos: false, motivo: 'El token no es válido o ya caducó.' }
  }

  const tieneActivos = (data.granular_scopes ?? []).some(
    (s) => Array.isArray(s.target_ids) && s.target_ids.length > 0,
  )

  return tieneActivos
    ? { valido: true, tieneActivos: true }
    : { valido: true, tieneActivos: false, motivo: MENSAJES.tokenSinActivos }
}

export async function buscarWabas(token: string): Promise<string[]> {
  const negocios = (await pedir(`${GRAPH}/me/businesses?fields=id`, token)).data as
    | { id: string }[]
    | undefined

  const wabas: string[] = []
  for (const negocio of negocios ?? []) {
    const propias = (await pedir(
      `${GRAPH}/${negocio.id}/owned_whatsapp_business_accounts?fields=id`,
      token,
    )).data as { id: string }[] | undefined
    for (const waba of propias ?? []) wabas.push(waba.id)
  }
  return wabas
}

function aNumero(fila: Record<string, unknown>): Numero {
  return {
    id: String(fila.id ?? ''),
    numero: String(fila.display_phone_number ?? ''),
    nombre: String(fila.verified_name ?? ''),
    estado: String(fila.status ?? 'DESCONOCIDO'),
    plataforma: String(fila.platform_type ?? 'NOT_APPLICABLE'),
  }
}

const CAMPOS = 'id,display_phone_number,verified_name,status,platform_type'

export async function listarNumeros(token: string, wabaId: string): Promise<Numero[]> {
  const cuerpo = await pedir(`${GRAPH}/${wabaId}/phone_numbers?fields=${CAMPOS}`, token)
  return ((cuerpo.data ?? []) as Record<string, unknown>[]).map(aNumero)
}

export async function estadoNumero(token: string, numeroId: string): Promise<Numero> {
  return aNumero(await pedir(`${GRAPH}/${numeroId}?fields=${CAMPOS}`, token))
}

export async function registrarNumero(
  token: string,
  numeroId: string,
  pin: string,
): Promise<void> {
  try {
    await pedir(`${GRAPH}/${numeroId}/register`, token, {
      method: 'POST',
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    // Registrar dos veces no es un fallo: el resultado buscado ya se cumplió.
    if (mensaje.includes('already registered')) return
    throw err
  }
}

export async function conectarAppAlWaba(token: string, wabaId: string): Promise<void> {
  await pedir(`${GRAPH}/${wabaId}/subscribed_apps`, token, { method: 'POST' })
}

export async function configurarWebhook(input: {
  appId: string
  appSecret: string
  url: string
  verifyToken: string
}): Promise<void> {
  const res = await fetch(`${GRAPH}/${input.appId}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      callback_url: input.url,
      verify_token: input.verifyToken,
      fields: ['messages'],
      access_token: `${input.appId}|${input.appSecret}`,
    }),
  })

  try {
    await leer(res as unknown as Respuesta)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    if (mensaje.toLowerCase().includes('validat')) {
      throw new Error(
        `Meta no pudo verificar tu webhook (${input.url}). Suele significar que el despliegue ` +
          'quedó sin variables de entorno o que el token de verificación no llegó a guardarse.',
      )
    }
    throw err
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/meta.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add crear-bot-whatsapp/src/api/meta.ts crear-bot-whatsapp/tests/meta.test.ts
git commit -m "feat: cliente de la API de Meta"
```

---

### Task 5: Clientes de Supabase y OpenAI

**Files:**
- Create: `crear-bot-whatsapp/src/api/supabase.ts`, `crear-bot-whatsapp/src/api/openai.ts`
- Test: `tests/supabase.test.ts`, `tests/openai.test.ts`

**Interfaces:**
- Consumes: `refDeSupabase` de `../validar.js`.
- Produces:
  - `ejecutarSql(pat: string, ref: string, sql: string): Promise<void>`
  - `comprobarSecretKey(url: string, secretKey: string): Promise<{ ok: boolean; motivo?: string }>`
  - `guardarConfig(url: string, secretKey: string, campos: Record<string, string>): Promise<void>`
  - `comprobarKeyOpenai(key: string): Promise<{ ok: boolean; motivo?: string }>`

- [ ] **Step 1: Escribir los tests que fallan**

`tests/supabase.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ejecutarSql, comprobarSecretKey, guardarConfig } from '../src/api/supabase.js'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const resp = (cuerpo: unknown, ok = true, status = 200) => ({
  ok, status, text: async () => JSON.stringify(cuerpo),
})

describe('ejecutarSql', () => {
  it('manda el SQL a la Management API con el token personal', async () => {
    fetchMock.mockResolvedValue(resp([]))
    await ejecutarSql('sbp_123', 'abcdef', 'create table x ();')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.supabase.com/v1/projects/abcdef/database/query')
    expect(init.headers.Authorization).toBe('Bearer sbp_123')
    expect(JSON.parse(init.body).query).toContain('create table x ()')
  })

  it('lanza con el error de Postgres', async () => {
    fetchMock.mockResolvedValue(resp({ message: 'syntax error at or near "crate"' }, false, 400))
    await expect(ejecutarSql('sbp_123', 'abcdef', 'crate table')).rejects.toThrow('syntax error')
  })
})

describe('comprobarSecretKey', () => {
  it('acepta una clave que responde', async () => {
    fetchMock.mockResolvedValue(resp([]))
    expect(await comprobarSecretKey('https://abc.supabase.co', 'sb_secret_x')).toEqual({ ok: true })
  })

  it('rechaza una clave que da 401', async () => {
    fetchMock.mockResolvedValue(resp({ message: 'Invalid API key' }, false, 401))
    const r = await comprobarSecretKey('https://abc.supabase.co', 'sb_secret_x')
    expect(r.ok).toBe(false)
  })
})

describe('guardarConfig', () => {
  it('hace PATCH sobre la única fila de config', async () => {
    fetchMock.mockResolvedValue(resp({}, true, 204))
    await guardarConfig('https://abc.supabase.co', 'sb_secret_x', { verify_token: 'tok' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://abc.supabase.co/rest/v1/config?id=eq.true')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ verify_token: 'tok' })
  })
})
```

`tests/openai.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { comprobarKeyOpenai } from '../src/api/openai.js'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const resp = (cuerpo: unknown, ok = true, status = 200) => ({
  ok, status, text: async () => JSON.stringify(cuerpo),
})

describe('comprobarKeyOpenai', () => {
  it('acepta una key que responde', async () => {
    fetchMock.mockResolvedValue(resp({ choices: [{ message: { content: 'ok' } }] }))
    expect(await comprobarKeyOpenai('sk-x')).toEqual({ ok: true })
  })

  it('distingue una key inválida de una sin saldo', async () => {
    fetchMock.mockResolvedValue(resp({ error: { message: 'Incorrect API key' } }, false, 401))
    const invalida = await comprobarKeyOpenai('sk-mala')
    expect(invalida.motivo).toContain('no es válida')

    fetchMock.mockResolvedValue(
      resp({ error: { message: 'You exceeded your current quota' } }, false, 429),
    )
    const sinSaldo = await comprobarKeyOpenai('sk-x')
    expect(sinSaldo.motivo).toContain('saldo')
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- tests/supabase.test.ts tests/openai.test.ts`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar Supabase**

`src/api/supabase.ts`:

```ts
const MANAGEMENT = 'https://api.supabase.com/v1'

async function cuerpoDe(res: { ok: boolean; status: number; text: () => Promise<string> }) {
  const crudo = await res.text()
  if (res.ok) return crudo
  try {
    const json = JSON.parse(crudo) as { message?: string; error?: string }
    throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
  } catch (err) {
    if (err instanceof Error && err.message !== 'Unexpected token') throw err
    throw new Error(crudo || `HTTP ${res.status}`)
  }
}

export async function ejecutarSql(pat: string, ref: string, sql: string): Promise<void> {
  const res = await fetch(`${MANAGEMENT}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  await cuerpoDe(res)
}

export async function comprobarSecretKey(
  url: string,
  secretKey: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const res = await fetch(`${url}/rest/v1/config?select=id&limit=1`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  })

  if (res.ok) return { ok: true }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, motivo: 'Esa clave secreta no es válida para este proyecto.' }
  }
  // 404 = las tablas aún no existen; la clave sirve.
  if (res.status === 404) return { ok: true }
  return { ok: false, motivo: `Supabase respondió HTTP ${res.status}.` }
}

export async function guardarConfig(
  url: string,
  secretKey: string,
  campos: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${url}/rest/v1/config?id=eq.true`, {
    method: 'PATCH',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(campos),
  })
  if (!res.ok) throw new Error(`No se pudo guardar la configuración: HTTP ${res.status}`)
}
```

- [ ] **Step 4: Implementar OpenAI**

`src/api/openai.ts`:

```ts
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
    return { ok: false, motivo: 'Esa key de OpenAI no es válida. Cópiala otra vez desde platform.openai.com.' }
  }
  if (res.status === 429) {
    return {
      ok: false,
      motivo: 'La key es correcta pero la cuenta no tiene saldo. Carga crédito en platform.openai.com y vuelve a intentarlo.',
    }
  }
  return { ok: false, motivo: `OpenAI respondió HTTP ${res.status}.` }
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -- tests/supabase.test.ts tests/openai.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add crear-bot-whatsapp/src/api crear-bot-whatsapp/tests/supabase.test.ts crear-bot-whatsapp/tests/openai.test.ts
git commit -m "feat: clientes de Supabase y OpenAI"
```

---

### Task 6: Plantilla del proyecto

**Files:**
- Create: `crear-bot-whatsapp/scripts/sincronizar-plantilla.mjs`, `crear-bot-whatsapp/src/plantilla.ts`, `crear-bot-whatsapp/src/ejecutar.ts`
- Test: `tests/plantilla.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ejecutar(comando: string, args: string[], opciones?: { cwd?: string; heredar?: boolean }): Promise<{ salida: string }>`
  - `copiarPlantilla(destino: string): Promise<void>`
  - `escribirEnv(destino: string, variables: Record<string, string>): Promise<void>`
  - `instalarDependencias(destino: string): Promise<void>`
  - `RAIZ_PLANTILLA: string`

- [ ] **Step 1: Escribir el script de sincronización**

`scripts/sincronizar-plantilla.mjs`:

```js
import { cp, rm, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const panel = join(aqui, '..', '..')       // [Bot Clase]
const destino = join(aqui, '..', 'plantilla')

const EXCLUIR = new Set([
  'node_modules', '.next', '.git', '.vercel', 'dist',
  'crear-bot-whatsapp', 'docs', '.crear-bot.json',
])

await rm(destino, { recursive: true, force: true })

for (const entrada of await readdir(panel, { withFileTypes: true })) {
  if (EXCLUIR.has(entrada.name)) continue
  if (entrada.name.startsWith('.env')) continue   // nunca copiar credenciales
  await cp(join(panel, entrada.name), join(destino, entrada.name), { recursive: true })
}

console.log('plantilla sincronizada')
```

- [ ] **Step 2: Correr la sincronización**

Run: `cd "/Users/joffrellerena/Desktop/[Bot Clase]/crear-bot-whatsapp" && npm run sincronizar`
Expected: imprime `plantilla sincronizada` y aparece `plantilla/src`, `plantilla/package.json`, `plantilla/supabase/migrations/0001_init.sql`.

- [ ] **Step 3: Escribir el test que falla**

`tests/plantilla.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { RAIZ_PLANTILLA } from '../src/plantilla.js'

describe('la plantilla incluida en el paquete', () => {
  it('trae el proyecto del panel', async () => {
    const nombres = await readdir(RAIZ_PLANTILLA)
    expect(nombres).toContain('package.json')
    expect(nombres).toContain('src')
    expect(nombres).toContain('supabase')
  })

  it('trae la migración que crea las tablas', async () => {
    const sql = await readFile(
      join(RAIZ_PLANTILLA, 'supabase/migrations/0001_init.sql'), 'utf8',
    )
    expect(sql).toContain('create table if not exists config')
    expect(sql).toContain('create table if not exists messages')
  })

  it('no lleva credenciales ni dependencias instaladas', async () => {
    const nombres = await readdir(RAIZ_PLANTILLA)
    expect(nombres.some((n) => n.startsWith('.env') && n !== '.env.example')).toBe(false)
    expect(nombres).not.toContain('node_modules')
    expect(nombres).not.toContain('.vercel')
  })

  it('el .gitignore de la plantilla protege el .env.local', async () => {
    const ignore = await readFile(join(RAIZ_PLANTILLA, '.gitignore'), 'utf8')
    expect(ignore).toContain('.env')
  })

  it('no se cuela a sí mismo dentro de la plantilla', async () => {
    await expect(stat(join(RAIZ_PLANTILLA, 'crear-bot-whatsapp'))).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `npm test -- tests/plantilla.test.ts`
Expected: FAIL — no existe `src/plantilla.ts`.

- [ ] **Step 5: Implementar el envoltorio de comandos**

`src/ejecutar.ts`:

```ts
import { spawn } from 'node:child_process'

/**
 * Ejecuta un comando. Con heredar=true el alumno ve la salida en vivo,
 * que es lo que hace falta cuando Vercel abre el navegador para el login.
 */
export function ejecutar(
  comando: string,
  args: string[],
  opciones: { cwd?: string; heredar?: boolean } = {},
): Promise<{ salida: string }> {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(comando, args, {
      cwd: opciones.cwd,
      stdio: opciones.heredar ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })

    let salida = ''
    hijo.stdout?.on('data', (d) => { salida += String(d) })
    hijo.stderr?.on('data', (d) => { salida += String(d) })

    hijo.on('error', (err) => rechazar(new Error(`No se pudo ejecutar ${comando}: ${err.message}`)))
    hijo.on('close', (codigo) => {
      if (codigo === 0) return resolver({ salida })
      rechazar(new Error(`${comando} terminó con error (código ${codigo}).\n${salida.slice(-800)}`))
    })
  })
}
```

- [ ] **Step 6: Implementar la copia de la plantilla**

`src/plantilla.ts`:

```ts
import { cp, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ejecutar } from './ejecutar.js'

export const RAIZ_PLANTILLA = join(dirname(fileURLToPath(import.meta.url)), '..', 'plantilla')

export async function copiarPlantilla(destino: string): Promise<void> {
  await cp(RAIZ_PLANTILLA, destino, { recursive: true })
}

export async function escribirEnv(
  destino: string,
  variables: Record<string, string>,
): Promise<void> {
  const contenido = Object.entries(variables).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  await writeFile(join(destino, '.env.local'), contenido, 'utf8')
}

export async function instalarDependencias(destino: string): Promise<void> {
  await ejecutar('npm', ['install'], { cwd: destino, heredar: true })
}
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npm test -- tests/plantilla.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```bash
git add crear-bot-whatsapp/scripts crear-bot-whatsapp/src/plantilla.ts crear-bot-whatsapp/src/ejecutar.ts crear-bot-whatsapp/tests/plantilla.test.ts crear-bot-whatsapp/plantilla
git commit -m "feat: plantilla del panel dentro del paquete"
```

---

### Task 7: Cliente de Vercel

**Files:**
- Create: `crear-bot-whatsapp/src/api/vercel.ts`
- Test: `tests/vercel.test.ts`

**Interfaces:**
- Consumes: `ejecutar` de `../ejecutar.js`.
- Produces:
  - `hayVercel(): Promise<boolean>`
  - `estaLogueado(): Promise<boolean>`
  - `iniciarSesion(): Promise<void>`
  - `enlazarProyecto(carpeta: string, nombre: string): Promise<void>`
  - `cargarVariables(carpeta: string, variables: Record<string, string>): Promise<void>`
  - `desplegar(carpeta: string): Promise<{ url: string }>`

- [ ] **Step 1: Escribir el test que falla**

`tests/vercel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/ejecutar.js', () => ({ ejecutar: vi.fn() }))

import { ejecutar } from '../src/ejecutar.js'
import { estaLogueado, cargarVariables, desplegar } from '../src/api/vercel.js'

beforeEach(() => vi.mocked(ejecutar).mockReset())

describe('estaLogueado', () => {
  it('es verdadero si whoami responde un usuario', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: 'joffre\n' })
    expect(await estaLogueado()).toBe(true)
  })

  it('es falso si whoami falla', async () => {
    vi.mocked(ejecutar).mockRejectedValue(new Error('not authenticated'))
    expect(await estaLogueado()).toBe(false)
  })
})

describe('cargarVariables', () => {
  it('añade cada variable a producción', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: '' })
    await cargarVariables('/tmp/x', { UNA: '1', OTRA: '2' })
    expect(vi.mocked(ejecutar)).toHaveBeenCalledTimes(2)
    const args = vi.mocked(ejecutar).mock.calls[0][1]
    expect(args).toContain('env')
    expect(args).toContain('add')
    expect(args).toContain('production')
  })
})

describe('desplegar', () => {
  it('saca la URL de producción de la salida', async () => {
    vi.mocked(ejecutar).mockResolvedValue({
      salida: 'Building...\nhttps://mi-bot-abc123.vercel.app\nDeployed',
    })
    expect(await desplegar('/tmp/x')).toEqual({ url: 'https://mi-bot-abc123.vercel.app' })
  })

  it('lanza un error claro si no aparece ninguna URL', async () => {
    vi.mocked(ejecutar).mockResolvedValue({ salida: 'algo salió mal' })
    await expect(desplegar('/tmp/x')).rejects.toThrow(/no devolvió ninguna URL/i)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/vercel.test.ts`
Expected: FAIL — no existe `src/api/vercel.ts`.

- [ ] **Step 3: Implementar**

`src/api/vercel.ts`:

```ts
import { ejecutar } from '../ejecutar.js'

const VERCEL = ['--yes', 'vercel@latest']

async function vercel(args: string[], opciones: { cwd?: string; heredar?: boolean } = {}) {
  return ejecutar('npx', [...VERCEL, ...args], opciones)
}

export async function hayVercel(): Promise<boolean> {
  try {
    await vercel(['--version'])
    return true
  } catch {
    return false
  }
}

export async function estaLogueado(): Promise<boolean> {
  try {
    const { salida } = await vercel(['whoami'])
    return salida.trim() !== ''
  } catch {
    return false
  }
}

export async function iniciarSesion(): Promise<void> {
  await vercel(['login'], { heredar: true })
}

export async function enlazarProyecto(carpeta: string, nombre: string): Promise<void> {
  await vercel(['link', '--yes', '--project', nombre], { cwd: carpeta })
}

export async function cargarVariables(
  carpeta: string,
  variables: Record<string, string>,
): Promise<void> {
  for (const [clave, valor] of Object.entries(variables)) {
    await ejecutar('sh', ['-c', `printf %s ${JSON.stringify(valor)} | npx --yes vercel@latest env add ${clave} production`], { cwd: carpeta })
  }
}

export async function desplegar(carpeta: string): Promise<{ url: string }> {
  const { salida } = await vercel(['deploy', '--prod', '--yes'], { cwd: carpeta })
  const urls = salida.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) ?? []
  if (urls.length === 0) {
    throw new Error('Vercel no devolvió ninguna URL. Revisa la salida del despliegue.')
  }
  return { url: urls[urls.length - 1] }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/vercel.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add crear-bot-whatsapp/src/api/vercel.ts crear-bot-whatsapp/tests/vercel.test.ts
git commit -m "feat: cliente de Vercel"
```

---

### Task 8: Orquestador de pasos

**Files:**
- Create: `crear-bot-whatsapp/src/pasos.ts`
- Test: `tests/pasos.test.ts`

**Interfaces:**
- Consumes: todos los clientes anteriores, `estado.ts`, `plantilla.ts`.
- Produces:
  - `type Datos = { carpeta: string; nombreProyecto: string; supabaseUrl: string; publishableKey: string; secretKey: string; pat: string; openaiKey: string; appId: string; appSecret: string; metaToken: string; wabaId: string; numeroId: string; pin: string | null; verifyToken: string }`
  - `type Aviso = (texto: string) => void`
  - `ejecutarPasos(datos: Datos, avisar: Aviso): Promise<{ urlPanel: string; enlaceWa: string }>`

- [ ] **Step 1: Escribir el test que falla**

`tests/pasos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/plantilla.js', () => ({
  RAIZ_PLANTILLA: '/plantilla',
  copiarPlantilla: vi.fn(), escribirEnv: vi.fn(), instalarDependencias: vi.fn(),
}))
vi.mock('../src/api/supabase.js', () => ({
  ejecutarSql: vi.fn(), guardarConfig: vi.fn(), comprobarSecretKey: vi.fn(),
}))
vi.mock('../src/api/meta.js', () => ({
  estadoNumero: vi.fn(), registrarNumero: vi.fn(),
  conectarAppAlWaba: vi.fn(), configurarWebhook: vi.fn(),
}))
vi.mock('../src/api/vercel.js', () => ({
  estaLogueado: vi.fn(async () => true), iniciarSesion: vi.fn(),
  enlazarProyecto: vi.fn(), cargarVariables: vi.fn(), desplegar: vi.fn(),
}))
vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>()),
  readFile: vi.fn(async () => 'create table if not exists config ();'),
}))

import { copiarPlantilla, instalarDependencias } from '../src/plantilla.js'
import { ejecutarSql, guardarConfig } from '../src/api/supabase.js'
import { estadoNumero, registrarNumero, conectarAppAlWaba, configurarWebhook } from '../src/api/meta.js'
import { desplegar, cargarVariables } from '../src/api/vercel.js'
import { ejecutarPasos } from '../src/pasos.js'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const datos = {
  carpeta: '', nombreProyecto: 'mi-bot',
  supabaseUrl: 'https://abcdef.supabase.co',
  publishableKey: 'sb_publishable_x', secretKey: 'sb_secret_x', pat: 'sbp_x',
  openaiKey: 'sk-x', appId: '225', appSecret: 'sec', metaToken: 'EAAG',
  wabaId: '132', numeroId: '117', pin: '452817', verifyToken: 'tok-abc',
}

beforeEach(async () => {
  vi.clearAllMocks()
  datos.carpeta = await mkdtemp(join(tmpdir(), 'pasos-'))
  vi.mocked(estadoNumero).mockResolvedValue({
    id: '117', numero: '+593', nombre: 'J', estado: 'CONNECTED', plataforma: 'CLOUD_API',
  })
  vi.mocked(desplegar).mockResolvedValue({ url: 'https://mi-bot.vercel.app' })
  // La comprobación final llama al webhook desplegado y espera el challenge de vuelta.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => 'prueba' })))
})

describe('ejecutarPasos', () => {
  it('devuelve la URL del panel y el enlace de WhatsApp', async () => {
    vi.mocked(estadoNumero).mockResolvedValue({
      id: '117', numero: '+593 96 884 4837', nombre: 'J', estado: 'CONNECTED', plataforma: 'CLOUD_API',
    })
    const r = await ejecutarPasos(datos, () => {})
    expect(r.urlPanel).toBe('https://mi-bot.vercel.app')
    expect(r.enlaceWa).toBe('https://wa.me/593968844837')
  })

  it('respeta el orden: guarda el verify token antes de pedir el webhook', async () => {
    const orden: string[] = []
    vi.mocked(guardarConfig).mockImplementation(async () => { orden.push('config') })
    vi.mocked(configurarWebhook).mockImplementation(async () => { orden.push('webhook') })
    vi.mocked(desplegar).mockImplementation(async () => { orden.push('deploy'); return { url: 'https://x.vercel.app' } })

    await ejecutarPasos(datos, () => {})
    expect(orden).toEqual(['deploy', 'config', 'webhook'])
  })

  it('crea las tablas antes de desplegar', async () => {
    const orden: string[] = []
    vi.mocked(ejecutarSql).mockImplementation(async () => { orden.push('sql') })
    vi.mocked(desplegar).mockImplementation(async () => { orden.push('deploy'); return { url: 'https://x.vercel.app' } })
    await ejecutarPasos(datos, () => {})
    expect(orden).toEqual(['sql', 'deploy'])
  })

  it('registra el número solo si está en PENDING', async () => {
    await ejecutarPasos(datos, () => {})
    expect(registrarNumero).not.toHaveBeenCalled()

    vi.clearAllMocks()
    vi.mocked(estadoNumero).mockResolvedValue({
      id: '117', numero: '+593', nombre: 'J', estado: 'PENDING', plataforma: 'NOT_APPLICABLE',
    })
    vi.mocked(desplegar).mockResolvedValue({ url: 'https://x.vercel.app' })
    await ejecutarPasos(datos, () => {})
    expect(registrarNumero).toHaveBeenCalledWith('EAAG', '117', '452817')
  })

  it('conecta la app al WABA', async () => {
    await ejecutarPasos(datos, () => {})
    expect(conectarAppAlWaba).toHaveBeenCalledWith('EAAG', '132')
  })

  it('al repetirse salta lo ya hecho', async () => {
    await ejecutarPasos(datos, () => {})
    vi.clearAllMocks()
    vi.mocked(estadoNumero).mockResolvedValue({
      id: '117', numero: '+593', nombre: 'J', estado: 'CONNECTED', plataforma: 'CLOUD_API',
    })
    vi.mocked(desplegar).mockResolvedValue({ url: 'https://mi-bot.vercel.app' })

    await ejecutarPasos(datos, () => {})
    expect(copiarPlantilla).not.toHaveBeenCalled()
    expect(instalarDependencias).not.toHaveBeenCalled()
    expect(ejecutarSql).not.toHaveBeenCalled()
  })

  it('falla si el webhook desplegado no devuelve el challenge', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'error' })))
    await expect(ejecutarPasos(datos, () => {})).rejects.toThrow(/variables de entorno/i)
  })

  it('avisa de cada paso al alumno', async () => {
    const avisos: string[] = []
    await ejecutarPasos(datos, (t) => avisos.push(t))
    expect(avisos.length).toBeGreaterThan(4)
    expect(avisos.join(' ')).toMatch(/tablas/i)
  })

  it('carga las variables de entorno antes de desplegar', async () => {
    const orden: string[] = []
    vi.mocked(cargarVariables).mockImplementation(async () => { orden.push('vars') })
    vi.mocked(desplegar).mockImplementation(async () => { orden.push('deploy'); return { url: 'https://x.vercel.app' } })
    await ejecutarPasos(datos, () => {})
    expect(orden).toEqual(['vars', 'deploy'])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/pasos.test.ts`
Expected: FAIL — no existe `src/pasos.ts`.

- [ ] **Step 3: Implementar**

`src/pasos.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RAIZ_PLANTILLA, copiarPlantilla, escribirEnv, instalarDependencias } from './plantilla.js'
import { ejecutarSql, guardarConfig } from './api/supabase.js'
import { estadoNumero, registrarNumero, conectarAppAlWaba, configurarWebhook } from './api/meta.js'
import { estaLogueado, iniciarSesion, enlazarProyecto, cargarVariables, desplegar } from './api/vercel.js'
import { leerEstado, guardarEstado, marcarHecho, estaHecho, type Estado, type Paso } from './estado.js'
import { refDeSupabase } from './validar.js'

export type Datos = {
  carpeta: string
  nombreProyecto: string
  supabaseUrl: string
  publishableKey: string
  secretKey: string
  pat: string
  openaiKey: string
  appId: string
  appSecret: string
  metaToken: string
  wabaId: string
  numeroId: string
  pin: string | null
  verifyToken: string
}

export type Aviso = (texto: string) => void

function variablesDeEntorno(datos: Datos): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: datos.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: datos.publishableKey,
    SUPABASE_SECRET_KEY: datos.secretKey,
    OPENAI_API_KEY: datos.openaiKey,
  }
}

/**
 * El orden de estos pasos no es negociable: Meta llama a la URL del webhook
 * en el mismo instante en que se la configuramos, así que para entonces el
 * proyecto tiene que estar desplegado, con variables, y con el token de
 * verificación ya guardado en la base de datos.
 */
export async function ejecutarPasos(
  datos: Datos,
  avisar: Aviso,
): Promise<{ urlPanel: string; enlaceWa: string }> {
  let estado: Estado = await leerEstado(datos.carpeta)

  const hacer = async (paso: Paso, texto: string, accion: () => Promise<Record<string, string> | void>) => {
    if (estaHecho(estado, paso)) {
      avisar(`${texto} — ya estaba hecho, sigo`)
      return
    }
    avisar(texto)
    const datosNuevos = (await accion()) ?? {}
    estado = marcarHecho(estado, paso, datosNuevos)
    await guardarEstado(datos.carpeta, estado)
  }

  await hacer('plantilla', 'Copiando el proyecto e instalando dependencias', async () => {
    await copiarPlantilla(datos.carpeta)
    await escribirEnv(datos.carpeta, variablesDeEntorno(datos))
    await instalarDependencias(datos.carpeta)
  })

  await hacer('tablas', 'Creando las tablas en Supabase', async () => {
    const sql = await readFile(join(RAIZ_PLANTILLA, 'supabase/migrations/0001_init.sql'), 'utf8')
    await ejecutarSql(datos.pat, refDeSupabase(datos.supabaseUrl), sql)
  })

  const numero = await estadoNumero(datos.metaToken, datos.numeroId)

  await hacer('numero', 'Revisando el número en la Cloud API', async () => {
    if (numero.estado === 'PENDING' && datos.pin) {
      await registrarNumero(datos.metaToken, datos.numeroId, datos.pin)
    }
    return { numero: numero.numero }
  })

  await hacer('vercel', 'Desplegando en Vercel', async () => {
    // El login abre el navegador; sin él, `vercel link` falla con un error que no dice nada.
    if (!(await estaLogueado())) {
      avisar('Necesito que inicies sesión en Vercel: se abre tu navegador')
      await iniciarSesion()
    }
    await enlazarProyecto(datos.carpeta, datos.nombreProyecto)
    await cargarVariables(datos.carpeta, variablesDeEntorno(datos))
    const { url } = await desplegar(datos.carpeta)
    return { urlPanel: url }
  })

  const urlPanel = estado.datos.urlPanel
  if (!urlPanel) throw new Error('El despliegue no dejó ninguna URL guardada.')

  await hacer('config', 'Guardando la configuración de Meta en tu base de datos', async () => {
    await guardarConfig(datos.supabaseUrl, datos.secretKey, {
      verify_token: datos.verifyToken,
      phone_number_id: datos.numeroId,
      waba_id: datos.wabaId,
      meta_token: datos.metaToken,
      meta_app_secret: datos.appSecret,
    })
  })

  await hacer('webhook', 'Configurando el webhook en Meta', async () => {
    await configurarWebhook({
      appId: datos.appId,
      appSecret: datos.appSecret,
      url: `${urlPanel}/api/whatsapp/webhook`,
      verifyToken: datos.verifyToken,
    })
  })

  await hacer('waba', 'Conectando tu app a la cuenta de WhatsApp', async () => {
    await conectarAppAlWaba(datos.metaToken, datos.wabaId)
  })

  await hacer('comprobacion', 'Comprobando que el webhook responde', async () => {
    // La misma llamada que hace Meta para verificar. Si esto falla, el problema
    // está en el despliegue y no en Meta.
    const url = `${urlPanel}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(datos.verifyToken)}&hub.challenge=prueba`
    const res = await fetch(url)
    const cuerpo = await res.text()
    if (!res.ok || cuerpo.trim() !== 'prueba') {
      throw new Error(
        `Tu webhook desplegado no respondió como debía (HTTP ${res.status}). ` +
          'Suele ser que el despliegue quedó sin variables de entorno.',
      )
    }
  })

  const soloDigitos = (estado.datos.numero ?? numero.numero).replace(/\D/g, '')

  return { urlPanel, enlaceWa: `https://wa.me/${soloDigitos}` }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/pasos.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add crear-bot-whatsapp/src/pasos.ts crear-bot-whatsapp/tests/pasos.test.ts
git commit -m "feat: orquestador de pasos con reanudación"
```

---

### Task 9: El diálogo con el alumno

**Files:**
- Create: `crear-bot-whatsapp/src/preguntas.ts`
- Modify: `crear-bot-whatsapp/src/index.ts`, `crear-bot-whatsapp/src/mensajes.ts`
- Test: `tests/preguntas.test.ts`

**Interfaces:**
- Consumes: `validar.ts`, `api/openai.ts`, `api/supabase.ts`, `api/meta.ts`, `pasos.ts`.
- Produces:
  - `elegirNumero(numeros: Numero[], preguntar: (opciones: { valor: string; etiqueta: string }[]) => Promise<string>): Promise<Numero>`
  - `generarVerifyToken(): string`
  - `preguntarTodo(): Promise<Datos>`

- [ ] **Step 1: Escribir el test que falla**

`tests/preguntas.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { elegirNumero, generarVerifyToken } from '../src/preguntas.js'
import type { Numero } from '../src/api/meta.js'

const uno: Numero = { id: '1', numero: '+593 1', nombre: 'A', estado: 'CONNECTED', plataforma: 'CLOUD_API' }
const dos: Numero = { id: '2', numero: '+593 2', nombre: 'B', estado: 'PENDING', plataforma: 'NOT_APPLICABLE' }

describe('elegirNumero', () => {
  it('con un solo número no pregunta nada', async () => {
    const preguntar = vi.fn()
    expect(await elegirNumero([uno], preguntar)).toEqual(uno)
    expect(preguntar).not.toHaveBeenCalled()
  })

  it('con varios pregunta y devuelve el elegido', async () => {
    const preguntar = vi.fn(async () => '2')
    expect(await elegirNumero([uno, dos], preguntar)).toEqual(dos)
    const opciones = preguntar.mock.calls[0][0]
    expect(opciones).toHaveLength(2)
    expect(opciones[1].etiqueta).toContain('+593 2')
  })

  it('lanza si el WABA no tiene números', async () => {
    await expect(elegirNumero([], vi.fn())).rejects.toThrow(/ningún número/i)
  })
})

describe('generarVerifyToken', () => {
  it('genera tokens largos y distintos cada vez', () => {
    const a = generarVerifyToken()
    const b = generarVerifyToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(16)
    expect(a).toMatch(/^[a-z0-9-]+$/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- tests/preguntas.test.ts`
Expected: FAIL — no existe `src/preguntas.ts`.

- [ ] **Step 3: Implementar la parte pura**

`src/preguntas.ts` (primera mitad):

```ts
import { randomBytes } from 'node:crypto'
import * as p from '@clack/prompts'
import { resolve } from 'node:path'
import type { Numero } from './api/meta.js'
import { revisarToken, buscarWabas, listarNumeros } from './api/meta.js'
import { comprobarKeyOpenai } from './api/openai.js'
import { comprobarSecretKey } from './api/supabase.js'
import { MENSAJES } from './mensajes.js'
import {
  validarUrlSupabase, validarSecretKey, validarPublishableKey,
  validarPat, validarPin, validarNombreCarpeta, type Resultado,
} from './validar.js'
import type { Datos } from './pasos.js'

export function generarVerifyToken(): string {
  return `bot-${randomBytes(10).toString('hex')}`
}

export async function elegirNumero(
  numeros: Numero[],
  preguntar: (opciones: { valor: string; etiqueta: string }[]) => Promise<string>,
): Promise<Numero> {
  if (numeros.length === 0) {
    throw new Error('Tu cuenta de WhatsApp no tiene ningún número. Añade uno en Meta y vuelve.')
  }
  if (numeros.length === 1) return numeros[0]

  const elegido = await preguntar(
    numeros.map((n) => ({
      valor: n.id,
      etiqueta: `${n.numero} — ${n.nombre} (${n.estado})`,
    })),
  )
  const numero = numeros.find((n) => n.id === elegido)
  if (!numero) throw new Error('No se eligió ningún número.')
  return numero
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- tests/preguntas.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir el diálogo completo**

Añadir a `src/preguntas.ts`:

```ts
function cancelado(valor: unknown): never | void {
  if (p.isCancel(valor)) {
    p.cancel('Lo dejamos aquí. Cuando quieras, vuelve a ejecutar el comando y sigo donde iba.')
    process.exit(0)
  }
}

async function pedirTexto(
  mensaje: string,
  validar?: (v: string) => Resultado,
): Promise<string> {
  const valor = await p.text({
    message: mensaje,
    validate: validar
      ? (v) => {
          const r = validar(v ?? '')
          return r.ok ? undefined : r.motivo
        }
      : undefined,
  })
  cancelado(valor)
  return String(valor).trim()
}

/** Pide una credencial y no sigue hasta que la API la acepta. */
async function pedirCredencial(
  mensaje: string,
  validarFormato: (v: string) => Resultado,
  comprobar: (v: string) => Promise<{ ok: boolean; motivo?: string }>,
): Promise<string> {
  for (;;) {
    const valor = await pedirTexto(mensaje, validarFormato)
    const spinner = p.spinner()
    spinner.start('Comprobando')
    const resultado = await comprobar(valor)
    spinner.stop(resultado.ok ? 'Correcto' : 'No sirve')
    if (resultado.ok) return valor
    p.log.error(resultado.motivo ?? 'No se pudo validar.')
  }
}

export async function preguntarTodo(): Promise<Datos> {
  p.intro(MENSAJES.bienvenida)
  p.note(MENSAJES.antesDeEmpezar, 'Ten a mano')

  const nombreProyecto = await pedirTexto('Nombre de la carpeta del proyecto', validarNombreCarpeta)
  const carpeta = resolve(process.cwd(), nombreProyecto)

  const supabaseUrl = await pedirTexto('URL de tu proyecto de Supabase', validarUrlSupabase)
  const publishableKey = await pedirTexto('Clave publicable de Supabase (sb_publishable_…)', validarPublishableKey)
  const secretKey = await pedirCredencial(
    'Clave secreta de Supabase (sb_secret_…)',
    validarSecretKey,
    (v) => comprobarSecretKey(supabaseUrl, v),
  )
  const pat = await pedirTexto('Clave de acceso personal de Supabase (sbp_…)', validarPat)

  const openaiKey = await pedirCredencial(
    'API key de OpenAI',
    () => ({ ok: true }),
    comprobarKeyOpenai,
  )

  const appId = await pedirTexto('Identificador de tu app de Meta')
  const appSecret = await pedirTexto('Clave secreta de tu app de Meta')
  const metaToken = await pedirCredencial(
    'Token permanente de Meta',
    () => ({ ok: true }),
    async (v) => {
      const r = await revisarToken(v)
      if (!r.valido) return { ok: false, motivo: r.motivo }
      if (!r.tieneActivos) return { ok: false, motivo: r.motivo }
      return { ok: true }
    },
  )

  const spinner = p.spinner()
  spinner.start('Buscando tu cuenta de WhatsApp')
  const wabas = await buscarWabas(metaToken)
  if (wabas.length === 0) {
    spinner.stop('No encontré ninguna')
    throw new Error(MENSAJES.tokenSinActivos)
  }
  const wabaId = wabas[0]
  const numeros = await listarNumeros(metaToken, wabaId)
  spinner.stop(`Encontré ${numeros.length} número(s)`)

  const numero = await elegirNumero(numeros, async (opciones) => {
    const elegido = await p.select({
      message: '¿Qué número va a usar el bot?',
      options: opciones.map((o) => ({ value: o.valor, label: o.etiqueta })),
    })
    cancelado(elegido)
    return String(elegido)
  })

  let pin: string | null = null
  if (numero.estado === 'PENDING') {
    p.log.warn(MENSAJES.avisoNumero)
    const seguir = await p.confirm({ message: `¿Registro el número ${numero.numero}?` })
    cancelado(seguir)
    if (!seguir) throw new Error('Sin registrar el número, el bot no puede recibir mensajes.')
    pin = await pedirTexto('Elige un PIN de 6 dígitos (anótalo, te lo pedirán en el futuro)', validarPin)
  }

  return {
    carpeta, nombreProyecto, supabaseUrl, publishableKey, secretKey, pat,
    openaiKey, appId, appSecret, metaToken,
    wabaId, numeroId: numero.id, pin, verifyToken: generarVerifyToken(),
  }
}
```

- [ ] **Step 6: Conectar todo en index.ts**

`src/index.ts`:

```ts
import * as p from '@clack/prompts'
import { MENSAJES, NODE_MINIMO } from './mensajes.js'
import { preguntarTodo } from './preguntas.js'
import { ejecutarPasos } from './pasos.js'

const mayor = Number(process.versions.node.split('.')[0])
if (mayor < NODE_MINIMO) {
  console.error(MENSAJES.nodeViejo(process.versions.node))
  process.exit(1)
}

try {
  const datos = await preguntarTodo()
  const resultado = await ejecutarPasos(datos, (texto) => p.log.step(texto))

  p.note(
    [
      `Panel:    ${resultado.urlPanel}`,
      `WhatsApp: ${resultado.enlaceWa}`,
      datos.pin ? `PIN del número: ${datos.pin}` : '',
    ].filter(Boolean).join('\n'),
    MENSAJES.listo,
  )
  p.outro(MENSAJES.pendiente)
} catch (err) {
  p.log.error(err instanceof Error ? err.message : String(err))
  p.outro('Se detuvo aquí. Corrige lo de arriba y vuelve a ejecutar el comando: retomo donde iba.')
  process.exit(1)
}
```

- [ ] **Step 7: Correr toda la suite y compilar**

Run: `npm test && npm run build`
Expected: PASS y compilación sin errores.

- [ ] **Step 8: Commit**

```bash
git add crear-bot-whatsapp/src crear-bot-whatsapp/tests
git commit -m "feat: diálogo con el alumno y arranque del instalador"
```

---

### Task 10: Prueba real de punta a punta

**Files:**
- Create: `crear-bot-whatsapp/README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la confirmación de que el comando funciona contra cuentas reales.

- [ ] **Step 1: Preparar un proyecto de Supabase limpio**

Crear un proyecto nuevo en supabase.com (para no ensuciar el de producción) y anotar su URL, clave publicable, clave secreta y una clave de acceso personal.

- [ ] **Step 2: Ejecutar el comando desde el paquete local**

```bash
cd /tmp && npm link "/Users/joffrellerena/Desktop/[Bot Clase]/crear-bot-whatsapp" && npx crear-bot-whatsapp
```

Expected: pide los datos uno por uno, rechaza a propósito una clave secreta mal pegada, y llega hasta el despliegue.

- [ ] **Step 3: Comprobar el resultado**

- Las tablas existen en el proyecto nuevo de Supabase.
- El panel responde en la URL que imprimió.
- En Meta, el webhook aparece configurado y con `messages` suscrito.
- Escribir al número desde un celular produce un mensaje en el inbox.

- [ ] **Step 4: Probar la reanudación**

Volver a ejecutar el comando sobre la misma carpeta.
Expected: dice "ya estaba hecho, sigo" en los pasos completados y no repite el despliegue.

- [ ] **Step 5: Escribir el README**

`README.md`:

```markdown
# crear-bot-whatsapp

Crea tu panel de bot de WhatsApp con un comando: base de datos, despliegue y webhook incluidos.

```
npx crear-bot-whatsapp
```

## Qué necesitas antes

1. **Node.js 20 o superior** — nodejs.org
2. **Un proyecto en Supabase** — supabase.com. De ahí salen la URL, la clave publicable,
   la clave secreta (Settings → API Keys) y la clave de acceso personal (Account → Access Tokens).
3. **Una API key de OpenAI con saldo** — platform.openai.com
4. **Una cuenta de Vercel** — vercel.com
5. **Una app de Meta con WhatsApp y un número dedicado** — developers.facebook.com.
   El token permanente se genera desde Business Suite → Usuarios del sistema, y ese usuario
   debe tener **asignada tu cuenta de WhatsApp** antes de generar el token.

## Importante

El número que uses **dejará de funcionar en la app normal de WhatsApp**. Usa una línea dedicada,
no tu número personal.

## Si algo falla

Vuelve a ejecutar el comando en la misma carpeta: retoma donde se quedó.
```

- [ ] **Step 6: Commit**

```bash
git add crear-bot-whatsapp/README.md
git commit -m "docs: instrucciones del instalador"
```

---

### Task 11: Página web con el botón de copiar

**Files:**
- Create: `crear-bot-whatsapp/web/index.html`

**Interfaces:**
- Consumes: el nombre del paquete publicado.
- Produces: una página estática desplegable en Vercel con el comando y un botón que lo copia.

- [ ] **Step 1: Escribir la página**

`web/index.html`:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crea tu bot de WhatsApp</title>
<style>
  :root { --tinta: #14181f; --papel: #f6f6f3; --linea: #e4e4df; --marino: #1f2b4d; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem;
    background: var(--papel); color: var(--tinta);
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  main { max-width: 34rem; text-align: center; }
  h1 { font-size: clamp(1.75rem, 5vw, 2.5rem); letter-spacing: -0.02em; margin: 0 0 0.75rem; }
  p { color: #6b7280; line-height: 1.6; margin: 0 0 2rem; }
  .comando {
    display: flex; align-items: center; gap: 1rem; text-align: left;
    border: 1px solid var(--linea); border-radius: 0.75rem;
    background: #fff; padding: 0.875rem 0.875rem 0.875rem 1.25rem;
  }
  code { flex: 1; font-family: ui-monospace, monospace; font-size: 1.05rem; overflow-x: auto; }
  button {
    flex-shrink: 0; border: 0; border-radius: 0.5rem; cursor: pointer;
    background: var(--marino); color: #fff; padding: 0.6rem 1.1rem;
    font: inherit; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase;
  }
  button:focus-visible { outline: 2px solid var(--marino); outline-offset: 2px; }
  .pasos { margin-top: 3rem; text-align: left; font-size: 0.9rem; color: #6b7280; }
  .pasos li { margin-bottom: 0.4rem; }
</style>
</head>
<body>
<main>
  <h1>Crea tu bot de WhatsApp</h1>
  <p>Un comando y tienes tu panel desplegado, con la base de datos creada y el webhook de Meta configurado.</p>

  <div class="comando">
    <code id="comando">npx crear-bot-whatsapp</code>
    <button id="copiar" type="button">Copiar</button>
  </div>

  <ol class="pasos">
    <li>Ten listo: un proyecto de Supabase, una key de OpenAI con saldo, una cuenta de Vercel y una app de Meta con un número dedicado.</li>
    <li>Pega el comando en tu terminal.</li>
    <li>Responde lo que te pregunte. El resto lo hace solo.</li>
  </ol>
</main>

<script>
  const boton = document.getElementById('copiar')
  const comando = document.getElementById('comando').textContent

  boton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(comando)
      boton.textContent = 'Copiado'
    } catch {
      boton.textContent = 'Copia a mano'
    }
    setTimeout(() => { boton.textContent = 'Copiar' }, 2000)
  })
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar a mano**

Run: `open crear-bot-whatsapp/web/index.html`
Expected: la página se ve centrada, el botón copia el comando y cambia a "Copiado" durante dos segundos.

- [ ] **Step 3: Commit**

```bash
git add crear-bot-whatsapp/web
git commit -m "feat: página con el comando y botón de copiar"
```

---

### Task 12: Publicación en npm

**Files:**
- Modify: `crear-bot-whatsapp/package.json`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el paquete publicado y el comando funcionando desde cualquier computadora.

- [ ] **Step 1: Confirmar que el nombre sigue libre**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/crear-bot-whatsapp`
Expected: `404` (libre). Si devuelve `200`, elegir otro nombre y cambiarlo en `package.json` y en `web/index.html`.

- [ ] **Step 2: Revisar qué se va a publicar**

Run: `cd crear-bot-whatsapp && npm pack --dry-run`
Expected: la lista incluye `bin/`, `dist/`, `plantilla/` y **ningún** archivo `.env`, `node_modules` ni `.vercel`.

- [ ] **Step 3: Iniciar sesión en npm**

Run: `npm login`
(Se abre el navegador. Hace falta una cuenta en npmjs.com.)

- [ ] **Step 4: Publicar**

Run: `npm publish --access public`
Expected: publica `crear-bot-whatsapp@0.1.0`. El script `prepublishOnly` sincroniza la plantilla, compila y corre los tests antes.

- [ ] **Step 5: Probar desde cero, como un alumno**

```bash
cd /tmp && rm -rf prueba-alumno && mkdir prueba-alumno && cd prueba-alumno
npx crear-bot-whatsapp@latest
```

Expected: descarga el paquete de npm y arranca el asistente.

- [ ] **Step 6: Commit**

```bash
git add crear-bot-whatsapp/package.json
git commit -m "chore: publicación 0.1.0 en npm"
```

---

## Notas para quien ejecute el plan

- **La plantilla se sincroniza, no se edita.** Cualquier cambio al panel se hace en `[Bot Clase]` y luego `npm run sincronizar`. Editar `plantilla/` a mano se pierde en la siguiente sincronización.
- **El orden de la Tarea 8 es el corazón del instalador.** Meta verifica la URL en el momento de configurarla; si el despliegue o el token de verificación llegan tarde, falla y el mensaje de error de Meta no ayuda nada.
- **Nunca se guarda una credencial en `.crear-bot.json`.** El test de `estado.ts` lo vigila, pero al añadir datos nuevos hay que respetarlo.
- **El panel generado no lleva login.** Antes de que un alumno lo use con clientes reales, hay que advertirle de que su URL es pública.
