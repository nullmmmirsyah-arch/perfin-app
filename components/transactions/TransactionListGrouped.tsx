import { TransactionWithDetails } from './types';
import { TransactionItem } from '@/components/TransactionItem';
import { groupTransactionsByDate } from '@/lib/utils';

interface Props {
  transactions: TransactionWithDetails[];
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  highlightLabelId?: string;
  highlightCategoryId?: string;
}

export function TransactionListGrouped({ transactions, onEdit, onDelete, highlightLabelId, highlightCategoryId }: Props) {
  const groupedTransactions = groupTransactionsByDate(transactions || []);
  const sortedDates = Object.keys(groupedTransactions);

  const getDailyTotal = (transactions: TransactionWithDetails[]) => {
    let total = 0;
    transactions.forEach(t => {
      let amount = 0;
      const isFiltered = highlightLabelId || highlightCategoryId;
      
      if (isFiltered && t.isSplit && t.splits) {
        // Sum only matching splits
        amount = t.splits.reduce((acc, split) => {
          const labelMatch = !highlightLabelId || String(split.labelId) === String(highlightLabelId);
          const categoryMatch = !highlightCategoryId || String(split.categoryId) === String(highlightCategoryId);
          
          if (labelMatch && categoryMatch) {
            return acc + parseFloat(split.amount.replace(/,/g, '') || '0');
          }
          return acc;
        }, 0);
      } else {
        // Use full amount if not split or not filtered
        amount = parseFloat(t.amount.replace(/,/g, '') || '0');
      }

      if (t.type === 'expense') total -= amount;
      if (t.type === 'income') total += amount;
      // Transfers are neutral for daily net flow
    });
    return total;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  if (sortedDates.length === 0) {
    return (
        <div className="p-8 text-center border rounded-lg border-dashed bg-muted/20">
            <p className="text-muted-foreground">No transactions found.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const dailyTotal = getDailyTotal(groupedTransactions[date]);
        
        return (
          <div key={date} className="space-y-3">
            <div className="sticky top-0 bg-background/95 backdrop-blur-md py-2 z-10 flex justify-between items-center border-b border-border/40 mb-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {date}
              </h3>
              {dailyTotal !== 0 && (
                <span className={`text-xs font-bold ${dailyTotal > 0 ? 'text-success' : 'text-destructive'}`}>
                  {dailyTotal > 0 ? '+' : '-'}{formatCurrency(dailyTotal)}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {groupedTransactions[date].map((transaction: TransactionWithDetails) => (
                <TransactionItem
                  key={transaction._id}
                  transaction={transaction}
                  onEdit={() => onEdit(transaction)}
                  onDelete={() => onDelete(transaction)}
                  highlightLabelId={highlightLabelId}
                  highlightCategoryId={highlightCategoryId}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  );
}
