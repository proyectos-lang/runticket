import { ActualizarPasswordForm } from "./ActualizarPasswordForm";
import { tokenCsrf } from "@/lib/csrf";

export default async function ActualizarPasswordPage() {
  const csrf = await tokenCsrf();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[1.375rem] font-extrabold tracking-display text-texto">
        Elige una nueva contraseña
      </h1>
      <ActualizarPasswordForm csrf={csrf} />
    </div>
  );
}
