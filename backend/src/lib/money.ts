/**
 * Money in GhPOS is ALWAYS an integer count of pesewas (GHS minor units).
 * Never use a float for money — 0.1 + 0.2 !== 0.3 and a POS that loses a
 * pesewa per sale loses a shop's trust.
 *
 * 1 GHS = 100 pesewas.
 */

export type Pesewas = number;

const MINOR_UNITS_PER_CEDI = 100;

/** 12.5 (cedis) -> 1250 (pesewas). Rounds to the nearest pesewa. */
export function cedisToPesewas(cedis: number): Pesewas {
  return Math.round(cedis * MINOR_UNITS_PER_CEDI);
}

/** 1250 (pesewas) -> 12.5 (cedis). For display/export only, never for math. */
export function pesewasToCedis(pesewas: Pesewas): number {
  return pesewas / MINOR_UNITS_PER_CEDI;
}

/** 1250 -> "GH₵ 12.50" */
export function formatPesewas(
  pesewas: Pesewas,
  options: { withSymbol?: boolean } = {},
): string {
  const { withSymbol = true } = options;
  const negative = pesewas < 0;
  const abs = Math.abs(pesewas);
  const major = Math.floor(abs / MINOR_UNITS_PER_CEDI);
  const minor = abs % MINOR_UNITS_PER_CEDI;

  const amount = `${major.toLocaleString("en-GH")}.${String(minor).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${withSymbol ? "GH₵ " : ""}${amount}`;
}

/**
 * Split a total across parts without losing pesewas to rounding.
 * Any remainder is distributed one pesewa at a time to the earliest parts,
 * so the parts always sum exactly back to the total.
 */
export function allocatePesewas(total: Pesewas, parts: number): Pesewas[] {
  if (parts <= 0) throw new Error("allocatePesewas: parts must be > 0");

  const base = Math.trunc(total / parts);
  const remainder = total - base * parts;
  const sign = remainder < 0 ? -1 : 1;

  return Array.from({ length: parts }, (_, i) =>
    i < Math.abs(remainder) ? base + sign : base,
  );
}
