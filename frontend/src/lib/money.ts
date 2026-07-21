/** Format pesewas as GH₵ x.xx */
export function formatMoney(pesewas: number): string {
  return `GH₵ ${(pesewas / 100).toFixed(2)}`;
}
