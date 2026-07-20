import { describe, expect, it } from "vitest";
import {
  allocatePesewas,
  cedisToPesewas,
  formatPesewas,
  pesewasToCedis,
} from "./money";

describe("money", () => {
  it("converts cedis to pesewas as integers", () => {
    expect(cedisToPesewas(12.5)).toBe(1250);
    expect(cedisToPesewas(0.1)).toBe(10);
    expect(cedisToPesewas(0)).toBe(0);
  });

  it("survives the classic float trap", () => {
    // 0.1 + 0.2 !== 0.3 in floats; in pesewas it is exact.
    expect(cedisToPesewas(0.1) + cedisToPesewas(0.2)).toBe(
      cedisToPesewas(0.3),
    );
  });

  it("round-trips back to cedis", () => {
    expect(pesewasToCedis(1250)).toBe(12.5);
  });

  it("formats for display", () => {
    expect(formatPesewas(1250)).toBe("GH₵ 12.50");
    expect(formatPesewas(5)).toBe("GH₵ 0.05");
    expect(formatPesewas(100000)).toBe("GH₵ 1,000.00");
    expect(formatPesewas(-1250)).toBe("-GH₵ 12.50");
    expect(formatPesewas(1250, { withSymbol: false })).toBe("12.50");
  });

  it("allocates without losing pesewas", () => {
    const parts = allocatePesewas(100, 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
