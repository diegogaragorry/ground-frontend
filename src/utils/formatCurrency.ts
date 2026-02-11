/**
 * Format an amount stored in USD for display in the user's preferred currency (USD or UYU).
 * Used for totals, KPIs, summaries across the app.
 */

const usdNumberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export type DisplayCurrency = "USD" | "UYU";

export function formatAmountUsd(params: {
  amountUsd: number;
  preferredCurrency: DisplayCurrency;
  usdUyuRate: number | null;
}): { formatted: string; currency: DisplayCurrency; value: number; formattedSecondary?: string } {
  const { amountUsd, preferredCurrency, usdUyuRate } = params;

  if (preferredCurrency === "UYU" && usdUyuRate != null && usdUyuRate > 0) {
    const valueUyu = amountUsd * usdUyuRate;
    return {
      formatted: `$U ${usdNumberFormat.format(valueUyu)}`,
      currency: "UYU",
      value: valueUyu,
      formattedSecondary: `≈ $ ${usdNumberFormat.format(amountUsd)}`,
    };
  }

  return {
    formatted: `$ ${usdNumberFormat.format(amountUsd)}`,
    currency: "USD",
    value: amountUsd,
  };
}

/**
 * Hook-friendly: get display currency and a formatter from AppShell.
 * Use useAppShell() and pass its values, or use useDisplayCurrency which does that.
 */
export function formatAmountUsdWith(
  amountUsd: number,
  preferredCurrency: DisplayCurrency,
  usdUyuRate: number | null
): string {
  return formatAmountUsd({ amountUsd, preferredCurrency, usdUyuRate }).formatted;
}
