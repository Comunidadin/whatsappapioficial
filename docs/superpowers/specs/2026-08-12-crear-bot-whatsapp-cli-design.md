# `crear-bot-whatsapp` — Diseño del instalador

**Fecha:** 2026-08-12
**Estado:** aprobado, pendiente de plan de implementación

## Qué es

Un paquete de npm que se ejecuta con `npx crear-bot-whatsapp` y deja a un alumno con su propio panel de bot de WhatsApp desplegado y funcionando: proyecto creado, tablas en Supabase, aplicación en Vercel, webhook configurado en Meta y número registrado en la Cloud API.

Es la versión empaquetada del trabajo manual que se hizo el 2026-08-12 para montar el primer panel.

## Objetivo

Que un alumno del curso pase de no tener nada a tener su bot respondiendo por WhatsApp, sin abrir un solo formulario de Meta y sin pegar SQL en ningún editor.

## Para quién

Alumnos del curso de Joffre. Saben abrir una terminal y crear cuentas, pero no conocen la API de Meta ni Supabase. El comando habla en español, va de a un paso, valida cada dato al recibirlo y explica cada error en términos de qué hacer, no de qué respondió la API.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Distribución | Paquete propio en npm con la plantilla incluida | Funciona con el repo privado; la versión queda congelada por publicación, así que un commit a mitad de clase no rompe la instalación de nadie |
| Alcance | Configuración guiada completa | El alumno solo aporta credenciales; el resto lo hace el comando |
| Destino | Despliegue en Vercel | Meta necesita una URL pública; en `localhost` el bot no recibe nada |
| Migración de base de datos | Management API de Supabase con *personal access token* | La secret key no puede ejecutar DDL; pegar SQL a mano fue el paso que más falló en la instalación manual |
| Webhook de Meta | Automático vía `POST /{app_id}/subscriptions` con app access token | Es el formulario donde más se traba la gente |

Descartado: clonar el repo con `degit` (exige repo público y expone commits a medio hacer), script dentro del repo (no es un `npx`), y crear el proyecto de Supabase por API (obliga a elegir organización y región y a esperar el aprovisionamiento; el alumno lo crea antes).

## Requisitos previos del alumno

El comando los comprueba antes de pedir nada y corta con enlaces si falta alguno:

- Node.js 20 o superior
- Una cuenta de Supabase **con un proyecto ya creado**
- Una API key de OpenAI con saldo
- Una app de Meta con el producto WhatsApp añadido y un número de teléfono asociado
- Un token permanente de Meta generado desde un usuario del sistema **que tenga asignada la cuenta de WhatsApp**

## El recorrido

### Fase 1 — Credenciales

1. Nombre de la carpeta del proyecto.
2. **Supabase**: URL del proyecto, publishable key, secret key, personal access token.
3. **OpenAI**: API key.
4. **Meta**: App ID, App Secret, token permanente.

Cada credencial se valida contra su API en el momento de pegarla:

- Supabase: lectura de una tabla del sistema con la secret key.
- OpenAI: una petición mínima a `chat/completions`.
- Meta: `GET /debug_token`, que además revela si el token tiene activos asignados.

Un dato inválido se vuelve a pedir en el momento, con la explicación de qué está mal.

### Fase 2 — Trabajo automático

Solo se interrumpe dos veces: para elegir número si hay varios (paso 7) y para confirmar el registro con su PIN (paso 8).

5. Copiar la plantilla e instalar dependencias.
6. Crear las tablas ejecutando `0001_init.sql` con el personal access token (`POST /v1/projects/{ref}/database/query` de la Management API).
7. Descubrir el WABA y los números del token de Meta. Si hay más de uno, preguntar cuál.
8. Si el número está en `PENDING`, **avisar de que registrarlo lo saca de la app normal de WhatsApp**, pedir confirmación y un PIN de 6 dígitos, y registrarlo.
9. Guardar la configuración en la tabla `config` (credenciales de Meta y token de verificación generado).
10. Crear el proyecto en Vercel, cargar las variables de entorno y desplegar. El login de Vercel abre el navegador.
11. Configurar el webhook en Meta con la URL desplegada y suscribir el campo `messages`.
12. Conectar la app al WABA (`POST /{waba_id}/subscribed_apps`).
13. Comprobar de punta a punta: llamar a la propia URL del webhook simulando la verificación de Meta.

### Fase 3 — Cierre

Imprime la URL del panel, el enlace `wa.me` del número, el PIN elegido y el único pendiente: escribir las instrucciones del bot en `/bot` y encenderlo.

## Orden obligatorio

Estos pasos no se pueden reordenar:

```
tablas en Supabase
  → variables de entorno en Vercel
    → desplegar
      → obtener la URL
        → guardar el token de verificación en `config`
          → pedirle a Meta que configure el webhook
```

Cuando se le pide a Meta que configure el webhook, Meta llama a la URL **en ese mismo instante** para verificarla. Si el token de verificación no está ya guardado en la base, o si el despliegue no tiene las variables de entorno, la verificación falla.

## Reanudación

El avance se guarda en `.crear-bot.json` dentro de la carpeta del proyecto: qué pasos se completaron y los datos no secretos (URL de Supabase, App ID, WABA, número, URL desplegada). **Las credenciales no se guardan ahí**; viven en `.env.local`, que ya está en el `.gitignore` de la plantilla.

Al volver a ejecutar el comando sobre una carpeta existente, retoma desde el primer paso pendiente en vez de preguntarlo todo otra vez.

Cada paso automático es repetible sin daño:

- Conectar la app al WABA dos veces devuelve éxito.
- Registrar un número ya registrado se detecta antes por su `status` y se salta.
- La migración usa `create table if not exists` y `drop policy if exists`.
- Reconfigurar el webhook con los mismos datos es inofensivo.

## Errores previstos

Cada uno se detecta explícitamente y se explica con qué pasó, por qué y qué hacer:

- **Token de Meta sin activos asignados.** Es el fallo más probable y el más confuso: la API responde que el número "no existe". Se detecta en la fase de preguntas mirando los `granular_scopes` del token, antes de intentar nada. El mensaje indica asignar la cuenta de WhatsApp al usuario del sistema y **generar un token nuevo**, porque los activos quedan grabados dentro del token al crearlo.
- **Número en `PENDING`.** Se registra tras confirmación explícita, advirtiendo de que el número dejará de funcionar en la app normal de WhatsApp.
- **Login de Vercel cancelado o fallido.** Se detiene indicando cómo retomar.
- **Verificación del webhook rechazada.** Antes de culpar a Meta, el comando llama a su propia URL desplegada simulando la verificación: si responde bien, el problema está del lado de Meta; si no, el despliegue quedó sin variables de entorno.
- **Migración rechazada.** Se muestra el error de Postgres y la ruta del archivo SQL para poder ejecutarlo a mano.
- **Sin saldo en OpenAI.** Se detecta en la validación de la key, no cuando el bot enmudece.

## Estructura del paquete

```
crear-bot-whatsapp/
  bin/crear-bot-whatsapp.js      # punto de entrada
  src/
    preguntas.ts                 # el diálogo y la validación de cada credencial
    estado.ts                    # leer y escribir .crear-bot.json
    plantilla.ts                 # copiar la plantilla e instalar dependencias
    supabase.ts                  # migración vía Management API, escritura de config
    meta.ts                      # descubrir WABA, registrar número, webhook, subscribed_apps
    vercel.ts                    # crear proyecto, variables de entorno, desplegar
    pasos.ts                     # el orden, la reanudación y el manejo de errores
    mensajes.ts                  # todos los textos al alumno, en un solo sitio
  plantilla/                     # el proyecto del panel, tal cual
```

Los textos viven separados de la lógica: cuando el curso cambie, se corrigen sin tocar el código.

## Pruebas

Automáticas, con las respuestas de las APIs simuladas:

- Validación de cada credencial: acepta las buenas, rechaza las malas con el mensaje correcto.
- Detección del token sin activos.
- Detección de número en `PENDING` frente a `CONNECTED`.
- Reanudación: con un `.crear-bot.json` a medias, se salta lo hecho y sigue por donde iba.
- Orden de los pasos: el webhook no se configura antes de tener URL desplegada ni antes de guardar el token de verificación.
- Idempotencia: ejecutar dos veces cada paso automático no rompe nada.

La prueba de verdad es una ejecución completa contra cuentas limpias de Supabase, OpenAI, Meta y Vercel, antes de publicar el paquete.

## Fuera de alcance

Crear el proyecto de Supabase o la cuenta de Meta por API; comprar o verificar números; modo túnel para desarrollo local; soporte para Windows sin WSL; traducción a otros idiomas; interfaz gráfica.
