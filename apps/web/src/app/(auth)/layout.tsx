import Image from 'next/image';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo-mark.webp"
        unoptimized
        alt=""
        width={44}
        height={40}
        priority
        className={compact ? 'h-9 w-auto' : 'h-10 w-auto'}
      />
      <span className="leading-tight">
        <span className="block font-display text-xl font-extrabold tracking-wide text-white">TAXBROS</span>
        <span className="block text-xs text-white/65">by Acharya Institute</span>
      </span>
    </div>
  );
}

const SLIP_ROWS = [
  { label: 'Outward taxable supplies', value: '4,82,000' },
  { label: 'Integrated tax', value: '86,760' },
  { label: 'Input tax credit claimed', value: '61,240' },
  { label: 'Net tax payable', value: '25,520', total: true },
];

/** A practice GST return, drawn as a paper slip: the one illustrative element on the sign-in screens. */
function FilingSlip() {
  return (
    <figure
      aria-hidden="true"
      className="relative w-full max-w-sm rounded-md bg-white px-6 pb-6 pt-5 text-slate-800 shadow-[0_18px_40px_-12px_rgba(3,25,31,0.55)] motion-safe:animate-[slip-in_700ms_cubic-bezier(0.2,0.8,0.2,1)_200ms_both]"
    >
      <div className="flex items-baseline justify-between border-b border-dashed border-slate-300 pb-3">
        <span className="font-display text-base font-bold text-brand-strong">GSTR-3B</span>
        <span className="text-xs text-slate-500">Practice lab, October</span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        {SLIP_ROWS.map((row) => (
          <div
            key={row.label}
            className={`flex justify-between gap-4 ${row.total ? 'mt-3 border-t border-slate-200 pt-3 font-semibold text-slate-900' : ''}`}
          >
            <dt>{row.label}</dt>
            <dd className="tabular-nums">₹{row.value}</dd>
          </div>
        ))}
      </dl>
      <span className="absolute -right-4 -top-4 rotate-[8deg] rounded-sm border-2 border-flame bg-white px-2.5 py-1 font-display text-sm font-extrabold text-flame">
        Filed
      </span>
    </figure>
  );
}

/** Headline set on ledger rules: each line sits on its own hairline. */
function LedgerHeadline() {
  return (
    <h2 className="font-display text-5xl font-extrabold leading-none tracking-tight text-white 2xl:text-6xl">
      {['Learn.', 'Practice.', 'Master taxation.'].map((line) => (
        <span key={line} className="block border-b border-white/15 pb-3 pt-4">
          {line}
        </span>
      ))}
    </h2>
  );
}

/** Sign-in and password screens: ledger brand panel (desktop) or compact header (phones) beside the form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:bg-white">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-12 py-12 text-white lg:flex xl:px-16">
        {/* Faint ledger ruling across the whole panel */}
        <div
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_39px,rgba(255,255,255,0.04)_39px,rgba(255,255,255,0.04)_40px)]"
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-y-0 left-8 w-px bg-flame/25 xl:left-12" aria-hidden="true" />

        <div className="relative">
          <Brand />
        </div>

        <div className="relative max-w-xl">
          <LedgerHeadline />
          <p className="mt-6 max-w-sm text-base leading-relaxed text-white/75">
            Video courses, daily attendance and hands-on GST, income tax and MCA filing practice, all in one place.
          </p>
        </div>

        <div className="relative pr-4">
          <FilingSlip />
        </div>
      </aside>

      <main className="flex min-h-screen flex-col lg:justify-center lg:px-12 xl:px-20">
        {/* Phones and tablets: compact brand header */}
        <div className="bg-sidebar px-6 pb-20 pt-10 text-white lg:hidden">
          <Brand compact />
          <p className="mt-8 font-display text-3xl font-extrabold leading-tight tracking-tight">
            Learn. Practice.
            <br />
            Master taxation.
          </p>
        </div>
        <div className="relative z-10 -mt-12 flex flex-1 justify-center px-4 pb-10 lg:mt-0 lg:flex-none lg:justify-start lg:px-0 lg:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
