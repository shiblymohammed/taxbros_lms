import { AppShell } from '@/components/app-shell';
import { ADMIN_NAV } from '@/lib/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell roleLabel="Administrator" nav={ADMIN_NAV} roles={['ADMINISTRATOR', 'SUPER_ADMIN', 'STAFF']} staffByPermission>
      {children}
    </AppShell>
  );
}
