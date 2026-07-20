import { trpc } from "./lib/trpc";

function StatusRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: "ok" | "pending" | "error";
  detail: string;
}) {
  const dot = {
    ok: "bg-brand",
    pending: "bg-warn",
    error: "bg-danger",
  }[state];

  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className={`inline-block size-2.5 ${dot}`} aria-hidden="true" />
        <span className="text-base">{label}</span>
      </div>
      <span className="tabular text-sm text-muted">{detail}</span>
    </div>
  );
}

export function App() {
  const ping = trpc.health.ping.useQuery();
  const db = trpc.health.db.useQuery();

  const apiState = ping.isPending ? "pending" : ping.isError ? "error" : "ok";
  const dbState = db.isPending ? "pending" : db.isError ? "error" : "ok";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="text-xl font-semibold tracking-tight">GhPOS</h1>
        <p className="mt-1 text-sm text-muted">
          Multi-tenant retail POS — system check
        </p>
      </header>

      <section className="mb-8 border border-line">
        <h2 className="border-b border-line bg-field px-4 py-2 text-sm font-semibold uppercase tracking-wide">
          Services
        </h2>

        <StatusRow
          label="API"
          state={apiState}
          detail={
            ping.isPending
              ? "checking…"
              : ping.isError
                ? "unreachable"
                : new Date(ping.data.time).toLocaleTimeString()
          }
        />

        <StatusRow
          label="Database"
          state={dbState}
          detail={
            db.isPending
              ? "checking…"
              : db.isError
                ? "unreachable"
                : `${db.data.organizations} organization${db.data.organizations === 1 ? "" : "s"}`
          }
        />
      </section>

      {db.isError && (
        <div className="mb-8 border-l-4 border-warn bg-field p-4 text-sm">
          <p className="font-semibold">Database not connected</p>
          <p className="mt-1 text-muted">
            Start Docker Desktop, then run{" "}
            <code className="bg-paper px-1">npm run db:up</code> and{" "}
            <code className="bg-paper px-1">npm run db:migrate</code>.
          </p>
        </div>
      )}

      {/* Design-language proof: the running total is the one loud element —
          44px tabular figures, right-aligned, in a panel of its own. */}
      <section className="border border-line">
        <h2 className="border-b border-line bg-field px-4 py-2 text-sm font-semibold uppercase tracking-wide">
          Design tokens
        </h2>
        <div className="px-4 py-6 text-right">
          <div className="text-sm text-muted">TOTAL</div>
          <div className="tabular text-[length:var(--text-total)] font-semibold leading-none">
            GH₵ 255.00
          </div>
        </div>
        <div className="flex gap-px border-t border-line bg-line">
          <button className="h-touch-lg flex-1 bg-brand text-base font-semibold text-paper">
            CASH
          </button>
          <button className="h-touch-lg flex-1 bg-brand text-base font-semibold text-paper">
            MoMo
          </button>
        </div>
      </section>

      <p className="mt-8 text-xs text-muted">
        Sharp corners, 1px borders, system font, tabular figures, 64px touch
        targets — see Design-Language.md.
      </p>
    </main>
  );
}
