import { AdminAuthProvider } from "@/components/admin/auth-context";
import { AdminShell } from "@/components/admin/shell";

export const metadata = {
  title: "Админ-панель",
  // Админка не должна попадать в поисковую выдачу
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
