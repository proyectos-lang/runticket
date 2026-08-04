"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CLASE_CAMPO } from "@/components/ui/Campo";

export function BuscadorUsuarios() {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  return (
    <input
      type="search"
      defaultValue={params.get("q") ?? ""}
      placeholder="Buscar por nombre o correo"
      aria-label="Buscar usuarios"
      onChange={(e) => {
        const q = new URLSearchParams(params.toString());
        if (e.target.value) q.set("q", e.target.value);
        else q.delete("q");
        startTransition(() => router.push(`/admin/usuarios?${q.toString()}`));
      }}
      className={`${CLASE_CAMPO} w-full max-w-sm ${pendiente ? "opacity-60" : ""}`}
    />
  );
}
