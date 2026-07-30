import { useEffect, useRef, useState } from "react";

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) { setShow(true); obs.disconnect(); }
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Cycling headline text ────────────────────────────────────────────────────

const BIZ_TYPES = [
  "Provision Stores",
  "Restaurants & Food",
  "Car Washes",
  "Salons & Spas",
  "Laundry Services",
  "Wholesale",
  "Fashion Boutiques",
  "Corporate Offices",
];

function CyclingText() {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % BIZ_TYPES.length);
        setFading(false);
      }, 280);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      style={{
        color: "var(--color-brand)",
        opacity: fading ? 0 : 1,
        transform: fading ? "translateY(-8px)" : "translateY(0)",
        transition: "opacity 0.28s ease, transform 0.28s ease",
        display: "inline-block",
      }}
    >
      {BIZ_TYPES[idx]}
    </span>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  {
    icon: "🛒",
    name: "Provision Stores",
    desc: "Track stock, credit sales, and daily profit from any device.",
  },
  {
    icon: "🍽️",
    name: "Restaurants & Food",
    desc: "Fast orders, split bills, and WhatsApp receipt sharing.",
  },
  {
    icon: "🚗",
    name: "Car Wash",
    desc: "Job tickets, staff shifts, and daily cash reconciliation.",
  },
  {
    icon: "👗",
    name: "Fashion & Boutique",
    desc: "Product variants, customer accounts, and sales history.",
  },
  {
    icon: "🧺",
    name: "Laundry Services",
    desc: "Customer order tracking, pickup records, and payments.",
  },
  {
    icon: "💇",
    name: "Salons & Spas",
    desc: "Service logs, staff commissions, and retail product sales.",
  },
  {
    icon: "📦",
    name: "Wholesale & Distribution",
    desc: "Bulk pricing, supplier ledger, and multi-branch inventory.",
  },
  {
    icon: "🏢",
    name: "Corporate & Offices",
    desc: "Expense tracking, salary payments, and management reports.",
  },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Lightning Checkout",
    body: "Tap products, accept Cash or MoMo, print or share receipts on WhatsApp in seconds.",
  },
  {
    icon: "📊",
    title: "Live P&L Dashboard",
    body: "Revenue, cost of goods, expenses, and net profit — updated with every sale.",
  },
  {
    icon: "📦",
    title: "Smart Inventory",
    body: "Real-time stock levels, low-stock alerts, and a full movement audit trail.",
  },
  {
    icon: "👥",
    title: "Customer Credit",
    body: "Per-customer credit limits, ledgers, and one-tap payment recording.",
  },
  {
    icon: "🚚",
    title: "Supplier Ledger",
    body: "Log what you owe suppliers and track every payment you make.",
  },
  {
    icon: "🔐",
    title: "Multi-Staff & Shifts",
    body: "PIN login for cashiers, password for managers. Shift reconciliation built in.",
  },
  {
    icon: "🌿",
    title: "Multi-Branch",
    body: "One login for all your locations. Compare revenue across branches.",
  },
  {
    icon: "📋",
    title: "Reports & Exports",
    body: "Z-reports, staff performance, top products, and full CSV data export.",
  },
];

// ─── Hero mockup ──────────────────────────────────────────────────────────────

function HeroMockup() {
  return (
    <div
      style={{
        transform: "perspective(900px) rotateY(-10deg) rotateX(5deg)",
        transformStyle: "preserve-3d",
        filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.12))",
      }}
      className="w-full max-w-xs select-none pointer-events-none"
    >
      {/* Dashboard card */}
      <div className="bg-paper border border-line p-4 mb-[-10px] relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted">Today's Revenue</span>
          <span className="flex items-center gap-1 text-[9px] text-brand font-semibold">
            <span className="w-1 h-1 rounded-full bg-brand" style={{ animation: "pulse 2s infinite" }} />
            LIVE
          </span>
        </div>
        <div className="text-[22px] font-bold text-ink leading-none mb-0.5">GH₵ 4,820.00</div>
        <div className="text-[9px] text-brand mb-3">↑ 18% vs yesterday</div>
        <div className="flex items-end gap-[2px] h-8 mb-3">
          {[28, 52, 38, 68, 44, 82, 58, 92, 72, 100, 78, 62].map((h, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ height: `${h}%`, background: "var(--color-brand)", opacity: 0.65 + i * 0.02 }}
            />
          ))}
        </div>
        <div className="flex gap-3 text-[9px] text-muted">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-brand inline-block rounded-sm" />Cash 61%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-ink inline-block rounded-sm" />MoMo 31%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-warn inline-block rounded-sm" />Credit 8%
          </span>
        </div>
      </div>

      {/* Receipt card */}
      <div className="bg-paper border border-line p-3 ml-8 relative z-0">
        <div className="font-bold text-center text-[9px] mb-2 tracking-widest">RECEIPT · #1,042</div>
        <div className="space-y-1 border-b border-line pb-2 mb-2">
          {[
            ["Nescafé (3×)", "GH₵ 15.00"],
            ["Milo 500g", "GH₵ 45.00"],
            ["Sugar 1kg", "GH₵ 8.00"],
          ].map(([name, price]) => (
            <div key={name} className="flex justify-between text-[9px]">
              <span className="text-muted">{name}</span>
              <span className="font-mono">{price}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-bold">
          <span>Total</span>
          <span style={{ color: "var(--color-brand)" }}>GH₵ 68.00</span>
        </div>
        <div className="text-center text-[8px] text-muted mt-1.5">Cash ✓ · Change: GH₵ 2.00</div>
      </div>
    </div>
  );
}

// ─── Sticky navigation ────────────────────────────────────────────────────────

function Nav({
  onSignup,
  onLogin,
}: {
  onSignup: () => void;
  onLogin: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 transition-all duration-200"
      style={{
        background: scrolled ? "rgba(255,255,255,0.96)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--color-line)" : "1px solid transparent",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-brand" />
        <span className="text-base font-bold tracking-tight text-ink">GhPOS</span>
      </div>

      <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
        <a href="#features" className="hover:text-ink transition-colors">Features</a>
        <a href="#industries" className="hover:text-ink transition-colors">Industries</a>
        <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
      </nav>

      <div className="flex items-center gap-3">
        <button onClick={onLogin} className="text-sm text-muted hover:text-ink transition-colors">
          Sign in
        </button>
        <button
          onClick={onSignup}
          className="px-4 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-85 transition-opacity"
        >
          Free trial
        </button>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-line" style={{ minHeight: "88vh", display: "flex", alignItems: "center" }}>
      {/* Subtle radial gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 15% 60%, rgba(26,107,53,0.05) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 85% 15%, rgba(26,107,53,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div>
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 border border-line bg-field px-3 py-1 text-xs font-medium text-muted mb-6"
            style={{ opacity: 1 }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-brand"
              style={{ animation: "pulse 2s ease-in-out infinite" }}
            />
            30-day free trial · No credit card required
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.12] tracking-tight text-ink mb-5">
            The POS built for
            <br />
            <CyclingText />
          </h1>

          <p className="text-base text-muted leading-relaxed max-w-md mb-8">
            GhPOS gives Ghanaian businesses fast checkout, live profit reports,
            stock control, customer credit, and shift management — in one clean system.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={onSignup}
              className="px-6 py-3 bg-ink text-paper font-semibold text-sm hover:opacity-85 transition-opacity"
            >
              Start your free trial →
            </button>
            <a
              href="#features"
              className="px-6 py-3 border border-line text-sm font-medium text-ink hover:bg-field transition-colors"
            >
              See all features
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-muted">
            {["No setup fee", "Works on any phone or tablet", "Cancel anytime"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="text-brand font-bold">✓</span> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right — visual */}
        <div className="hidden lg:flex justify-center items-center">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

// ─── Industries ───────────────────────────────────────────────────────────────

function IndustriesSection() {
  return (
    <section id="industries" className="py-16 px-6 border-b border-line">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Industries</p>
          <h2 className="text-2xl font-bold text-ink">One system. Every Ghanaian business.</h2>
          <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
            From a single-chair salon to a multi-branch wholesale company — GhPOS adapts to how you work.
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {INDUSTRIES.map((ind, i) => (
            <FadeIn key={ind.name} delay={i * 45}>
              <div
                className="border border-line p-4 transition-all duration-200"
                style={{
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-brand)";
                  (e.currentTarget as HTMLDivElement).style.background = "var(--color-field)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-line)";
                  (e.currentTarget as HTMLDivElement).style.background = "";
                }}
              >
                <div className="text-2xl mb-2">{ind.icon}</div>
                <div className="font-semibold text-sm text-ink mb-1">{ind.name}</div>
                <div className="text-xs text-muted leading-relaxed">{ind.desc}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section id="features" className="py-16 px-6 border-b border-line bg-field">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Features</p>
          <h2 className="text-2xl font-bold text-ink">Everything to run your business</h2>
          <p className="text-sm text-muted mt-2">
            Built for Ghana — MoMo payments, WhatsApp receipts, offline mode.
          </p>
        </FadeIn>

        {/* Grid with hairline borders */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 35}>
              <div
                className="bg-paper p-5 h-full transition-colors duration-200"
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--color-field)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--color-paper)"; }}
              >
                <div className="text-xl mb-3">{f.icon}</div>
                <div className="font-semibold text-sm text-ink mb-1.5">{f.title}</div>
                <div className="text-xs text-muted leading-relaxed">{f.body}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create your account",
      body: "Sign up in 2 minutes. Name your shop, set up a branch, and you're ready to go.",
    },
    {
      n: "02",
      title: "Add your products",
      body: "Import from CSV or add items one by one. Set prices, costs, and opening stock.",
    },
    {
      n: "03",
      title: "Start selling",
      body: "Checkout in seconds, accept Cash or MoMo, and watch your profit update in real-time.",
    },
  ];

  return (
    <section className="py-16 px-6 border-b border-line">
      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Getting started</p>
          <h2 className="text-2xl font-bold text-ink">Up and running in 5 minutes</h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 border border-line divide-y md:divide-y-0 md:divide-x divide-line">
          {steps.map((s, i) => (
            <FadeIn key={s.n} delay={i * 100}>
              <div className="p-8">
                <div
                  className="text-5xl font-black mb-4 leading-none"
                  style={{ color: "transparent", WebkitTextStroke: "1.5px var(--color-line)" }}
                >
                  {s.n}
                </div>
                <div className="font-semibold text-sm text-ink mb-2">{s.title}</div>
                <div className="text-xs text-muted leading-relaxed">{s.body}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip() {
  const stats = [
    { val: "500+", label: "Businesses" },
    { val: "1M+", label: "Transactions" },
    { val: "GH₵ 50M+", label: "Processed" },
    { val: "8", label: "Business types" },
  ];

  return (
    <FadeIn>
      <section className="border-b border-line py-10 px-6 bg-ink">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-paper mb-0.5">{s.val}</div>
              <div className="text-[10px] text-paper/40 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const quotes = [
    {
      body: "Before GhPOS I never knew if I was making profit or loss. Now I can see everything at the end of every day.",
      name: "Abena K.",
      biz: "Provision store · Kumasi",
    },
    {
      body: "My customers love getting their receipt on WhatsApp. And I can track all credit accounts without any stress.",
      name: "Kofi A.",
      biz: "Wholesale · Accra",
    },
    {
      body: "Managing three branches was a nightmare. GhPOS lets me check each one from my phone anywhere.",
      name: "Maame D.",
      biz: "Fashion boutique · Takoradi",
    },
  ];

  return (
    <section className="py-16 px-6 bg-field border-b border-line">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Testimonials</p>
          <h2 className="text-2xl font-bold text-ink">Trusted by businesses across Ghana</h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-4">
          {quotes.map((q, i) => (
            <FadeIn key={q.name} delay={i * 80}>
              <div className="bg-paper border border-line p-6 h-full flex flex-col">
                <div className="text-brand text-2xl font-serif leading-none mb-3">"</div>
                <p className="text-sm text-ink leading-relaxed flex-1 mb-4">{q.body}</p>
                <div>
                  <div className="font-semibold text-sm text-ink">{q.name}</div>
                  <div className="text-xs text-muted">{q.biz}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function PricingSection({ onSignup }: { onSignup: () => void }) {
  const included = [
    "Unlimited sales, products & receipts",
    "Multi-cashier with PIN login",
    "Customer credit & supplier ledger",
    "Stock take & low-stock alerts",
    "P&L reports, Z-reports & CSV export",
    "WhatsApp receipt sharing",
    "Multi-branch support",
    "Shift management & reconciliation",
    "Salary & expense tracking",
    "Sales history & audit trail",
  ];

  return (
    <section id="pricing" className="py-16 px-6 border-b border-line">
      <div className="max-w-md mx-auto">
        <FadeIn className="text-center mb-8">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Pricing</p>
          <h2 className="text-2xl font-bold text-ink">Simple, honest pricing</h2>
          <p className="text-sm text-muted mt-2">Try every feature free for 30 days. No credit card needed.</p>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="border-2 border-ink p-7">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-ink">GH₵ 99</span>
              <span className="text-muted text-sm">/month</span>
            </div>
            <p className="text-xs text-muted mb-6">after your 30-day free trial</p>

            <ul className="space-y-2.5 mb-7">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span className="text-brand font-bold shrink-0 mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={onSignup}
              className="w-full py-3 bg-ink text-paper font-bold text-sm hover:opacity-85 transition-opacity"
            >
              Start 30-day free trial
            </button>
            <p className="text-xs text-muted text-center mt-3">Cancel anytime. No contracts.</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CtaSection({ onSignup }: { onSignup: () => void }) {
  return (
    <FadeIn>
      <section
        className="py-20 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, #0a1a0d 0%, #112518 50%, #0f1e12 100%)",
        }}
      >
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4" style={{ color: "var(--color-brand)" }}>
          Ready to start?
        </p>
        <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
          Take control of your business today
        </h2>
        <p className="text-white/55 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
          Join hundreds of Ghanaian businesses using GhPOS to sell faster,
          track profit clearly, and grow with confidence.
        </p>
        <button
          onClick={onSignup}
          className="px-8 py-3 font-bold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Start your free trial →
        </button>
        <p className="text-white/30 text-xs mt-4">30 days free · No card · Cancel anytime</p>
      </section>
    </FadeIn>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ onLogin }: { onLogin: () => void }) {
  return (
    <footer className="border-t border-line bg-paper px-6 py-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-brand" />
          <span className="font-semibold text-ink">GhPOS</span>
          <span>· Built for Ghanaian businesses</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="hover:text-ink transition-colors">Features</a>
          <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
          <button onClick={onLogin} className="hover:text-ink transition-colors">Sign in</button>
          <span>© {new Date().getFullYear()} GhPOS</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Props = {
  onSignup: () => void;
  onLogin: () => void;
  referralCode?: string;
};

export function LandingPage({ onSignup, onLogin }: Props) {
  return (
    <div className="min-h-dvh flex flex-col bg-paper">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <Nav onSignup={onSignup} onLogin={onLogin} />
      <Hero onSignup={onSignup} />
      <IndustriesSection />
      <FeaturesSection />
      <HowItWorks />
      <StatsStrip />
      <TestimonialsSection />
      <PricingSection onSignup={onSignup} />
      <CtaSection onSignup={onSignup} />
      <Footer onLogin={onLogin} />
    </div>
  );
}
