import { TransactionWithDetails } from './types';
import { TransactionItem } from '@/components/TransactionItem';
import { groupTransactionsByDate } from '@/lib/utils';

interface Props {
  transactions: TransactionWithDetails[];
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  variant?: 'default' | 'slim';
}

export function TransactionListGrouped({ transactions, onEdit, onDelete, variant = 'default' }: Props) {
  const groupedTransactions = groupTransactionsByDate(transactions || []);
  const sortedDates = Object.keys(groupedTransactions);

  if (sortedDates.length === 0) {
    if (variant === 'slim') {
        return (
            <div className="p-8 text-center border rounded-lg border-dashed bg-muted/20">
                <p className="text-muted-foreground">No transactions found.</p>
            </div>
        );
    }
    // Default empty state handled by parent usually, but if not:
    return null;
  }

  return (
    <div className={variant === 'default' ? "mt-8 space-y-6" : "grid gap-4"}>
      {sortedDates.map((date) => (
        <div key={date} className="space-y-2">
           {variant === 'default' ? (
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider bg-background px-2">
                        {date}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                </div>
           ) : (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                    {date}
                </h3>
           )}
          
          <div className={variant === 'default' ? "grid grid-cols-1 gap-3" : "grid gap-2"}>
            {groupedTransactions[date].map((transaction: TransactionWithDetails) => (
              <TransactionItem
                key={transaction._id}
                transaction={transaction}
                variant={variant}
                onEdit={() => onEdit(transaction)}
                onDelete={() => onDelete(transaction)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
