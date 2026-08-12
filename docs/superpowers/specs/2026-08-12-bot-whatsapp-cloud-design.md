# Bot de WhatsApp con panel de control — Diseño

**Fecha:** 2026-08-12
**Estado:** aprobado, pendiente de plan de implementación

## Qué es

Una aplicación web que conecta un número de WhatsApp (API Cloud oficial de Meta) con un bot que responde usando IA, más un panel para configurarlo, leer las conversaciones y ver los leads que llegan.

Un solo número, un solo usuario (el dueño). No es multi-cliente ni multi-número.

## Objetivo

Que quien escriba al WhatsApp de la empresa reciba una respuesta útil sin intervención humana, y que el dueño pueda leer todo, intervenir cuando quiera y saber cuántos leads entraron.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| API de WhatsApp | Cloud API oficial de Meta | Es la que va a conectar el usuario |
| Cerebro del bot | IA con prompt (OpenAI) | Conversación natural, no menús numéricos; el usuario ya tiene su API key |
| Alcance | Un solo número | Simplicidad; sin usuarios ni permisos |
| Arquitectura | Monolito Next.js en Vercel | Un despliegue, un repo, MVP funcional en días |
| Base de datos | Supabase (proyecto que indicará el usuario) | Persistencia + Realtime + Auth en una pieza |

Descartado: worker con cola (innecesario para un número), Airtable como base (límite de ~5 req/s, lento para inbox en vivo), maqueta sin backend (se pidió MVP funcional).

## Arquitectura

Una sola app Next.js desplegada en Vercel. Contiene el panel y el endpoint del webhook.

### Flujo de un mensaje entrante

1. Meta llama a `POST /api/whatsapp/webhook`.
2. Se valida la cabecera `X-Hub-Signature-256` contra el App Secret. Firma inválida → `401` y no se procesa nada.
3. Se hace *upsert* del contacto y se inserta el mensaje. El `id` de mensaje de Meta tiene índice único: Meta reintenta las entregas y sin esa restricción el bot respondería varias veces al mismo mensaje.
4. Se devuelve `200` inmediatamente; el resto se procesa en segundo plano (`after()` de Next.js). Meta reintenta si la respuesta tarda más de ~10 s.
5. Si el bot global está activo, el chat no está pausado, no hay palabra clave de escalamiento y estamos en horario: se arma el prompt (rol + instrucciones del usuario + últimos 15 mensajes del hilo) y se llama a la API de OpenAI.
6. La respuesta se guarda como mensaje saliente y se envía a `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` con el token permanente.
7. Los eventos `statuses` que envía Meta (sent / delivered / read / failed) actualizan el estado del mensaje correspondiente.

`GET /api/whatsapp/webhook` implementa la verificación de Meta: compara `hub.verify_token` con el guardado y devuelve `hub.challenge`.

### Ventana de 24 horas

Meta solo permite mensajes de formato libre dentro de las 24 h posteriores al último mensaje del usuario. El bot siempre responde a alguien que acaba de escribir, así que no afecta al MVP. Reactivar conversaciones frías requeriría plantillas aprobadas y queda fuera de alcance.

### Tiempo real

El inbox se suscribe a los cambios de `messages` y `contacts` vía Supabase Realtime. Sin polling.

## Modelo de datos (Supabase / Postgres)

**`config`** — una sola fila (`id` fijo).
- `phone_number_id`, `waba_id`, `meta_token`, `meta_app_secret`, `verify_token`
- `bot_enabled` (booleano global)
- `bot_role` (`soporte` | `ventas` | `agendamiento` | `personalizado`)
- `system_prompt` (texto editable)
- `welcome_message`
- `business_hours` (JSON: días y franjas) y `out_of_hours_message`
- `escalation_keywords` (lista de textos)
- `openai_model` (modelo a usar; editable desde la pantalla de Bot)
- `updated_at`

La API key de OpenAI vive en variable de entorno (`OPENAI_API_KEY`), no en la base: es una credencial del despliegue, no algo que se cambie desde el panel.

**`contacts`**
- `id`, `wa_id` (único), `profile_name`
- `status` (`nuevo` | `en_conversacion` | `calificado` | `atendido_humano`)
- `bot_paused` (booleano por chat)
- `needs_attention` (booleano; lo activa un fallo de IA o un escalamiento)
- `last_message_at`, `created_at`

**`messages`**
- `id`, `contact_id`
- `wa_message_id` (único; clave del anti-duplicados)
- `direction` (`inbound` | `outbound`)
- `sender` (`contacto` | `bot` | `humano`)
- `type` (`text` | `image` | `audio` | `other`)
- `body` (texto; para no-texto, descripción o URL del medio)
- `status` (`pending` | `sent` | `delivered` | `read` | `failed`)
- `error` (texto, nullable)
- `created_at`

**`webhook_events`** — registro breve de entregas y errores del webhook, para diagnosticar desde la pantalla de Conexión: `id`, `received_at`, `ok`, `detail`.

Las métricas se calculan consultando `messages` y `contacts`. No hay tablas de estadísticas.

### Seguridad de datos

- El token de Meta y el App Secret se guardan en `config` y se leen **solo desde el servidor** con la service-role key.
- RLS activo y cerrado en todas las tablas; el cliente nunca lee `config`.
- El panel exige login (Supabase Auth, un único usuario creado a mano). La app está en internet.

## Pantallas

### 1. Conexión

- Arriba: URL del webhook y verify token, con botón de copiar, para pegarlos en el panel de Meta.
- Campos: Phone Number ID, WABA ID, token permanente, App Secret. Los secretos se muestran enmascarados una vez guardados.
- Botón **Probar conexión**: consulta el número en la API de Meta y muestra si responde y a nombre de quién.
- Indicador de webhook: cuándo se recibió el último evento (“hace 2 min” / “nunca”) y los últimos errores. Es el diagnóstico principal cuando Meta no entrega.

### 2. Inbox

- Columna izquierda: chats ordenados por actividad, con nombre, último mensaje, hora y marca de bot pausado o atención requerida.
- Columna derecha: hilo completo, distinguiendo visualmente contacto / bot / humano. Los mensajes fallidos se ven como fallidos.
- Campo para responder a mano (se envía como `sender: humano`).
- Interruptor **Pausar bot en este chat**.
- Actualización en vivo.

### 3. Bot

- Selector de rol; al elegirlo carga un prompt base que el usuario puede reescribir por completo.
- Mensaje de bienvenida (primer contacto de un `wa_id` nuevo).
- Horario de atención y mensaje fuera de horario.
- Palabras clave de escalamiento: al detectarse, el bot deja de responder ese chat y se marca `needs_attention`.
- Interruptor global **bot activo / pausado**.
- Probador: se escribe un mensaje de prueba y se ve la respuesta que daría el bot, sin tocar WhatsApp ni crear un contacto.

### 4. Leads

- Tabla de contactos: número, nombre, estado (editable), último mensaje, filtro por estado.
- Cuatro indicadores: conversaciones nuevas, mensajes recibidos, respondidos por el bot, escalados a humano. Sin gráficas.

## Errores

- **OpenAI falla o tarda**: un reintento. Si vuelve a fallar, no se envía nada y el chat se marca `needs_attention`. Silencio antes que una respuesta rota.
- **Envío a Meta falla**: el mensaje queda con `status: failed` y el error visible en el hilo.
- **Firma inválida**: `401`, sin procesar, registrado en `webhook_events`.
- **Mensaje duplicado**: la restricción única lo descarta sin efectos.
- **Tipo de mensaje no soportado** (audio, imagen, ubicación): se guarda y se muestra en el inbox, pero el bot no lo responde; contesta pidiendo texto.

## Pruebas

Tests automáticos sobre lo que se rompe en silencio:

- Validación de firma: acepta la correcta, rechaza la alterada.
- Anti-duplicados: dos entregas del mismo `wa_message_id` producen una sola respuesta.
- Verificación del webhook (`GET`): devuelve el challenge solo con el token correcto.
- Armado del prompt: incluye rol, instrucciones y los últimos 15 mensajes en orden.
- Reglas de silencio: bot pausado global, chat pausado, fuera de horario, palabra clave de escalamiento.
- Manejo de fallo de OpenAI: no envía y marca `needs_attention`.

La API de Meta y la de OpenAI se simulan en los tests. Verificación final manual: escribir al número desde un celular y ver la respuesta y el inbox.

## Fuera de alcance

Multi-número y multi-cliente, plantillas de mensajes y reactivación fuera de las 24 h, respuesta a audio/imagen, gráficas de métricas, facturación, integración con CRM externo.
