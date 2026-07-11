import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a currency string into a number.
 * Handles removal of commas and ensures a valid number return.
 */
export function parseAmount(value: string | undefined | null): number {
  if (!value) return 0;
  // Replace commas and handle empty string
  const clean = value.replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a number or string into a standardized currency display.
 * Supports Privacy Mode masking.
 */
export function formatCurrency(
  value: number | string | undefined | null,
  options?: Intl.NumberFormatOptions & { isPrivacyMode?: boolean }
): string {
  if (options?.isPrivacyMode) {
    return "••••"; // 4 standard bullets
  }

  let numericValue = typeof value === 'string' ? parseAmount(value) : (value ?? 0);
  if (!Number.isFinite(numericValue)) numericValue = 0;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    ...options,
  }).format(numericValue);
}

interface TransactionMinimal {
  date: string;
  [key: string]: unknown;
}

/**
 * Strips non-digit characters and formats a number string with thousand separators.
 * Useful for numeric input fields.
 */
export function formatNumberInput(value: string): string {
  const cleanValue = value.replace(/[^\d]/g, '');
  return new Intl.NumberFormat('en-US').format(parseInt(cleanValue) || 0);
}

export function groupTransactionsByDate<T extends TransactionMinimal>(transactions: T[]) {
  if (!transactions) return {};

  const groups: Record<string, T[]> = {};

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date);
    let displayDate = format(date, 'dd MMM yyyy');

    if (isToday(date)) {
      displayDate = 'Today';
    } else if (isYesterday(date)) {
      displayDate = 'Yesterday';
    }

    if (!groups[displayDate]) {
      groups[displayDate] = [];
    }
    groups[displayDate].push(transaction);
  });

  return groups;
}
