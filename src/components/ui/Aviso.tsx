export type TonoAviso = "azul" | "ambar" | "rojo" | "cian" | "verde";

/**
 * Caja de mensaje.
 *
 * Existe porque estas cajas estaban improvisadas en once pantallas con valores
 * de alfa ligeramente distintos en cada una. El tono dice qué es el mensaje,
 * no de qué color pintarlo:
 *
 *   azul  → información que ayuda a entender (cómo se calcula la categoría)
 *   ambar → algo que falta y bloquea (perfil incompleto, evento sin publicar)
 *   rojo  → algo que salió mal (credenciales, enlace caducado)
 *   cian  → confirmación o dato destacado (revisa tu correo, cupo agotado)
 *   verde → **solo** «el organizador confirmó tu pago»
 */
const TONOS: Record<TonoAviso, string> = {
  azul: "border-azul/28 bg-azul/8 text-azul-aviso",
  ambar: "border-amber-500/38 bg-amber-500/9 text-ambar",
  rojo: "border-red-500/40 bg-red-500/10 text-rojo",
  cian: "border-cian/30 bg-cian/7 text-cian",
  verde: "border-emerald-500/34 bg-emerald-500/8 text-verde",
};

export function Aviso({
  tono = "azul",
  titulo,
  children,
  accion,
  className = "",
}: {
  tono?: TonoAviso;
  titulo?: React.ReactNode;
  children?: React.ReactNode;
  /** Bloque alineado a la derecha: normalmente un botón o un enlace. */
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tono === "rojo" ? "alert" : undefined}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3.5 ${TONOS[tono]} ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {titulo && <p className="text-sm font-bold">{titulo}</p>}
        {children && <div className="text-[0.78125rem] leading-relaxed">{children}</div>}
      </div>
      {accion}
    </div>
  );
}
