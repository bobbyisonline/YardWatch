export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDecimal(value: number, decimals: number = 3): string {
  return value.toFixed(decimals);
}

export function sortByDescending<T>(arr: T[], getValue: (item: T) => number): T[] {
  return [...arr].sort((a, b) => getValue(b) - getValue(a));
}

export function sortByAscending<T>(arr: T[], getValue: (item: T) => number): T[] {
  return [...arr].sort((a, b) => getValue(a) - getValue(b));
}

export function groupBy<T, K extends string | number>(
  arr: T[],
  getKey: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = getKey(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function safeDiv(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0) return fallback;
  return numerator / denominator;
}
