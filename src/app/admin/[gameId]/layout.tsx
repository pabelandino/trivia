import { Suspense } from "react";
import AdminGamePage from "./page";

export default function AdminGamePageWrapper({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#1B44E8] to-[#7B2CBF] text-white">
          Cargando...
        </div>
      }
    >
      <AdminGamePage params={params} />
    </Suspense>
  );
}
