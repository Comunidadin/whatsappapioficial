# crear-bot-whatsapp

Crea tu panel de bot de WhatsApp con un comando: base de datos, despliegue y webhook incluidos.

```
npx crear-bot-whatsapp
```

## Qué necesitas antes

1. **Node.js 20 o superior** — nodejs.org
2. **Un proyecto en Supabase** — supabase.com. De ahí salen la URL, la clave publicable y la
   clave secreta (Settings → API Keys), y la clave de acceso personal (Account → Access Tokens).
3. **Una API key de OpenAI con saldo** — platform.openai.com
4. **Una cuenta de Vercel** — vercel.com
5. **Una app de Meta con WhatsApp y un número dedicado** — developers.facebook.com

## El token de Meta

Es el paso donde más gente se traba. El token se genera desde un **usuario del sistema**, y ese
usuario tiene que tener **asignada tu cuenta de WhatsApp antes de generarlo**:

1. business.facebook.com → Configuración del negocio → Usuarios → Usuarios del sistema
2. Elige tu usuario del sistema → **Agregar activos** → Cuentas de WhatsApp → tu cuenta → control total
3. **Generar token nuevo**, con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`

Si asignas la cuenta pero reutilizas un token viejo, no funciona: los permisos sobre activos quedan
grabados dentro del token en el momento de crearlo. El instalador lo detecta y te lo dice.

## Importante

El número que uses **dejará de funcionar en la app normal de WhatsApp**. Usa una línea dedicada,
no tu número personal.

## Si algo falla

Vuelve a ejecutar el comando en la misma carpeta: retoma donde se quedó, sin volver a pedirte
las credenciales.

## Qué hace por dentro

1. Copia el proyecto del panel e instala sus dependencias
2. Crea las tablas en tu Supabase
3. Registra tu número en la Cloud API si hace falta
4. Despliega en Vercel con tus variables de entorno
5. Guarda la configuración de Meta en tu base de datos
6. Configura el webhook en Meta y suscribe el campo `messages`
7. Conecta tu app a tu cuenta de WhatsApp
8. Comprueba que el webhook desplegado responde

Los pasos 4, 5 y 6 van en ese orden a propósito: Meta llama a tu URL en el mismo instante en que
se la configuras, así que para entonces todo tiene que estar en su sitio.
