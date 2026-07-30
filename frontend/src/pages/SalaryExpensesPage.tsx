import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { trpc } from "../lib/trpc";
import { formatMoney } from "../lib/money";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@ghpos/backend/src/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type StaffSummary = RouterOutput["salary"]["listStaff"][number];
type ExpenseRow = RouterOutput["expenses"]["list"][number];

// ── Common categories for quick-pick ─────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  "Rent", "Electricity", "Water", "Transport", "Supplies",
  "Repairs", "Advertising", "Phone/Internet", "Other",
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function SalaryExpensesPage() {
  const [tab, setTab] = useState<"expenses" | "salary">("expenses");

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-4 bg-paper">
        <h1 className="text-sm font-semibold text-ink">Salary &amp; Expenses</h1>
        <p className="text-xs text-muted mt-0.5">Record expenses and staff salary payments</p>
      </div>
      <div className="px-6 py-4 max-w-2xl">

      {/* Tab switcher */}
      <div className="flex border border-line mb-6">
        {(["expenses", "salary"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "flex-1 py-2 text-sm font-medium capitalize",
              tab === t ? "bg-ink text-paper" : "hover:bg-field",
            ].join(" ")}
          >
            {t === "expenses" ? "Expenses" : "Staff Salary"}
          </button>
        ))}
      </div>

      {tab === "expenses" ? <ExpensesTab /> : <SalaryTab />}
      </div>
    </div>
  );
}

// ── Expenses tab ──────────────────────────────────────────────────────────────

function ExpensesTab() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();

  const { data: expenses, isLoading } = trpc.expenses.list.useQuery({});

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => utils.expenses.list.invalidate(),
  });

  const totalThisMonth = (expenses ?? [])
    .filter((e) => {
      const d = new Date(e.paidAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, e) => s + e.amount, 0);

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted">
          This month: <span className="font-semibold text-ink">{formatMoney(totalThisMonth)}</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-1.5 bg-ink text-paper text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Log expense"}
        </button>
      </div>

      {showForm && (
        <AddExpenseForm onDone={() => { setShowForm(false); utils.expenses.list.invalidate(); }} />
      )}

      {(!expenses || expenses.length === 0) ? (
        <div className="border border-line p-6 text-center text-sm text-muted">
          No expenses logged yet.
        </div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {expenses.map((e) => (
            <ExpenseItem
              key={e.id}
              expense={e}
              onDelete={() => deleteMutation.mutate({ id: e.id })}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseItem({
  expense,
  onDelete,
  isDeleting,
}: {
  expense: ExpenseRow;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{expense.category}</span>
          {expense.branch && (
            <span className="text-xs text-muted">· {expense.branch.name}</span>
          )}
        </div>
        {expense.note && <div className="text-xs text-muted mt-0.5">{expense.note}</div>}
        <div className="text-xs text-muted mt-0.5">
          {new Date(expense.paidAt).toLocaleDateString()} · by {expense.createdBy.name}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">{formatMoney(expense.amount)}</div>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="text-xs text-danger hover:underline disabled:opacity-50 mt-0.5"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AddExpenseForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cat = category === "Other" ? customCategory.trim() : category;
    if (!cat) { setError("Choose or enter a category."); return; }
    const pesewas = Math.round(parseFloat(amountStr) * 100);
    if (!pesewas || pesewas <= 0) { setError("Enter a valid amount."); return; }
    setError(null);
    createMutation.mutate({
      category: cat,
      amount: pesewas,
      note: note.trim() || undefined,
      branchId: user?.branchId ?? undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line mb-4 space-y-3">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Log expense</p>
      </div>
      <div className="px-4 pb-4 pt-3 space-y-3">
      <div>
        <label className="block text-xs text-muted mb-1">Category</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={[
                "px-2.5 py-1 text-xs border",
                category === c ? "bg-ink text-paper border-ink" : "border-line hover:bg-paper",
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
        {category === "Other" && (
          <input
            type="text"
            placeholder="Custom category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className="w-full border border-line px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
          />
        )}
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Amount (GH₵)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="w-full border border-line bg-field px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Note (optional)</label>
        <input
          type="text"
          placeholder="Details…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-line bg-field px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-danger text-xs">{error}</p>}

      <button
        type="submit"
        disabled={createMutation.isPending}
        className="w-full py-2 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50"
      >
        {createMutation.isPending ? "Saving…" : "Save expense"}
      </button>
      </div>
    </form>
  );
}

// ── Salary tab ────────────────────────────────────────────────────────────────

function SalaryTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: staff, isLoading } = trpc.salary.listStaff.useQuery();

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>;
  if (!staff || staff.length === 0)
    return <div className="border border-line p-6 text-center text-sm text-muted">No staff found.</div>;

  if (selectedId) {
    return (
      <StaffSalaryDetail
        userId={selectedId}
        onBack={() => { setSelectedId(null); utils.salary.listStaff.invalidate(); }}
      />
    );
  }

  return (
    <div className="border border-line divide-y divide-line">
      {staff.map((s) => (
        <StaffRow key={s.id} staff={s} onSelect={() => setSelectedId(s.id)} />
      ))}
    </div>
  );
}

function StaffRow({ staff, onSelect }: { staff: StaffSummary; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-field text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{staff.name}</div>
        <div className="text-xs text-muted">
          {staff.role}{staff.branchName ? ` · ${staff.branchName}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm tabular-nums">
          {staff.agreedAmount != null ? formatMoney(staff.agreedAmount) + "/mo" : <span className="text-muted text-xs">No salary set</span>}
        </div>
        {staff.totalPaidThisMonth > 0 && (
          <div className="text-xs text-muted">
            Paid this month: {formatMoney(staff.totalPaidThisMonth)}
          </div>
        )}
      </div>
      <span className="text-muted text-xs">›</span>
    </button>
  );
}

function StaffSalaryDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [showSetSalary, setShowSetSalary] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const utils = trpc.useUtils();

  const { data: staff, isLoading } = trpc.salary.getStaff.useQuery({ userId });

  const refresh = () => {
    utils.salary.getStaff.invalidate({ userId });
    utils.salary.listStaff.invalidate();
  };

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>;
  if (!staff) return null;

  const currentSalary = staff.salaryRecords[0]?.agreedAmount ?? null;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-4">
        ← All staff
      </button>

      <div className="border border-line mb-4">
        <div className="flex items-start justify-between px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">{staff.name}</p>
            <p className="text-xs text-muted mt-0.5">{staff.role}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Agreed salary</p>
            <p className="text-sm font-semibold text-ink mt-0.5">
              {currentSalary != null ? formatMoney(currentSalary) + "/mo" : "Not set"}
            </p>
          </div>
        </div>
        <div className="border-t border-line px-5 py-3 flex gap-2">
          <button
            onClick={() => { setShowSetSalary((v) => !v); setShowAddPayment(false); }}
            className="px-3 py-1.5 border border-line text-xs text-muted hover:bg-field hover:text-ink"
          >
            Set salary
          </button>
          <button
            onClick={() => { setShowAddPayment((v) => !v); setShowSetSalary(false); }}
            className="px-3 py-1.5 bg-ink text-paper text-xs font-medium hover:opacity-80"
          >
            Record payment
          </button>
        </div>
      </div>

      {showSetSalary && (
        <SetSalaryForm userId={userId} onDone={() => { setShowSetSalary(false); refresh(); }} />
      )}
      {showAddPayment && (
        <AddSalaryPaymentForm userId={userId} onDone={() => { setShowAddPayment(false); refresh(); }} />
      )}

      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-2">Payment history</p>
      {staff.salaryPayments.length === 0 ? (
        <div className="border border-line p-4 text-center text-sm text-muted">No payments recorded.</div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {staff.salaryPayments.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between px-4 py-3">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 mr-2 ${p.type === "ADVANCE" ? "text-warn" : "text-brand"}`}>
                  {p.type === "ADVANCE" ? "Advance" : "Payment"}
                </span>
                <span className="text-xs text-muted">
                  {new Date(p.paidAt).toLocaleDateString()} · by {p.createdBy.name}
                </span>
                {p.note && <div className="text-xs text-muted mt-0.5">{p.note}</div>}
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetSalaryForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.salary.setSalary.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pesewas = Math.round(parseFloat(amountStr) * 100);
    if (!pesewas || pesewas < 0) { setError("Enter a valid amount."); return; }
    setError(null);
    mutation.mutate({ userId, agreedAmount: pesewas, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line mb-4">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Set agreed salary</p>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">Monthly amount (GH₵)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full border border-line bg-field px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
            autoFocus
          />
        </div>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-line bg-field px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
        />
        {error && <p className="text-danger text-xs">{error}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save salary"}
        </button>
      </div>
    </form>
  );
}

function AddSalaryPaymentForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [type, setType] = useState<"PAYMENT" | "ADVANCE">("PAYMENT");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.salary.addPayment.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pesewas = Math.round(parseFloat(amountStr) * 100);
    if (!pesewas || pesewas <= 0) { setError("Enter a valid amount."); return; }
    setError(null);
    mutation.mutate({ userId, type, amount: pesewas, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line mb-4">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Record salary payment</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-1 border border-line">
          {(["PAYMENT", "ADVANCE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={[
                "flex-1 py-2 text-xs font-medium",
                type === t ? "bg-ink text-paper" : "text-muted hover:bg-field hover:text-ink",
              ].join(" ")}
            >
              {t === "PAYMENT" ? "Salary payment" : "Advance"}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Amount (GH₵)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full border border-line bg-field px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
            autoFocus
          />
        </div>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-line bg-field px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
        />
        {error && <p className="text-danger text-xs">{error}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}
