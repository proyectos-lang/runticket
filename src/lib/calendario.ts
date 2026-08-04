type DatosCalendario = {
  titulo: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  inicio: string | Date;
  /** Sin hora de fin en el modelo, se asume una ventana de 4 horas. */
  horasDuracion?: number;
};

function rango({ inicio, horasDuracion = 4 }: DatosCalendario) {
  const desde = new Date(inicio);
  const hasta = new Date(desde.getTime() + horasDuracion * 60 * 60 * 1000);
  return { desde, hasta };
}

const compacto = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function enlaceGoogleCalendar(datos: DatosCalendario): string {
  const { desde, hasta } = rango(datos);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: datos.titulo,
    dates: `${compacto(desde)}/${compacto(hasta)}`,
  });
  if (datos.descripcion) params.set("details", datos.descripcion);
  if (datos.ubicacion) params.set("location", datos.ubicacion);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function enlaceOutlook(datos: DatosCalendario): string {
  const { desde, hasta } = rango(datos);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: datos.titulo,
    startdt: desde.toISOString(),
    enddt: hasta.toISOString(),
  });
  if (datos.descripcion) params.set("body", datos.descripcion);
  if (datos.ubicacion) params.set("location", datos.ubicacion);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
