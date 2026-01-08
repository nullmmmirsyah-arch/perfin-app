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

interface TransactionMinimal {
  date: string;
  [key: string]: unknown;
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
