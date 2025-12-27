import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function groupTransactionsByDate(transactions: any[]) {
  if (!transactions) return {};

  const groups: Record<string, any[]> = {};

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date);
    let dateKey = format(date, 'yyyy-MM-dd');
    let displayDate = format(date, 'dd MMM yyyy');

    if (isToday(date)) {
      displayDate = 'Today';
      dateKey = 'today'; // Ensure Today is always first if sorting keys
    } else if (isYesterday(date)) {
      displayDate = 'Yesterday';
      dateKey = 'yesterday';
    }

    if (!groups[displayDate]) {
      groups[displayDate] = [];
    }
    groups[displayDate].push(transaction);
  });

  return groups;
}
