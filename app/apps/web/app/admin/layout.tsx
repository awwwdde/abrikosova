import { AdminAuthProvider } from "@/components/admin/auth-context";
import { AdminShell } from "@/components/admin/shell";

export const metadata = {
  title: "Админ-панель",
  // Админка не должна попадать в поисковую выдачу
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // admin-scope — шкала отступов и кеглей в px, независимо от размера шрифта
    // браузера по умолчанию (globals.css, 011g)
    <div className="admin-scope">
      <AdminAuthProvider>
        <AdminShell>{children}</AdminShell>
      </AdminAuthProvider>
    </div>
  );
}
