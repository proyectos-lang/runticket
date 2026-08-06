import { RANGOS_EDAD } from "@/lib/edades";
import type { CategoriaInscritos, InscritoFila } from "./inscritos";

export type Reparto = { etiqueta: string; valor: number };

export type ResumenInscritos = {
  total: number;
  /** Suma de cupos de las categorías presentes; null si alguna es abierta. */
  cupo: number | null;
  porCategoria: { nombre: string; inscritos: number; cupo: number | null }[];
  dinero: {
    recaudado: number;
    enVerificacion: number;
    pendiente: number;
    moneda: string;
  };
  kits: { entregados: number; pendientes: number; porcentaje: number };
  asistencia: { presentes: number };
  porTalla: Reparto[];
  porSexo: Reparto[];
  porEdad: Reparto[];
};

const ETIQUETA_SEXO: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
};

/** Cuenta ocurrencias conservando un orden dado, y deja «Sin dato» al final. */
function repartir(
  valores: (string | null)[],
  orden?: readonly string[],
  etiquetas?: Record<string, string>
): Reparto[] {
  const cuenta = new Map<string, number>();
  for (const v of valores) {
    const clave = v ?? "Sin dato";
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  const entradas = [...cuenta.entries()].map(([clave, valor]) => ({
    etiqueta: etiquetas?.[clave] ?? clave,
    clave,
    valor,
  }));

  entradas.sort((a, b) => {
    if (a.clave === "Sin dato") return 1;
    if (b.clave === "Sin dato") return -1;
    if (orden) {
      // Lo que no está en el orden declarado va detrás de lo que sí.
      const ia = orden.indexOf(a.clave);
      const ib = orden.indexOf(b.clave);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }
    return b.valor - a.valor;
  });

  return entradas.map(({ etiqueta, valor }) => ({ etiqueta, valor }));
}

/**
 * Las cifras de cabecera del informe.
 *
 * Se calculan **sobre las filas ya filtradas**, no con una consulta aparte. Es
 * deliberado: si el resumen viniera de su propia agregación, filtrar por «talla
 * M» dejaría un encabezado hablando de toda la carrera encima de una tabla que
 * habla de otra cosa, y quien lo lea de pasada se llevará la cifra equivocada.
 *
 * Vive fuera de la pantalla porque lo usan dos consumidores: el informe y la
 * hoja «Resumen» del Excel, que tienen que decir exactamente lo mismo.
 */
export function resumirInscritos(
  filas: InscritoFila[],
  categorias: CategoriaInscritos[],
  opciones: { incluirDinero?: boolean } = {}
): ResumenInscritos {
  const total = filas.length;

  // Solo las categorías que de verdad aparecen: sumar el cupo de una categoría
  // vacía inflaría el denominador y la ocupación saldría siempre baja.
  const presentes = [...new Set(filas.map((f) => f.categoriaId))];
  const porCategoria = presentes
    .map((id) => {
      const cat = categorias.find((c) => c.id === id);
      return {
        nombre: cat?.nombre ?? "Sin categoría",
        inscritos: filas.filter((f) => f.categoriaId === id).length,
        cupo: cat?.cupoMaximo ?? null,
      };
    })
    .sort((a, b) => b.inscritos - a.inscritos);

  // Con una sola categoría de cupo abierto, el total deja de ser una cifra
  // honesta y se prefiere no dar ninguna.
  const cupo = porCategoria.some((c) => c.cupo === null)
    ? null
    : porCategoria.reduce((a, c) => a + (c.cupo ?? 0), 0);

  // Lo cobrado manda sobre el precio de la inscripción: pueden diferir si el
  // organizador registró otro importe al conciliar.
  const importe = (f: InscritoFila) => (f.pago ? f.pago.monto : f.precio);
  const sumar = (predicado: (f: InscritoFila) => boolean) =>
    filas.filter(predicado).reduce((a, f) => a + importe(f), 0);

  const entregados = filas.filter((f) => f.kitEntregado).length;

  return {
    total,
    cupo,
    porCategoria,
    dinero: {
      recaudado: opciones.incluirDinero ? sumar((f) => f.pago?.estado === "pagado") : 0,
      enVerificacion: opciones.incluirDinero
        ? sumar((f) => f.pago?.estado === "en_verificacion")
        : 0,
      // Todo lo que no está cobrado ni en revisión sigue debiéndose, tenga o no
      // un intento de pago registrado.
      pendiente: opciones.incluirDinero
        ? sumar((f) => f.pago?.estado !== "pagado" && f.pago?.estado !== "en_verificacion")
        : 0,
      moneda: filas[0]?.moneda ?? "HNL",
    },
    kits: {
      entregados,
      pendientes: total - entregados,
      porcentaje: total ? Math.round((entregados / total) * 100) : 0,
    },
    asistencia: { presentes: filas.filter((f) => f.asistenciaConfirmada).length },
    porTalla: repartir(
      filas.map((f) => f.talla),
      ["XS", "S", "M", "L", "XL", "XXL"]
    ),
    porSexo: repartir(
      filas.map((f) => f.sexo),
      undefined,
      ETIQUETA_SEXO
    ),
    porEdad: repartir(
      filas.map((f) => f.rangoEdad),
      RANGOS_EDAD
    ),
  };
}
