type Props = {
  onSignup: () => void;
  onLogin: () => void;
  referralCode?: string;
};

const FEATURES = [
  {
    icon: "🧾",
    title: "Fast checkout",
    body: "Tap products, accept cash or MoMo, print or share receipts on WhatsApp in seconds.",
  },
  {
    icon: "📦",
    title: "Stock control",
    body: "Track every item in and out. Get low-stock alerts before you run out.",
  },
  {
    icon: "📒",
    title: "Customer credit",
    body: "Record credit sales and payments. Know exactly who owes you and how much.",
  },
  {
    icon: "🏪",
    title: "Supplier ledger",
    body: "Log purchases on credit and track what you owe each supplier.",
  },
  {
    icon: "📊",
    title: "Profit reports",
    body: "See today's revenue, cost of goods, expenses, and net profit in one screen.",
  },
  {
    icon: "👥",
    title: "Multi-staff",
    body: "Cashiers log in with a PIN, managers with a password. Full audit trail.",
  },
];

export function LandingPage({ onSignup, onLogin }: Props) {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Nav */}
      <header className="border-b-2 border-ink px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">GhPOS</span>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="text-sm text-muted hover:text-ink"
          >
            Sign in
          </button>
          <button
            onClick={onSignup}
            className="px-4 py-1.5 bg-ink text-paper text-sm font-semibold"
          >
            Start free trial
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-16 border-b border-line">
        <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-4">
          Built for Ghana provision stores
        </p>
        <h1 className="text-4xl font-bold leading-tight max-w-lg mb-4">
          Run your shop.<br />Know your numbers.
        </h1>
        <p className="text-base text-muted max-w-md mb-8">
          GhPOS helps provision store owners sell faster, track stock, manage
          customer credit, and see real profit — from any phone or tablet.
        </p>
        <button
          onClick={onSignup}
          className="px-8 py-3 bg-ink text-paper text-base font-bold hover:opacity-90"
        >
          Start your 30-day free trial →
        </button>
        <p className="text-xs text-muted mt-3">No credit card required.</p>
      </section>

      {/* Features */}
      <section className="px-6 py-12 max-w-3xl mx-auto w-full">
        <h2 className="text-xl font-bold text-center mb-8">Everything you need, nothing you don't</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="border border-line p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-sm mb-1">{f.title}</div>
              <div className="text-xs text-muted leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-field px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">Up and running in minutes</h2>
          <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-line border border-line">
            {[
              { step: "1", title: "Sign up", body: "Create your shop in under 2 minutes." },
              { step: "2", title: "Add products", body: "Enter your items, prices, and opening stock." },
              { step: "3", title: "Start selling", body: "Tap to checkout, record payments, track profit." },
            ].map((s) => (
              <div key={s.step} className="flex-1 px-6 py-5 text-center">
                <div className="text-3xl font-bold text-muted mb-2">{s.step}</div>
                <div className="font-semibold text-sm mb-1">{s.title}</div>
                <div className="text-xs text-muted">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-12 max-w-lg mx-auto w-full text-center">
        <h2 className="text-xl font-bold mb-2">Simple pricing</h2>
        <p className="text-muted text-sm mb-6">
          Try everything free for 30 days. No card needed to start.
        </p>
        <div className="border-2 border-ink p-6">
          <div className="text-3xl font-bold mb-1">
            GH₵ 99<span className="text-base font-normal text-muted">/month</span>
          </div>
          <p className="text-xs text-muted mb-5">after your free trial</p>
          <ul className="text-sm text-left space-y-2 mb-6">
            {[
              "Unlimited sales and products",
              "Multi-cashier with PIN login",
              "Customer credit & supplier ledger",
              "Stock take & low-stock alerts",
              "Profit & loss reports",
              "WhatsApp receipt sharing",
              "CSV data export",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brand font-bold shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onSignup}
            className="w-full py-3 bg-ink text-paper font-bold text-sm"
          >
            Start free trial
          </button>
          <p className="text-xs text-muted mt-2">Cancel anytime. No contracts.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-2 border-ink bg-ink text-paper px-6 py-12 text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to take control of your shop?</h2>
        <p className="text-sm text-paper/70 mb-6">
          Join provision store owners across Ghana who track their business clearly.
        </p>
        <button
          onClick={onSignup}
          className="px-8 py-3 bg-paper text-ink font-bold text-sm hover:opacity-90"
        >
          Start 30-day free trial →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} GhPOS · Made for Ghana provision stores ·{" "}
        <button onClick={onLogin} className="underline">Sign in</button>
      </footer>
    </div>
  );
}
