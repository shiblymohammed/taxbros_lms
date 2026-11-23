import Image from 'next/image';
import { BookOpen, CalendarCheck, FlaskConical } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: BookOpen, title: 'Video courses', text: 'Lessons, progress tracking and quizzes in one place.' },
  { icon: CalendarCheck, title: 'Daily attendance', text: 'Class registers and staff attendance with monthly reports.' },
  { icon: FlaskConical, title: 'Practice labs', text: 'Safe GST, income tax and MCA filing simulations.' },
];

function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? 'flex flex-col items-center text-center' : 'flex items-center gap-3'}>
      <Image
        src="/logo-mark.webp"
        unoptimized
        alt=""
        width={large ? 72 : 44}
        height={large ? 65 : 40}
        priority
        className={large ? 'h-16 w-auto' : 'h-10 w-auto'}
      />
      <span className={large ? 'mt-3' : ''}>
        <span className={`block font-display font-extrabold tracking-wide text-white ${large ? 'text-3xl' : 'text-xl'}`}>TAXBROS</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.3em] text-white/70">by Acharya Institute</span>
      </span>
    </div>
  );
}

/** Sign-in and password screens: teal brand panel (top on phones, left on desktop) with the form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b3b47] via-brand-strong to-brand px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full border-[40px] border-white/5" aria-hidden="true" />

        <div className="relative">
          <Brand />
        </div>

        <div className="relative max-w-md">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-soft">Professional Accounting Learning Platform</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight">
            Learn. Practice.
            <br />
            Master Taxation.
          </h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">© TAXBROS · Acharya Institute</p>
      </aside>

      <main className="flex min-h-screen flex-col bg-canvas lg:items-center lg:justify-center lg:px-8 lg:py-10">
        {/* Phones and tablets: splash header from the mobile design */}
        <div className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-[#0b3b47] via-brand-strong to-brand px-6 pb-20 pt-12 text-white lg:hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative">
            <Brand large />
            <p className="mt-6 text-center text-lg leading-snug text-white/90">
              Learn. Practice.
              <br />
              Master Taxation.
            </p>
          </div>
        </div>
        <div className="relative z-10 -mt-12 flex flex-1 justify-center px-4 pb-10 lg:mt-0 lg:flex-none lg:px-0 lg:pb-0">{children}</div>
      </main>
    </div>
  );
}
