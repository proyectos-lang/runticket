import Link from "next/link";
import { Marca } from "./Marca";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-linea py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-sm text-mudo lg:px-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-2">
          <Marca className="text-base" /> — inscripciones para carreras y eventos deportivos.
        </p>
        <nav className="flex gap-4">
          <Link href="/eventos" className="transition-colors hover:text-texto">
            Carreras
          </Link>
          <Link href="/login" className="transition-colors hover:text-texto">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
