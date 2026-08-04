import { RegistroForm } from "./RegistroForm";

export default function RegistroPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-[1.375rem] font-extrabold tracking-display text-texto">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-atenuado">
          Podrás completar tu perfil de corredor al inscribirte a tu primera carrera.
        </p>
      </div>
      <RegistroForm />
    </div>
  );
}
