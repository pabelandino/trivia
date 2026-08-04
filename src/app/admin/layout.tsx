import { AdminAccessGate } from "@/components/AdminAccessGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
