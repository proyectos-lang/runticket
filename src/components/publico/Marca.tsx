import Link from "next/link";

/**
 * Wordmark del diseño: `RUN` en blanco y `TICKET` en naranja, peso 900 con el
 * tracking muy cerrado. Es la única pieza naranja que aparece en todas las
 * pantallas, y no cuenta para la regla del botón único porque no es una acción.
 */
export function Marca({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="RunTicket, inicio"
      className={`display shrink-0 text-xl leading-none text-texto ${className}`}
    >
      Run<span className="text-naranja">Ticket</span>
    </Link>
  );
}
