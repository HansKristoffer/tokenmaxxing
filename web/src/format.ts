export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  return Number(n).toLocaleString("en-US");
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return String(v);
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "$0.00";
  return n >= 1000 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

export const fmtParallel = (p: number | null): string => (p === null ? "—" : `${p.toFixed(1)}×`);

export function relTime(ts: number | null | undefined): string {
  if (!ts) return "--";
  const d = Math.max(0, Date.now() - ts);
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
