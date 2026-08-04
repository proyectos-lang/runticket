import { MarcaVertical } from "@/components/publico/MarcaVertical";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <MarcaVertical />
      {children}
    </main>
  );
}
