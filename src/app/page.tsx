import Link from "next/link";
import { AppShell, LogoTitle, PrimaryButton } from "@/components/ui";

export default function HomePage() {
  return (
    <AppShell>
      <LogoTitle subtitle="Juega en vivo con tu equipo" />

      <div className="rounded-[2rem] bg-white/10 p-8 text-center shadow-xl backdrop-blur-sm">
        <p className="text-lg font-semibold leading-relaxed text-white/90">
          Crea preguntas, comparte un link y controla la trivia en tiempo real
          desde tu móvil.
        </p>
      </div>

      <div className="space-y-3">
        <Link href="/admin">
          <PrimaryButton>Crear trivia como admin</PrimaryButton>
        </Link>
        <p className="text-center text-sm text-white/70">
          ¿Tienes un código? Pide el link a tu anfitrión.
        </p>
      </div>
    </AppShell>
  );
}
