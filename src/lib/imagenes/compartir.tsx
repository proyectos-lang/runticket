import "server-only";
import sharp from "sharp";
import { sitio } from "@/lib/correo/maqueta";

/**
 * Imágenes listas para compartir en redes: el resultado de una carrera y el
 * historial del corredor. Se dibujan con `ImageResponse` (satori), que admite
 * solo flexbox y un subconjunto de CSS; por eso todo va con estilos en línea y
 * cada `div` con varios hijos lleva `display: flex`.
 *
 * Dos formatos: **historia** (9:16, para Instagram/WhatsApp Stories) y
 * **publicación** (1:1, para el feed).
 */
export const FORMATOS = {
  historia: { ancho: 1080, alto: 1920 },
  cuadrado: { ancho: 1080, alto: 1080 },
} as const;
export type Formato = keyof typeof FORMATOS;

export function formatoDe(valor: string | null): Formato {
  return valor === "historia" ? "historia" : "cuadrado";
}

/** Colores del sistema (globals.css); satori no lee las variables CSS. */
const C = {
  fondo: "#07080a",
  superficie: "#0e1116",
  texto: "#f3f4f6",
  atenuado: "rgba(243,244,246,0.72)",
  mudo: "rgba(243,244,246,0.45)",
  naranja: "#ff6a1a",
  naranjaSuave: "#ff8a45",
  cian: "#3ad9ff",
  azul: "#2f6bff",
  linea: "rgba(255,255,255,0.12)",
};

/**
 * Las fuentes de la marca, servidas desde `public/fuentes` (WOFF, que satori sí
 * lee). Si no se pueden cargar, se dibuja con la fuente por defecto antes que
 * fallar: una imagen con otra letra sigue siendo compartible.
 */
export async function fuentesMarca() {
  const cargar = async (archivo: string) => {
    const r = await fetch(`${sitio()}/fuentes/${archivo}`, { cache: "force-cache" });
    if (!r.ok) throw new Error(`fuente ${archivo}: ${r.status}`);
    return r.arrayBuffer();
  };
  try {
    const [display, normal, mono] = await Promise.all([
      cargar("archivo-900-italic.woff"),
      cargar("archivo-700.woff"),
      cargar("jetbrains-mono-700.woff"),
    ]);
    return [
      { name: "Archivo", data: display, weight: 900 as const, style: "italic" as const },
      { name: "Archivo", data: normal, weight: 700 as const, style: "normal" as const },
      { name: "JetBrains Mono", data: mono, weight: 700 as const, style: "normal" as const },
    ];
  } catch (e) {
    console.warn("Imágenes compartibles: sin fuentes de marca", e);
    return [];
  }
}

/**
 * Una imagen remota como JPEG en base64. Los banners y avatares se guardan en
 * WebP, que satori no sabe pintar, así que se convierten con sharp y se
 * reducen al ancho de la imagen final.
 */
export async function imagenComoJpeg(url: string | null | undefined, ancho = 1080): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) return null;
    const jpeg = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(ancho, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

const DISPLAY = { fontFamily: "Archivo", fontWeight: 900, fontStyle: "italic" as const, textTransform: "uppercase" as const, letterSpacing: "-0.04em" };
const MONO = { fontFamily: "JetBrains Mono", fontWeight: 700 };
const ETIQUETA = { ...MONO, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.mudo };

function Marca({ tamano = 44 }: { tamano?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", ...DISPLAY, fontSize: tamano, letterSpacing: "-0.05em" }}>
      <span style={{ color: C.texto }}>Run</span>
      <span style={{ color: C.naranja }}>Ticket</span>
      <span style={{ color: C.azul, fontSize: tamano * 0.6, marginLeft: 4, marginBottom: tamano * 0.35 }}>HN</span>
    </div>
  );
}

function Fondo({ banner, alto, children }: { banner: string | null; alto: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.fondo,
        color: C.texto,
        position: "relative",
      }}
    >
      {banner ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori no conoce next/image
        <img
          src={banner}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: 1080, height: alto * 0.56, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1080,
            height: alto * 0.56,
            display: "flex",
            background: `radial-gradient(circle at 30% 20%, rgba(255,106,26,0.55), transparent 60%), radial-gradient(circle at 80% 70%, rgba(47,107,255,0.45), transparent 55%)`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: alto,
          display: "flex",
          background: `linear-gradient(to bottom, rgba(7,8,10,0.25) 0%, rgba(7,8,10,0.82) 42%, ${C.fondo} 58%)`,
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: alto, display: "flex", flexDirection: "column", padding: 64 }}>
        {children}
      </div>
    </div>
  );
}

function Celda({ etiqueta, valor, color = C.texto, ancho }: { etiqueta: string; valor: string; color?: string; ancho?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: ancho }}>
      <span style={{ ...MONO, fontSize: 56, color, letterSpacing: "-0.02em" }}>{valor}</span>
      <span style={ETIQUETA}>{etiqueta}</span>
    </div>
  );
}

export type DatosImagenResultado = {
  formato: Formato;
  evento: string;
  fecha: string;
  categoria: string;
  tiempo: string;
  ritmo: string | null;
  puesto: number | null;
  participantes: number | null;
  puestoCategoria: number | null;
  percentil: number | null;
  esRecord: boolean;
  corredor: string;
  dorsal: number | null;
  banner: string | null;
};

export function ImagenResultado(d: DatosImagenResultado) {
  const { alto } = FORMATOS[d.formato];
  const historia = d.formato === "historia";
  return (
    <Fondo banner={d.banner} alto={alto}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Marca />
        {d.dorsal !== null && (
          <span style={{ ...MONO, fontSize: 28, color: C.naranjaSuave, letterSpacing: "0.1em" }}>DORSAL #{d.dorsal}</span>
        )}
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: historia ? 28 : 18 }}>
        {d.esRecord && (
          <span
            style={{
              ...MONO,
              fontSize: 24,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.naranjaSuave,
              border: `2px solid ${C.naranja}`,
              borderRadius: 999,
              padding: "12px 24px",
              alignSelf: "flex-start",
            }}
          >
            ▲ Récord personal
          </span>
        )}
        <span style={{ ...DISPLAY, fontSize: historia ? 76 : 60, lineHeight: 0.95, color: C.texto }}>{d.evento}</span>
        <span style={{ ...ETIQUETA, fontSize: 26, color: C.atenuado }}>
          {[d.fecha, d.categoria].filter(Boolean).join("  ·  ")}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: historia ? 36 : 16 }}>
          <span style={{ ...MONO, fontSize: historia ? 190 : 150, lineHeight: 1, letterSpacing: "-0.04em", color: d.esRecord ? C.cian : C.texto }}>
            {d.tiempo}
          </span>
          <span style={ETIQUETA}>Tiempo oficial</span>
        </div>

        <div style={{ display: "flex", gap: 48, marginTop: historia ? 36 : 16, paddingTop: 32, borderTop: `2px solid ${C.linea}` }}>
          <Celda etiqueta="Puesto general" valor={d.puesto !== null ? `${d.puesto}${d.participantes ? `/${d.participantes}` : ""}` : "—"} ancho={330} />
          <Celda etiqueta="Categoría" valor={d.puestoCategoria !== null ? `${d.puestoCategoria}º` : "—"} ancho={240} />
          <Celda etiqueta="Ritmo" valor={d.ritmo ?? "—"} color={C.cian} ancho={300} />
        </div>

        {d.percentil !== null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            <div style={{ display: "flex", width: "100%", height: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", width: `${d.percentil}%`, height: 12, borderRadius: 999, background: `linear-gradient(90deg, ${C.azul}, ${C.cian})` }} />
            </div>
            <span style={{ ...MONO, fontSize: 26, color: C.atenuado }}>
              Mejor que el <span style={{ color: C.cian, marginLeft: 8, marginRight: 8 }}>{d.percentil} %</span> de la carrera
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: historia ? 56 : 28, paddingTop: 28, borderTop: `2px solid ${C.linea}` }}>
        <span style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 36, color: C.texto }}>{d.corredor}</span>
        <span style={{ ...ETIQUETA, fontSize: 22 }}>runtickethn.com</span>
      </div>
    </Fondo>
  );
}

export type DatosImagenHistorial = {
  formato: Formato;
  nombre: string;
  ciudad: string | null;
  desdeAnio: number | null;
  carreras: number;
  kmTotales: number;
  podios: number;
  mejores: { distancia: string; tiempo: string }[];
  ultimas: { evento: string; tiempo: string | null; fecha: string }[];
  avatar: string | null;
  banner: string | null;
};

export function ImagenHistorial(d: DatosImagenHistorial) {
  const { alto } = FORMATOS[d.formato];
  const historia = d.formato === "historia";
  const ultimas = d.ultimas.slice(0, historia ? 4 : 2);
  return (
    <Fondo banner={d.banner} alto={alto}>
      <Marca />
      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {d.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori no conoce next/image
          <img src={d.avatar} alt="" width={140} height={140} style={{ width: 140, height: 140, borderRadius: 999, objectFit: "cover", border: `5px solid ${C.naranja}` }} />
        ) : (
          <div style={{ display: "flex", width: 140, height: 140, borderRadius: 999, border: `5px solid ${C.naranja}`, backgroundColor: C.superficie, alignItems: "center", justifyContent: "center", ...DISPLAY, fontSize: 56, color: C.texto }}>
            {d.nombre.split(" ").slice(0, 2).map((p) => p.charAt(0)).join("")}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ ...DISPLAY, fontSize: historia ? 64 : 54, lineHeight: 0.95, color: C.texto }}>{d.nombre}</span>
          <span style={{ ...ETIQUETA, fontSize: 24, color: C.atenuado }}>
            {[d.ciudad, d.desdeAnio ? `Corriendo desde ${d.desdeAnio}` : null].filter(Boolean).join("  ·  ")}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: historia ? 56 : 36, paddingTop: 32, borderTop: `2px solid ${C.linea}` }}>
        <Celda etiqueta="Carreras" valor={String(d.carreras)} ancho={280} />
        <Celda etiqueta="Kilómetros" valor={d.kmTotales.toLocaleString("es-HN")} color={C.cian} ancho={340} />
        <Celda etiqueta="Podios" valor={String(d.podios)} color={d.podios ? C.naranjaSuave : C.texto} ancho={240} />
      </div>

      {d.mejores.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: historia ? 44 : 28 }}>
          <span style={ETIQUETA}>Mejores marcas</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {d.mejores.slice(0, 4).map((m) => (
              <div key={m.distancia} style={{ display: "flex", alignItems: "baseline", gap: 14, border: `2px solid ${C.linea}`, borderRadius: 999, padding: "14px 28px" }}>
                <span style={{ ...MONO, fontSize: 26, color: C.mudo }}>{m.distancia}</span>
                <span style={{ ...MONO, fontSize: 36, color: C.texto }}>{m.tiempo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ultimas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: historia ? 44 : 28 }}>
          <span style={ETIQUETA}>Últimas carreras</span>
          {ultimas.map((u, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24, paddingBottom: 14, borderBottom: `2px solid ${C.linea}` }}>
              <span style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 32, color: C.texto }}>{u.evento}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
                <span style={{ ...MONO, fontSize: 22, color: C.mudo }}>{u.fecha}</span>
                <span style={{ ...MONO, fontSize: 34, color: u.tiempo ? C.texto : C.mudo }}>{u.tiempo ?? "—:—:—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: historia ? 48 : 28 }}>
        <span style={{ ...ETIQUETA, fontSize: 22 }}>runtickethn.com</span>
      </div>
    </Fondo>
  );
}
