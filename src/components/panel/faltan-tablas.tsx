const SQL_EDITOR = 'https://supabase.com/dashboard/project/nxieepcukyekvcticrqo/sql/new'

/** Se muestra mientras la base de datos esté vacía: sin tablas no hay nada que enseñar. */
export function FaltanTablas() {
  return (
    <div className="flex h-screen items-center justify-center px-8">
      <div className="max-w-md">
        <p className="eyebrow text-signal">Falta un paso</p>
        <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
          La base de datos está vacía
        </h2>
        <p className="mt-3 text-sm text-muted">
          Las tablas todavía no existen en Supabase. Abre el editor SQL, pega el contenido de{' '}
          <code className="font-mono text-ink">supabase/migrations/0001_init.sql</code> y ejecútalo.
          Luego recarga esta página.
        </p>
        <a
          href={SQL_EDITOR}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md bg-navy px-4 py-2 font-display text-sm font-medium text-white"
        >
          Abrir el editor SQL
        </a>
      </div>
    </div>
  )
}

/** true si el fallo es "la tabla no existe" y no un problema de credenciales o de red. */
export function esTablaFaltante(err: unknown): boolean {
  const mensaje = err instanceof Error ? err.message : String(err)
  return mensaje.includes('schema cache') || mensaje.includes('does not exist')
}
