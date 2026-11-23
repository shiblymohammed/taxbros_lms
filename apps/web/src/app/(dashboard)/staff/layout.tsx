import { AppShell } from '@/components/layout/app-shell';
import { ADMIN_NAV, STAFF_NAV } from '@/config/navigation';

// Administrators also mark registers here, so they keep their own navigation
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      roleLabel="Staff"
      nav={STAFF_NAV}
      adminNav={ADMIN_NAV}
      roles={['STAFF', 'ADMINISTRATOR', 'SUPER_ADMIN']}
    >
      {children}
    </AppShell>
  );
}
