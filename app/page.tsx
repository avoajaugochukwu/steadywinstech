export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a
            href="#"
            className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.15em] text-ink"
          >
            <span className="inline-block h-3 w-3 bg-signal" aria-hidden="true" />
            STEADY WINS®
          </a>
          <nav className="flex items-center gap-6">
            <a
              href="#catalog"
              className="hidden font-mono text-xs tracking-[0.15em] text-ink/70 hover:text-ink sm:inline"
            >
              APPS
            </a>
            <a
              href="#ethos"
              className="hidden font-mono text-xs tracking-[0.15em] text-ink/70 hover:text-ink sm:inline"
            >
              STUDIO
            </a>
            <a
              href="#"
              className="bg-cobalt px-4 py-2 font-mono text-xs font-bold tracking-[0.15em] text-paper transition-colors hover:bg-deep"
            >
              GET THE APP
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-cobalt text-paper">
          <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-center px-5 py-20 sm:px-8">
            <p className="font-mono text-xs tracking-[0.15em] text-signal">
              STEADY WINS TECHNOLOGIES CORP — EST. SMALL
            </p>
            <h1
              className="mt-6 max-w-4xl font-display font-bold leading-[0.95] tracking-[-0.04em] text-paper"
              style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)" }}
            >
              Apps that hold steady.
            </h1>
            <p className="mt-6 max-w-xl font-body text-lg text-paper/80">
              We build small, single-purpose mobile apps — then keep them
              working. No accounts, no clutter, no surprises.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#"
                className="bg-signal px-6 py-3 font-mono text-sm font-bold tracking-[0.15em] text-ink transition-opacity hover:opacity-90"
              >
                GET EGG TIMER
              </a>
              <a
                href="#catalog"
                className="border border-paper/60 px-6 py-3 font-mono text-sm font-bold tracking-[0.15em] text-paper transition-colors hover:bg-paper/10"
              >
                SEE WHAT&apos;S COMING
              </a>
            </div>

            {/* Signature: the steady line */}
            <div className="mt-16 w-full" aria-hidden="true">
              <svg
                viewBox="0 0 1200 60"
                preserveAspectRatio="none"
                className="h-12 w-full overflow-visible"
                role="presentation"
              >
                <path
                  d="M0 30 L380 30 L400 22 L420 30 L760 30 L780 38 L800 30 L1200 30"
                  fill="none"
                  stroke="var(--signal)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  className="steady-dot"
                  cx="0"
                  cy="30"
                  r="4"
                  fill="var(--signal)"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* Ethos strip */}
        <section id="ethos" className="bg-mist">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:grid-cols-3 sm:px-8">
            <div>
              <p className="font-mono text-xs tracking-[0.15em] text-cobalt">
                ONE JOB
              </p>
              <p className="mt-3 font-body text-base text-ink">
                Each app does a single thing, completely.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.15em] text-cobalt">
                NO ACCOUNTS
              </p>
              <p className="mt-3 font-body text-base text-ink">
                No sign-ups, no tracking, no email required.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.15em] text-cobalt">
                STILL HERE
              </p>
              <p className="mt-3 font-body text-base text-ink">
                We maintain what we ship. Updates, not abandonment.
              </p>
            </div>
          </div>
        </section>

        {/* Catalog */}
        <section id="catalog" className="bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <p className="font-mono text-xs tracking-[0.15em] text-ink/60">
              THE CATALOG
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] text-ink sm:text-5xl">
              Two apps. Both honest.
            </h2>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {/* Egg Timer — LIVE */}
              <article className="border border-l-4 border-ink/15 border-l-cobalt bg-paper p-8">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-3xl font-bold text-ink/30">
                    01
                  </span>
                  <span className="inline-flex items-center gap-2 border border-ink/15 px-3 py-1 font-mono text-xs tracking-[0.15em] text-ink">
                    <span className="inline-block h-2 w-2 rounded-full bg-signal" />
                    LIVE
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
                  Egg Timer
                </h3>
                <p className="mt-3 font-body text-base text-ink/70">
                  A precise timer for eggs exactly how you like them. Soft,
                  medium, hard — pick once, tap, done.
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <a
                    href="#"
                    className="border border-ink px-5 py-2 font-mono text-xs font-bold tracking-[0.15em] text-ink transition-colors hover:border-cobalt hover:bg-cobalt hover:text-paper"
                  >
                    APP STORE
                  </a>
                  <a
                    href="#"
                    className="border border-ink px-5 py-2 font-mono text-xs font-bold tracking-[0.15em] text-ink transition-colors hover:border-cobalt hover:bg-cobalt hover:text-paper"
                  >
                    GOOGLE PLAY
                  </a>
                </div>
              </article>

              {/* White Noise — SOON */}
              <article className="border border-ink/15 bg-paper p-8">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-3xl font-bold text-ink/30">
                    02
                  </span>
                  <span className="inline-flex items-center gap-2 border border-ink/30 px-3 py-1 font-mono text-xs tracking-[0.15em] text-ink/60">
                    <span className="inline-block h-2 w-2 rounded-full border border-ink/40" />
                    SOON
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
                  White Noise
                </h3>
                <p className="mt-3 font-body text-base text-ink/70">
                  Steady, high-quality sound for sleep and focus. Simple
                  controls, nothing to configure.
                </p>
                <p className="mt-6 font-mono text-xs tracking-[0.15em] text-ink/60">
                  SHIPPING — Q3 2026
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="bg-cobalt">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-20 text-center sm:px-8">
            <h2 className="max-w-2xl font-display text-4xl font-bold tracking-[-0.03em] text-paper sm:text-5xl">
              Start with one good app.
            </h2>
            <a
              href="#"
              className="mt-8 bg-signal px-6 py-3 font-mono text-sm font-bold tracking-[0.15em] text-ink transition-opacity hover:opacity-90"
            >
              GET EGG TIMER
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.15em]">
            <span className="inline-block h-3 w-3 bg-signal" aria-hidden="true" />
            STEADY WINS®
          </div>
          <p className="font-mono text-xs tracking-[0.15em] text-paper/60">
            © 2026 STEADY WINS TECHNOLOGIES CORPORATION
          </p>
          <nav className="flex gap-6 font-mono text-xs tracking-[0.15em] text-paper/80">
            <a href="#" className="hover:text-signal">
              Contact
            </a>
            <a href="#" className="hover:text-signal">
              Privacy
            </a>
            <a href="#" className="hover:text-signal">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
