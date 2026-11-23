import { AppShell } from '@/components/app-shell';
import { STUDENT_NAV } from '@/lib/navigation';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell roleLabel="Student" nav={STUDENT_NAV} roles={['STUDENT']}>
      {children}
    </AppShell>
  );
}
