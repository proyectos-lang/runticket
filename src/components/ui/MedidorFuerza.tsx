"use client";

/**
 * Tres segmentos que estiman la fuerza de la contraseña.
 *
 * El criterio es deliberadamente simple y explicable —longitud y variedad de
 * caracteres—, no una librería de entropía: el medidor orienta, y quien decide
 * si la contraseña vale es la validación del servidor.
 */
export function fuerzaDeContrasena(valor: string): 0 | 1 | 2 | 3 {
  if (!valor) return 0;
  let puntos = 0;
  if (valor.length >= 8) puntos++;
  if (valor.length >= 12) puntos++;
  if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos++;
  if (/\d/.test(valor)) puntos++;
  if (/[^A-Za-z0-9]/.test(valor)) puntos++;
  // Cinco criterios comprimidos a tres tramos.
  return Math.min(3, Math.ceil(puntos * 0.6)) as 0 | 1 | 2 | 3;
}

const NOTAS = [
  "Mínimo 8 caracteres",
  "Débil: añade mayúsculas, números o símbolos",
  "Aceptable",
  "Segura",
];

export function MedidorFuerza({ valor }: { valor: string }) {
  const nivel = fuerzaDeContrasena(valor);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-[0.1875rem] flex-1 rounded-full transition-colors ${
              i < nivel ? "bg-naranja" : "bg-linea-fuerte"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-xs ${nivel === 1 ? "text-naranja-suave" : "text-mudo"}`}
        // Solo se anuncia el cambio de nivel, no cada pulsación de tecla.
        aria-live="polite"
      >
        {NOTAS[nivel]}
      </p>
    </div>
  );
}
