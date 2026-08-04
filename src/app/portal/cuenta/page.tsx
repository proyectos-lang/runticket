import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/auth/session";
import { cerrarSesion } from "@/lib/auth/actions";
import { EncabezadoSeccion } from "@/components/portal/Historial";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajustes de cuenta | RunTicket",
  robots: { index: false },
};

/**
 * Fila de ajuste. Con `href` navega; sin él solo muestra un valor.
 *
 * Deliberadamente no existe una variante «deshabilitada»: una fila que no lleva
 * a ningún sitio promete una función que no está construida, y eso es peor que
 * no ofrecerla.
 */
function FilaAjuste({
  label,
  valor,
  href,
}: {
  label: string;
  valor?: string | null;
  href?: string;
}) {
  const contenido = (
    <>
      <span className="text-sm font-semibold text-texto">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        {valor && (
          <span className="truncate font-mono text-xs text-texto/45">{valor}</span>
        )}
        {href && (
          <span aria-hidden className="text-lg font-bold text-texto/30">
            ›
          </span>
        )}
      </span>
    </>
  );

  const clases = "flex items-center justify-between gap-4 border-b border-linea py-4";
  return href ? (
    <Link href={href} className={`${clases} transition-colors hover:text-texto`}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

export default async function CuentaPage() {
  const perfil = await getPerfilActual();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: sinLeer }, { count: inscripciones }, { count: certificados }] =
    await Promise.all([
      supabase.from("notificaciones").select("id", { count: "exact", head: true }).eq("leido", false),
      supabase
        .from("inscripciones")
        .select("id", { count: "exact", head: true })
        .eq("corredor_id", user?.id ?? "")
        .eq("estado", "activa"),
      // Certificados disponibles = inscripciones activas cuyo evento ya cerró el
      // organizador, que es lo que exige el endpoint del PDF. Contar la tabla
      // `certificados` daba siempre 0: nadie escribe nunca en ella.
      supabase
        .from("inscripciones")
        .select("id, eventos!inner(estado)", { count: "exact", head: true })
        .eq("corredor_id", user?.id ?? "")
        .eq("estado", "activa")
        .eq("eventos.estado", "finalizado"),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/portal"
          className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
        >
          ← Mi perfil
        </Link>
        <h1 className="display text-2xl text-texto">Ajustes de cuenta</h1>
      </div>

      <section className="flex flex-col">
        <EncabezadoSeccion>Cuenta</EncabezadoSeccion>
        <FilaAjuste label="Correo electrónico" valor={user?.email ?? "—"} />
        <FilaAjuste
          label="Teléfono"
          valor={perfil?.telefono ?? "Sin registrar"}
          href="/portal/perfil"
        />
        <FilaAjuste label="Contraseña" valor="Cambiar" href="/recuperar-password" />
        <FilaAjuste label="Idioma" valor="Español" />
      </section>

      <section className="flex flex-col">
        <EncabezadoSeccion>Actividad</EncabezadoSeccion>
        <FilaAjuste
          label="Notificaciones"
          valor={sinLeer ? `${sinLeer} sin leer` : "Al día"}
          href="/portal/notificaciones"
        />
        <FilaAjuste
          label="Mis inscripciones"
          valor={String(inscripciones ?? 0)}
          href="/portal/inscripciones"
        />
        <FilaAjuste
          label="Certificados"
          valor={String(certificados ?? 0)}
          href="/portal/certificados"
        />
      </section>

      <section className="flex flex-col">
        <EncabezadoSeccion>Datos personales</EncabezadoSeccion>
        <FilaAjuste label="Perfil deportivo" href="/portal/perfil" />
        <p className="py-4 text-xs leading-relaxed text-mudo">
          Tus datos se usan para emitir el dorsal, validar la categoría por edad y entregar la
          información al organizador de cada carrera en la que te inscribes. Para descargar una
          copia o eliminar tu cuenta, escribe al administrador de la plataforma.
        </p>
      </section>

      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundaria" ancho>
          Cerrar sesión
        </Boton>
      </form>

      {/* Se documenta en vez de dibujarse: unos interruptores que no persisten
          o una descarga que no existe son peores que no ofrecerlos. */}
      <Aviso tono="azul" titulo="Todavía no disponible">
        Los métodos de pago guardados, las preferencias de notificación, la descarga de tus datos
        y la eliminación de cuenta requieren desarrollo en el servidor y aún no están construidos.
        Para cualquiera de esas cuatro cosas, escribe al administrador de la plataforma.
      </Aviso>
    </div>
  );
}
