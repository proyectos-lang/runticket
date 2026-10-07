import { RecuperarForm } from "./RecuperarForm";
import { tokenCsrf } from "@/lib/csrf";

export default async function RecuperarPasswordPage() {
  const csrf = await tokenCsrf();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[1.375rem] font-extrabold tracking-display text-texto">
        Recupera tu contraseña
      </h1>
      <RecuperarForm csrf={csrf} />
    </div>
  );
}
