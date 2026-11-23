import { AppShell } from '@/components/layout/app-shell';
import { STUDENT_NAV } from '@/config/navigation';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell roleLabel="Student" nav={STUDENT_NAV} roles={['STUDENT']}>
      {children}
    </AppShell>
  );
}
