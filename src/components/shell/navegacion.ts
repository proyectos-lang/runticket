import type { NombreIcono } from "./iconos";
import type { RolEmpresa } from "@/lib/supabase/database.types";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Si true, solo se resalta con coincidencia exacta. */
  exacto?: boolean;
  /** Cifra en píldora a la derecha del ítem. Se oculta si es 0. */
  contador?: number;
  /** Marca el ítem con «!» ámbar: le falta algo para poder publicar. */
  pendiente?: boolean;
  /**
   * Marca el contador como algo que reclama atención (avisos sin leer). Va en
   * naranja; el contador normal es neutro, para que no compitan entre sí.
   */
  urgente?: boolean;
};

export type SeccionNav = {
  titulo?: string;
  /** Segunda línea bajo el título del grupo: el nombre de la carrera abierta. */
  subtitulo?: string;
  /**
   * Marca el grupo como «estás dentro de un contexto». Se pinta en naranja para
   * que se distinga de los grupos del menú general: sin esa señal, al entrar en
   * una carrera no queda claro que la mitad de abajo del menú cambió.
   */
  contextual?: boolean;
  items: ItemNav[];
};

/**
 * Consola de plataforma. **No lleva ningún enlace a carreras y no debe
 * llevarlo**: esta consola habilita empresas, y las carreras se gestionan
 * dentro del panel de cada una.
 */
export function navAdmin(contadores?: { empresas?: number; usuarios?: number }): SeccionNav[] {
  return [
    {
      items: [
        { href: "/admin", etiqueta: "Resumen", icono: "resumen", exacto: true },
        { href: "/admin/empresas", etiqueta: "Empresas", icono: "empresas", contador: contadores?.empresas },
        { href: "/admin/usuarios", etiqueta: "Usuarios", icono: "usuarios", contador: contadores?.usuarios },
        { href: "/admin/auditoria", etiqueta: "Bitácora", icono: "bitacora" },
        { href: "/admin/configuracion", etiqueta: "Mi cuenta", icono: "configuracion" },
      ],
    },
  ];
}

/**
 * Menú del panel de empresa. Todos los módulos son de primer nivel y están
 * siempre visibles, incluso sin eventos: cada uno elige después sobre qué
 * carrera trabajar. Antes vivían dentro de un evento y con cero eventos el panel
 * parecía vacío.
 */
export function navPanel(
  rol: RolEmpresa,
  contadores?: { carreras?: number; enEspera?: number; porVerificar?: number; avisos?: number }
): SeccionNav[] {
  const esAdmin = rol === "admin_empresa";

  const general: ItemNav[] = [
    { href: "/panel", etiqueta: "Resumen", icono: "resumen", exacto: true },
    {
      href: "/panel/notificaciones",
      etiqueta: "Avisos",
      icono: "notificaciones",
      exacto: true,
      // En naranja: una inscripción nueva sin ver es justo lo que el organizador
      // no puede permitirse pasar por alto.
      contador: contadores?.avisos,
      urgente: true,
    },
    // `exacto`: dentro de una carrera el resaltado lo lleva el grupo «Esta
    // carrera». Sin esto, `/panel/eventos/{id}/inscritos` marcaba a la vez
    // «Carreras» y el ítem correcto, y el menú decía dos cosas a la vez.
    {
      href: "/panel/eventos",
      etiqueta: "Carreras",
      icono: "eventos",
      exacto: true,
      contador: contadores?.carreras,
    },
    { href: "/panel/inscritos", etiqueta: "Inscritos", icono: "inscritos", exacto: true },
  ];
  if (esAdmin) {
    general.push(
      { href: "/panel/inventario", etiqueta: "Inventario de prendas", icono: "tallas" },
      {
        href: "/panel/lista-espera",
        etiqueta: "Lista de espera",
        icono: "listaEspera",
        // Informativo, no urgente: que haya cola no obliga a hacer nada hoy.
        contador: contadores?.enEspera,
      },
      { href: "/panel/cupones", etiqueta: "Cupones", icono: "cupones" }
    );
  }

  const diaDeCarrera: ItemNav[] = [
    { href: "/panel/asistencia", etiqueta: "Control de asistencia", icono: "asistencia", exacto: true },
    { href: "/panel/checkin", etiqueta: "Entrega de kits", icono: "kits", exacto: true },
    { href: "/panel/resultados", etiqueta: "Resultados", icono: "resultados", exacto: true },
  ];
  if (esAdmin) {
    diaDeCarrera.push({ href: "/panel/fotos", etiqueta: "Fotos", icono: "imagenes", exacto: true });
  }

  const secciones: SeccionNav[] = [
    { items: general },
    { titulo: "Día de carrera", items: diaDeCarrera },
  ];

  // Todo lo financiero y analítico queda fuera del alcance del operador, igual
  // que en las políticas de la base de datos.
  if (esAdmin) {
    secciones.push({
      titulo: "Análisis y administración",
      items: [
        { href: "/panel/metricas", etiqueta: "Métricas", icono: "metricas", exacto: true },
        {
          href: "/panel/pagos",
          etiqueta: "Pagos",
          icono: "pagos",
          // En ámbar: un comprobante sin verificar bloquea el dorsal del corredor.
          contador: contadores?.porVerificar,
          urgente: true,
        },
        { href: "/panel/configuracion", etiqueta: "Mi empresa", icono: "empresas" },
      ],
    });
  }

  return secciones;
}

/**
 * Pasos para dejar una carrera lista, en el orden en que conviene hacerlos:
 * primero lo que la identifica, luego dónde y cómo se ve, y al final lo que
 * cobra y lo que firma el corredor.
 *
 * Es la **única** definición de ese orden. La usan el menú lateral y el
 * asistente de «Siguiente»; si cada uno tuviera la suya, el botón llevaría a un
 * sitio distinto del que muestra el menú justo al lado.
 *
 * Solo entran las pantallas de configuración. Inscribir en mesa, entrega de kits
 * o resultados son operación del día de carrera, no preparación.
 */
export const PASOS_CONFIGURACION: { segmento: string; etiqueta: string; icono: NombreIcono }[] = [
  { segmento: "editar", etiqueta: "Datos", icono: "editar" },
  { segmento: "ubicacion", etiqueta: "Ubicación y ruta", icono: "ubicacion" },
  { segmento: "imagenes", etiqueta: "Imágenes", icono: "imagenes" },
  { segmento: "categorias", etiqueta: "Categorías", icono: "categorias" },
  { segmento: "precios", etiqueta: "Precios por fecha", icono: "precios" },
  { segmento: "tallas", etiqueta: "Tallas", icono: "tallas" },
  { segmento: "patrocinadores", etiqueta: "Patrocinadores", icono: "patrocinadores" },
  { segmento: "declaracion", etiqueta: "Declaración de salud", icono: "bitacora" },
];

/**
 * Sub-navegación de una carrera concreta. `/panel/layout.tsx` es padre de
 * `/panel/eventos/[id]` y no puede conocer el evento, así que es `NavLateral`
 * quien detecta el id en la ruta y pide esta sección.
 */
export function navEvento(
  eventoId: string,
  rol: RolEmpresa,
  contexto?: { nombre?: string; pendientes?: string[] }
): SeccionNav {
  const base = `/panel/eventos/${eventoId}`;
  const items: ItemNav[] = [{ href: base, etiqueta: "Resumen", icono: "resumen", exacto: true }];

  if (rol === "admin_empresa") {
    items.push(
      // Mismo orden que el asistente paso a paso, por construcción.
      ...PASOS_CONFIGURACION.map((p) => ({
        href: `${base}/${p.segmento}`,
        etiqueta: p.etiqueta,
        icono: p.icono,
      })),
      { href: `${base}/inscribir`, etiqueta: "Inscribir en mesa", icono: "inscritos" },
      { href: `${base}/transferir`, etiqueta: "Transferir inscripción", icono: "volver" }
    );
  }

  items.push(
    { href: `${base}/inscritos`, etiqueta: "Inscritos", icono: "inscritos", exacto: true },
    { href: `${base}/checkin`, etiqueta: "Entrega de kits", icono: "kits", exacto: true },
    { href: `${base}/resultados`, etiqueta: "Resultados", icono: "resultados", exacto: true }
  );

  // Lo analítico y la cola quedan fuera del alcance del operador, igual que en
  // el menú general y que en las políticas de la base de datos.
  if (rol === "admin_empresa") {
    items.push(
      { href: `${base}/lista-espera`, etiqueta: "Lista de espera", icono: "listaEspera", exacto: true },
      { href: `${base}/metricas`, etiqueta: "Métricas", icono: "metricas", exacto: true }
    );
  }

  // El «!» sale de la misma lista que bloquea el botón de publicar: si se
  // calculara aparte, el menú podría marcar pendiente algo que ya está resuelto.
  const pendientes = new Set(contexto?.pendientes ?? []);
  const RUTA_DE_PENDIENTE: Record<string, string> = {
    categorias: `${base}/categorias`,
    portada: `${base}/imagenes`,
    ubicacion: `${base}/ubicacion`,
  };
  for (const clave of pendientes) {
    const ruta = RUTA_DE_PENDIENTE[clave];
    const item = items.find((i) => i.href === ruta);
    if (item) item.pendiente = true;
  }

  return {
    titulo: "Esta carrera",
    subtitulo: contexto?.nombre,
    contextual: true,
    items,
  };
}

export function navPortal(contadores?: {
  inscripciones?: number;
  sinLeer?: number;
}): SeccionNav[] {
  return [
    {
      items: [
        { href: "/portal", etiqueta: "Perfil e historial", icono: "perfil", exacto: true },
        {
          href: "/portal/inscripciones",
          etiqueta: "Mis inscripciones",
          // Sin `exacto`: la ficha de una inscripción, su kit y su resultado
          // cuelgan de aquí. Con `exacto` el menú se quedaba sin nada marcado
          // en esas tres pantallas, y el corredor perdía la referencia de dónde
          // estaba.
          icono: "eventos",
          contador: contadores?.inscripciones,
        },
        { href: "/portal/acompanantes", etiqueta: "Mis acompañantes", icono: "usuarios" },
        { href: "/portal/certificados", etiqueta: "Certificados", icono: "resultados" },
        {
          href: "/portal/notificaciones",
          etiqueta: "Notificaciones",
          icono: "notificaciones",
          contador: contadores?.sinLeer,
          urgente: true,
        },
      ],
    },
    {
      titulo: "Cuenta",
      items: [
        { href: "/portal/perfil", etiqueta: "Perfil deportivo", icono: "editar" },
        { href: "/portal/cuenta", etiqueta: "Ajustes de cuenta", icono: "configuracion" },
      ],
    },
  ];
}

/** Extrae el id del evento de una ruta del panel, si lo hay. */
export function eventoDeRuta(pathname: string): string | null {
  return pathname.match(/^\/panel\/eventos\/([0-9a-f-]{36})/)?.[1] ?? null;
}
