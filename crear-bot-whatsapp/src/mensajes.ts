export const NODE_MINIMO = 20

export const MENSAJES = {
  bienvenida:
    'Vamos a crear tu bot de WhatsApp. Son unos minutos y te voy pidiendo lo que haga falta.',

  nodeViejo: (actual: string) =>
    `Tienes Node ${actual} y hace falta la 20 o superior. Instálala desde nodejs.org y vuelve a intentarlo.`,

  antesDeEmpezar: [
    'Antes de empezar necesitas tener a mano:',
    '  1. Un proyecto creado en Supabase (supabase.com)',
    '  2. Una API key de OpenAI con saldo (platform.openai.com)',
    '  3. Una app de Meta con WhatsApp y un número (developers.facebook.com)',
    '  4. Una cuenta de Vercel (vercel.com)',
  ].join('\n'),

  carpetaOcupada: (carpeta: string) =>
    `En ${carpeta} ya hay un proyecto. Si sigo, copio el bot encima y puedes perder lo que haya.`,

  carpetaOcupadaSalida:
    'Sal a una carpeta vacía y vuelve a ejecutar el comando desde ahí.',

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

  cancelado:
    'Lo dejamos aquí. Cuando quieras, vuelve a ejecutar el comando y sigo donde iba.',

  seDetuvo:
    'Se detuvo aquí. Corrige lo de arriba y vuelve a ejecutar el comando: retomo donde iba.',
}
