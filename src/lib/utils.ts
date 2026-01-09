import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a string for comparison: trim, collapse whitespace, lowercase
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Normalize a name for display: trim, collapse whitespace, title case
 */
export function normalizeNameForDisplay(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Parse a monetary value (pt-BR or dot decimal) to cents
 * Examples: "1.234,56" -> 123456, "1234.56" -> 123456, "1234" -> 123400
 */
export function parseMoneyToCents(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;

  // If already a number, assume it's in the original currency unit
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  const str = value.toString().trim();
  if (!str) return 0;

  // Remove currency symbols and spaces
  let cleaned = str.replace(/[R$\s]/g, '');

  // Detect format: pt-BR uses comma as decimal, dot as thousands
  // If we have both dot and comma, the last one is the decimal separator
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastComma > lastDot) {
    // pt-BR format: 1.234,56 -> remove dots, replace comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot decimal format: 1,234.56 -> remove commas
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma >= 0 && lastDot < 0) {
    // Only comma present, assume it's decimal separator: 1234,56
    cleaned = cleaned.replace(',', '.');
  }
  // If only dot or neither, it's fine as is

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  return Math.round(parsed * 100);
}

/**
 * Format cents to pt-BR currency string
 */
export function formatCurrency(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Format cents to pt-BR number string (no currency symbol)
 */
export function formatNumber(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse quantity to integer
 */
export function parseQuantity(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;

  if (typeof value === 'number') {
    return Math.round(value);
  }

  const parsed = parseInt(value.toString().trim(), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Levenshtein distance for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio (0-1)
 */
export function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Remove accents from string
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
