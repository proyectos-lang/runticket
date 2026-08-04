import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[1.375rem] font-extrabold tracking-display text-texto">
        Entrar
      </h1>
      <LoginForm next={next} />
    </div>
  );
}
