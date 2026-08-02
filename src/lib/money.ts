// Beløpsformatering for betalingssporet. Alt lagres i øre (minor units);
// UI-et viser hele kroner uten desimaler når det går opp («79 kr»),
// ellers med komma («59,25 kr»).
export function formatKr(amountMinor: number): string {
  const kroner = Math.floor(amountMinor / 100);
  const ore = amountMinor % 100;
  return ore === 0
    ? `${kroner.toLocaleString('nb-NO')} kr`
    : `${kroner.toLocaleString('nb-NO')},${String(ore).padStart(2, '0')} kr`;
}
