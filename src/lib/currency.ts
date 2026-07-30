// Supported currencies with symbols and names
export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

// Fetch live exchange rates from a free API
export async function fetchExchangeRates(baseCurrency: string = "USD"): Promise<Record<string, number>> {
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    if (!res.ok) throw new Error("Failed to fetch rates");
    const data = await res.json();
    return data.rates || {};
  } catch {
    // Fallback static rates
    return {
      USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, CAD: 1.36,
      AUD: 1.53, JPY: 149.5, CNY: 7.24, CHF: 0.88, SGD: 1.34,
      AED: 3.67, SAR: 3.75, BRL: 4.97, MXN: 17.15, ZAR: 18.5,
      NZD: 1.64, SEK: 10.45, NOK: 10.55, DKK: 6.87, KRW: 1320,
    };
  }
}

export function convertCurrency(amount: number, fromRate: number, toRate: number): number {
  return (amount / fromRate) * toRate;
}
