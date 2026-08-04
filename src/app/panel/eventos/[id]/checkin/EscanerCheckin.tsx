"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Boton } from "@/components/ui/Boton";
import { EtiquetaMono } from "@/components/ui/Datos";
import { buscarParaCheckin, registrarPaso, type ResultadoBusqueda } from "./actions";

/** "kit" entrega la prenda; "asistencia" solo registra que el corredor llegó. */
export type ModoEscaner = "kit" | "asistencia";

type Estado =
  | { tipo: "inactivo" }
  | { tipo: "buscando" }
  | { tipo: "resultado"; datos: ResultadoBusqueda }
  | { tipo: "hecho"; nombre: string; talla: string | null };

const TEXTOS: Record<ModoEscaner, { accion: string; hecho: string; yaHecho: string; hint: string }> = {
  kit: {
    accion: "Confirmar entrega",
    hecho: "Kit entregado",
    yaHecho: "Ya entregado",
    hint: "Apunta al QR del corredor",
  },
  asistencia: {
    accion: "Confirmar asistencia",
    hecho: "Asistencia registrada",
    yaHecho: "Ya marcado presente",
    hint: "Apunta al dorsal o al QR",
  },
};

/* ------------------------------------------------------------------------- */
/* Escáner                                                                    */
/* ------------------------------------------------------------------------- */

/** Las cuatro esquinas del marco de guía, al 16 % de cada lado. */
function MarcoGuia() {
  const esquinas = [
    "left-[16%] top-[16%] border-l-2 border-t-2 rounded-tl",
    "right-[16%] top-[16%] border-r-2 border-t-2 rounded-tr",
    "left-[16%] bottom-[16%] border-b-2 border-l-2 rounded-bl",
    "right-[16%] bottom-[16%] border-b-2 border-r-2 rounded-br",
  ];
  return (
    <>
      {esquinas.map((c) => (
        <span key={c} className={`pointer-events-none absolute size-8.5 border-naranja ${c}`} />
      ))}
    </>
  );
}

export function EscanerCheckin({
  eventoId,
  codigoInicial,
  modo = "kit",
}: {
  eventoId: string;
  codigoInicial?: string;
  modo?: ModoEscaner;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlesRef = useRef<IScannerControls | null>(null);
  const ultimoCodigo = useRef<string>("");
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "inactivo" });
  const [pendiente, startTransition] = useTransition();

  async function procesar(termino: string) {
    // La cámara dispara varias lecturas del mismo código por segundo: se ignora
    // hasta que el operador atienda a otro corredor.
    if (!termino || termino === ultimoCodigo.current) return;
    ultimoCodigo.current = termino;
    setEstado({ tipo: "buscando" });
    const datos = await buscarParaCheckin(eventoId, termino);
    setEstado({ tipo: "resultado", datos });
    if (navigator.vibrate) navigator.vibrate(datos.estado === "encontrado" ? 60 : [40, 60, 40]);
  }

  // Si el operador escaneó el QR con la cámara nativa del teléfono, aterriza
  // aquí con ?codigo= y la ficha debe salir sola, sin volver a escanear.
  useEffect(() => {
    if (codigoInicial) void procesar(codigoInicial);
    // Solo al montar: `procesar` depende de refs estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoInicial]);

  useEffect(() => {
    if (!camaraActiva) return;
    const lector = new BrowserQRCodeReader();
    let cancelado = false;

    lector
      .decodeFromVideoDevice(undefined, videoRef.current!, (resultado) => {
        if (resultado) void procesar(resultado.getText());
      })
      .then((controles) => {
        if (cancelado) controles.stop();
        else controlesRef.current = controles;
      })
      .catch((e: Error) => {
        setErrorCamara(
          e.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Puedes buscar por número de dorsal."
            : "No se pudo abrir la cámara. Puedes buscar por número de dorsal."
        );
        setCamaraActiva(false);
      });

    return () => {
      cancelado = true;
      controlesRef.current?.stop();
      controlesRef.current = null;
    };
    // `procesar` se recrea en cada render pero solo usa refs y setState estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaraActiva, eventoId]);

  function confirmar(inscripcionId: string, nombre: string, talla: string | null) {
    startTransition(async () => {
      const res = await registrarPaso(eventoId, inscripcionId, modo);
      if (res.status === "entregado") setEstado({ tipo: "hecho", nombre, talla });
      else
        setEstado({
          tipo: "resultado",
          datos: { estado: "no_encontrado", mensaje: res.message ?? "No se pudo registrar." },
        });
    });
  }

  function siguiente() {
    ultimoCodigo.current = "";
    setEstado({ tipo: "inactivo" });
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-2 lg:items-stretch">
      {/* ---- Columna izquierda: cámara y búsqueda por dorsal ---- */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-linea bg-[#0b0d11]">
          {camaraActiva ? (
            <>
              <video ref={videoRef} className="size-full object-cover" muted playsInline />
              <MarcoGuia />
              {/* La línea de barrido solo en kits: en asistencia el operador
                  escanea de lejos y una línea en movimiento estorba. */}
              {modo === "kit" && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[16%] top-1/2 h-0.5"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,106,26,.8), transparent)",
                  }}
                />
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErrorCamara(null);
                setCamaraActiva(true);
              }}
              className="flex size-full flex-col items-center justify-center gap-3 text-atenuado"
            >
              <span className="text-4xl">📷</span>
              <span className="text-sm font-semibold">Activar cámara</span>
            </button>
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-[0.65625rem] font-semibold uppercase tracking-etiqueta text-texto/50">
            {TEXTOS[modo].hint}
          </span>
        </div>

        {camaraActiva && (
          <button
            type="button"
            onClick={() => setCamaraActiva(false)}
            className="self-start font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo hover:text-texto"
          >
            Apagar cámara
          </button>
        )}
        {errorCamara && (
          <p className="rounded-lg border border-amber-500/38 bg-amber-500/9 px-4 py-3 text-sm text-ambar">
            {errorCamara}
          </p>
        )}

        {/* Alternativa siempre disponible: el corredor puede no traer el teléfono. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const valor = new FormData(e.currentTarget).get("dorsal");
            if (typeof valor === "string") void procesar(valor);
          }}
          className="flex flex-col gap-1.5"
        >
          <EtiquetaMono>O escribe el dorsal</EtiquetaMono>
          <div className="flex gap-2">
            <input
              name="dorsal"
              inputMode="numeric"
              placeholder="— — — —"
              className="h-14 min-w-0 flex-1 rounded-md border border-linea-fuerte bg-superficie px-4 font-mono text-xl font-bold tracking-[0.08em] text-texto placeholder:text-texto/35 focus:border-azul focus:shadow-[inset_0_0_0_0.5px_var(--color-azul)] focus:outline-none"
            />
            <Boton type="submit" variante="secundaria" className="h-14 shrink-0">
              Buscar
            </Boton>
          </div>
        </form>
      </div>

      {/* ---- Columna derecha: ficha del corredor ---- */}
      <div className="flex flex-col">
        {estado.tipo === "buscando" && (
          <FichaVacia texto="Buscando…" />
        )}
        {estado.tipo === "inactivo" && (
          <FichaVacia texto="Escanea un dorsal para empezar" />
        )}
        {estado.tipo === "hecho" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/8 p-8 text-center">
            <p className="text-4xl">✅</p>
            <p className="text-lg font-extrabold text-verde">{TEXTOS[modo].hecho}</p>
            <p className="text-atenuado">
              {estado.nombre}
              {estado.talla && ` · Talla ${estado.talla}`}
            </p>
            <Boton variante="secundaria" onClick={siguiente} className="mt-2">
              Siguiente corredor
            </Boton>
          </div>
        )}
        {estado.tipo === "resultado" && (
          <FichaResultado
            datos={estado.datos}
            modo={modo}
            pendiente={pendiente}
            onConfirmar={confirmar}
            onSiguiente={siguiente}
            // El destino tiene que respetar el modo: no existe una ruta de
            // asistencia dentro de la carrera, así que ese caso va al módulo
            // general con la carrera ya seleccionada. Sin esto, un operador que
            // controla la entrada acababa en la mesa de entrega de kits.
            onCambiarCarrera={(id) =>
              router.push(
                modo === "kit"
                  ? `/panel/eventos/${id}/checkin`
                  : `/panel/asistencia?evento=${id}`
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function FichaVacia({ texto }: { texto: string }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-linea-fuerte p-10 text-center">
      <p className="text-sm text-mudo">{texto}</p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Ficha del corredor y sus estados                                           */
/* ------------------------------------------------------------------------- */

function FichaResultado({
  datos,
  modo,
  pendiente,
  onConfirmar,
  onSiguiente,
  onCambiarCarrera,
}: {
  datos: ResultadoBusqueda;
  modo: ModoEscaner;
  pendiente: boolean;
  onConfirmar: (id: string, nombre: string, talla: string | null) => void;
  onSiguiente: () => void;
  onCambiarCarrera: (eventoId: string) => void;
}) {
  // ── Estado 4: el código es de otra carrera de la misma empresa.
  if (datos.estado === "otra_carrera") {
    return (
      <Ficha borde="border-red-500/46" pildora={{ texto: "Otra carrera", tono: "rojo" }}>
        <p className="text-[1.0625rem] font-bold leading-snug text-texto">
          Este código es de{" "}
          <span className="text-naranja-suave">{datos.eventoNombre}</span>, no de la carrera que
          tienes abierta.
        </p>
        <div className="mt-auto flex flex-wrap gap-2.5 pt-5">
          <Boton variante="secundaria" onClick={() => onCambiarCarrera(datos.eventoId)}>
            Cambiar a esa carrera
          </Boton>
          <Boton variante="fantasma" onClick={onSiguiente}>
            Siguiente
          </Boton>
        </div>
      </Ficha>
    );
  }

  if (datos.estado === "no_encontrado") {
    return (
      <Ficha borde="border-red-500/46" pildora={{ texto: "Sin coincidencia", tono: "rojo" }}>
        <p className="text-[1.0625rem] font-bold leading-snug text-texto">{datos.mensaje}</p>
        <div className="mt-auto pt-5">
          <Boton variante="fantasma" onClick={onSiguiente}>
            Siguiente
          </Boton>
        </div>
      </Ficha>
    );
  }

  const i = datos.inscripcion;
  const anulada = i.estado !== "activa";
  const yaHecho = modo === "kit" ? i.kit_entregado : i.asistencia_confirmada;
  const cuando = modo === "kit" ? i.kit_entregado_en : i.asistencia_en;

  // ── Estado 2: inscripción anulada. **No hay botón de confirmar**: la acción
  //    correcta es no entregar, y ofrecerla invitaría al error.
  if (anulada) {
    return (
      <Ficha borde="border-red-500/46" pildora={{ texto: "No debe correr", tono: "rojo" }} apagado>
        <Dorsal numero={i.numero_dorsal} apagado />
        <Identidad inscripcion={i} />
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3.5 text-[0.8125rem] leading-relaxed text-rojo">
          Inscripción {i.estado}. No entregues el kit. Si el corredor reclama, derívalo a la mesa
          de administración.
        </p>
        <div className="mt-auto pt-5">
          <Boton variante="fantasma" onClick={onSiguiente}>
            Siguiente
          </Boton>
        </div>
      </Ficha>
    );
  }

  // ── Estado 1: ya entregado o ya presente.
  if (yaHecho) {
    const esAsistencia = modo === "asistencia";
    return (
      <Ficha
        borde={esAsistencia ? "border-cian/36" : "border-amber-500/42"}
        // En asistencia no es un error volver a leer: el cian lo dice sin alarmar.
        pildora={{ texto: TEXTOS[modo].yaHecho, tono: esAsistencia ? "cian" : "ambar" }}
      >
        <Dorsal numero={i.numero_dorsal} />
        <Identidad inscripcion={i} />
        <p
          className={`mt-3 font-mono text-[0.71875rem] uppercase tracking-etiqueta ${
            esAsistencia ? "text-cian" : "text-ambar"
          }`}
        >
          {esAsistencia ? "Presente desde" : "Entregado"}{" "}
          {cuando &&
            new Intl.DateTimeFormat("es-HN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
              new Date(cuando)
            )}
        </p>
        <div className="mt-auto flex flex-wrap gap-2.5 pt-5">
          <Boton
            variante="secundaria"
            disabled={pendiente}
            onClick={() => onConfirmar(i.id, i.nombre_completo, i.talla)}
          >
            {esAsistencia ? "Marcar de nuevo" : "Entregar de nuevo"}
          </Boton>
          <Boton variante="fantasma" onClick={onSiguiente}>
            Siguiente
          </Boton>
        </div>
      </Ficha>
    );
  }

  // ── Lectura normal.
  return (
    <Ficha borde="border-naranja/30">
      <Dorsal numero={i.numero_dorsal} />
      <Identidad inscripcion={i} />

      {modo === "kit" && (
        <div className="mt-5 flex items-stretch gap-3">
          {/* Dorsal y talla son los dos datos que se leen a un metro. */}
          <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-texto/10 bg-superficie-2 px-5.5 py-3.5">
            <span className="font-mono text-[0.59375rem] font-semibold uppercase tracking-etiqueta text-mudo">
              Talla
            </span>
            <span className="text-[3.5rem] font-black leading-none tracking-display text-texto">
              {i.talla ?? "—"}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              Ref. {i.id.slice(0, 8)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-auto pt-6">
        <Boton
          variante="primaria"
          ancho
          disabled={pendiente}
          onClick={() => onConfirmar(i.id, i.nombre_completo, i.talla)}
          className="h-15 text-base"
        >
          {pendiente ? "Registrando…" : TEXTOS[modo].accion}
        </Boton>
      </div>
    </Ficha>
  );
}

const TONO_PILDORA = {
  rojo: "border-red-500/40 bg-red-500/12 text-rojo",
  ambar: "border-amber-500/38 bg-amber-500/14 text-ambar",
  cian: "border-cian/36 bg-cian/12 text-cian",
} as const;

function Ficha({
  borde,
  pildora,
  apagado = false,
  children,
}: {
  borde: string;
  pildora?: { texto: string; tono: keyof typeof TONO_PILDORA };
  apagado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-1 flex-col rounded-xl border bg-superficie p-6 ${borde}`}>
      {pildora && (
        <span
          className={`mb-3 w-fit rounded-full border px-2.75 py-1.25 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta ${TONO_PILDORA[pildora.tono]}`}
        >
          {pildora.texto}
        </span>
      )}
      <div className={`flex flex-1 flex-col ${apagado ? "opacity-90" : ""}`}>{children}</div>
    </div>
  );
}

function Dorsal({ numero, apagado = false }: { numero: number | null; apagado?: boolean }) {
  return (
    <>
      <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-mudo">
        Dorsal
      </span>
      <span
        className={`tabular text-[4.75rem] font-black leading-none tracking-display-fuerte ${
          apagado ? "text-texto/55" : "text-texto"
        }`}
      >
        {numero ?? "—"}
      </span>
    </>
  );
}

function Identidad({
  inscripcion,
}: {
  inscripcion: { nombre_completo: string; categoria: string };
}) {
  return (
    <>
      <p className="mt-3 text-[1.375rem] font-extrabold tracking-display text-texto">
        {inscripcion.nombre_completo}
      </p>
      <p className="font-mono text-[0.71875rem] uppercase tracking-etiqueta text-mudo">
        {inscripcion.categoria}
      </p>
    </>
  );
}
