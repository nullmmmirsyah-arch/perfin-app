import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
