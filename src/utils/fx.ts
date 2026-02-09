export function getFxDefault(): number {
  const raw = localStorage.getItem("usdUyuRateDefault");
  const v = raw ? Number(raw) : NaN;
  if (Number.isFinite(v) && v > 0) return v;
  localStorage.setItem("usdUyuRateDefault", "37.983");
  return 37.983;
}

export function setFxDefault(v: number) {
  if (Number.isFinite(v) && v > 0) localStorage.setItem("usdUyuRateDefault", String(v));
}
