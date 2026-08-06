import "server-only";
import { construirExcel, type HojaExcel } from "@/lib/excel";
import { ESTADO_PAGO_LABEL, METODO_PAGO_LABEL } from "@/lib/pagos";
import { resumirInscritos } from "./resumenInscritos";
import type { CategoriaInscritos, InscritoFila } from "./inscritos";

const ETIQUETA_SEXO: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
};

/** Las fechas viajan como `Date` para que Excel las trate como tales y se ordenen. */
const fecha = (iso: string | null) => (iso ? new Date(iso) : null);

/**
 * El libro de Excel del informe de inscritos.
 *
 * Dos hojas y no una: la de datos lleva **todas** las columnas —incluidas las
 * que la pantalla no muestra porque la harían ilegible—, y la de resumen repite
 * las cifras de cabecera para que el archivo se explique solo cuando alguien lo
 * reenvíe por correo sin contexto.
 *
 * Las cifras del resumen salen de `resumirInscritos`, la misma función que pinta
 * la pantalla: un Excel que no cuadre con lo que se ve al descargarlo es peor que
 * no tenerlo.
 */
export async function excelDeInscritos(
  filas: InscritoFila[],
  categorias: CategoriaInscritos[],
  opciones: { incluirPagos: boolean; titulo: string; todasLasCarreras: boolean }
): Promise<Uint8Array> {
  const { incluirPagos, todasLasCarreras } = opciones;

  const columnas: HojaExcel["columnas"] = [
    { cabecera: "Dorsal", formato: "numero", ancho: 9 },
    { cabecera: "Nombre", ancho: 28 },
    { cabecera: "Documento", ancho: 16 },
    { cabecera: "Correo", ancho: 30 },
    { cabecera: "Teléfono", ancho: 16 },
    { cabecera: "Acompañante de", ancho: 24 },
    { cabecera: "Género", ancho: 12 },
    { cabecera: "Edad", formato: "numero", ancho: 8 },
    { cabecera: "Ciudad", ancho: 18 },
    ...(todasLasCarreras ? ([{ cabecera: "Carrera", ancho: 28 }] as const) : []),
    { cabecera: "Categoría", ancho: 20 },
    { cabecera: "Distancia (km)", formato: "moneda", ancho: 14 },
    { cabecera: "Talla", ancho: 8 },
    { cabecera: "Club", ancho: 20 },
    { cabecera: "Equipo", ancho: 20 },
    { cabecera: "Inscrito el", formato: "fecha", ancho: 13 },
    ...(incluirPagos
      ? ([
          { cabecera: "Estado del pago", ancho: 16 },
          { cabecera: "Importe", formato: "moneda", ancho: 12 },
          { cabecera: "Moneda", ancho: 9 },
          { cabecera: "Método", ancho: 20 },
          { cabecera: "Referencia", ancho: 18 },
          { cabecera: "Pago confirmado el", formato: "fecha", ancho: 17 },
        ] as const)
      : []),
    { cabecera: "Kit entregado", ancho: 14 },
    { cabecera: "Kit entregado el", formato: "fecha", ancho: 16 },
    { cabecera: "Asistencia", ancho: 12 },
    { cabecera: "Grupo familiar", ancho: 36 },
    { cabecera: "Código QR", ancho: 34 },
  ];

  const datos = filas.map((f) => [
    f.numeroDorsal,
    f.nombre,
    f.documento,
    f.correo,
    f.telefono,
    f.gestionadoPor?.nombre ?? null,
    f.sexo ? (ETIQUETA_SEXO[f.sexo] ?? f.sexo) : null,
    f.edad,
    f.ciudad,
    ...(todasLasCarreras ? [f.evento] : []),
    f.categoria,
    f.distanciaKm,
    f.talla,
    f.club,
    f.equipo,
    fecha(f.creadoEn),
    ...(incluirPagos
      ? [
          f.pago ? ESTADO_PAGO_LABEL[f.pago.estado] : "Sin registrar",
          f.pago?.monto ?? f.precio,
          f.moneda,
          f.pago ? METODO_PAGO_LABEL[f.pago.metodo] : null,
          f.pago?.referencia ?? null,
          fecha(f.pago?.verificadoEn ?? null),
        ]
      : []),
    f.kitEntregado ? "Sí" : "No",
    fecha(f.kitEntregadoEn),
    f.asistenciaConfirmada ? "Sí" : "No",
    f.grupoId,
    f.codigoQr,
  ]);

  const resumen = resumirInscritos(filas, categorias, { incluirDinero: incluirPagos });

  // Hoja de resumen en dos columnas: concepto y cifra. Los repartos van como
  // bloques seguidos, con su encabezado, para que se pueda copiar cualquiera de
  // ellos a un gráfico sin recortar.
  const resumenFilas: unknown[][] = [
    [opciones.titulo, null],
    ["Generado el", new Date().toLocaleString("es-HN")],
    [null, null],
    ["Inscritos", resumen.total],
    ["Cupo total", resumen.cupo ?? "Cupo abierto"],
    ["Kits entregados", resumen.kits.entregados],
    ["Kits pendientes", resumen.kits.pendientes],
    ["Asistencia confirmada", resumen.asistencia.presentes],
  ];

  if (incluirPagos) {
    resumenFilas.push(
      [null, null],
      [`Recaudado (${resumen.dinero.moneda})`, resumen.dinero.recaudado],
      [`En verificación (${resumen.dinero.moneda})`, resumen.dinero.enVerificacion],
      [`Pendiente de cobro (${resumen.dinero.moneda})`, resumen.dinero.pendiente]
    );
  }

  const bloque = (titulo: string, datos: { etiqueta: string; valor: number }[]) => {
    resumenFilas.push([null, null], [titulo, null]);
    for (const d of datos) resumenFilas.push([d.etiqueta, d.valor]);
  };

  bloque(
    "Por categoría",
    resumen.porCategoria.map((c) => ({ etiqueta: c.nombre, valor: c.inscritos }))
  );
  bloque("Por talla", resumen.porTalla);
  bloque("Por género", resumen.porSexo);
  bloque("Por edad el día de la carrera", resumen.porEdad);

  return construirExcel([
    { nombre: "Inscritos", columnas, filas: datos, filtrable: true },
    {
      nombre: "Resumen",
      columnas: [
        { cabecera: "Concepto", ancho: 34 },
        { cabecera: "Valor", ancho: 18 },
      ],
      filas: resumenFilas,
    },
  ]);
}
