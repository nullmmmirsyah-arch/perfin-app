'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Receipt } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionWithDetails } from './types';
import { TransactionItem } from '@/components/TransactionItem';
import { cn, formatCurrency, groupTransactionsByDate } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  transactions: TransactionWithDetails[];
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  isPrivacyMode?: boolean;
  highlightLabelId?: string[];
  highlightCategoryId?: string[];
}

const TransactionItemWrapper = memo(function TransactionItemWrapper({
  transaction,
  onEdit,
  onDelete,
  highlightLabelId,
  highlightCategoryId,
  isPrivacyMode,
  index,
}: {
  transaction: TransactionWithDetails;
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  highlightLabelId?: string[];
  highlightCategoryId?: string[];
  isPrivacyMode?: boolean;
  index: number;
}) {
  const handleEdit = useCallback(() => onEdit(transaction), [onEdit, transaction]);
  const handleDelete = useCallback(() => onDelete(transaction), [onDelete, transaction]);
  
  return (
    <TransactionItem
      transaction={transaction}
      onEdit={handleEdit}
      onDelete={handleDelete}
      highlightLabelId={highlightLabelId}
      highlightCategoryId={highlightCategoryId}
      isPrivacyMode={isPrivacyMode}
      index={index}
    />
  );
});

export function TransactionListGrouped({ transactions, onEdit, onDelete, isPrivacyMode, highlightLabelId, highlightCategoryId }: Props) {
  const { user } = useUser();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const wasActive = selectedCategoryId === detail.categoryId;
      setSelectedCategoryId(prev => prev === detail.categoryId ? null : detail.categoryId);
      setSelectedCategoryName(prev => prev === detail.categoryName ? null : detail.categoryName);
      
      if (!wasActive) {
        toast.info(`Filtered by ${detail.categoryName || 'category'}`, {
          description: 'Click "Clear filter" to show all transactions',
        });
      }
    };
    window.addEventListener('PERFIN_FILTER_CATEGORY', handler);
    return () => window.removeEventListener('PERFIN_FILTER_CATEGORY', handler);
  }, [selectedCategoryId]);

  const { groupedTransactions } = useMemo(() => {
    const grouped = groupTransactionsByDate(transactions || []);
    return { groupedTransactions: grouped };
  }, [transactions]);

  const filteredGroups = useMemo(() => {
    if (!selectedCategoryId) return groupedTransactions;
    const result: Record<string, TransactionWithDetails[]> = {};
    for (const [date, txs] of Object.entries(groupedTransactions)) {
      const filtered = txs.filter(tx => {
        if (tx.categoryId === selectedCategoryId) return true;
        if (tx.splits?.some(s => s.categoryId === selectedCategoryId)) return true;
        return false;
      });
      if (filtered.length > 0) {
        result[date] = filtered;
      }
    }
    return result;
  }, [groupedTransactions, selectedCategoryId]);

  const getDailyTotal = useCallback((transactions: TransactionWithDetails[]) => {
    let total = 0;
    transactions.forEach(t => {
      const shouldMask = t.hideAmount && t.userId !== user?.id;
      if (shouldMask) return;

      let amount = 0;
      const isFiltered = (highlightLabelId && highlightLabelId.length > 0) || (highlightCategoryId && highlightCategoryId.length > 0);
      
      if (isFiltered && t.isSplit && t.splits) {
        amount = t.splits.reduce((acc, split) => {
          const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelIds?.some(id => highlightLabelId.includes(String(id))));
          const categoryMatch = !highlightCategoryId || highlightCategoryId.length === 0 || (split.categoryId && highlightCategoryId.includes(String(split.categoryId)));
          
          if (labelMatch && categoryMatch) {
            return acc + parseFloat(split.amount.replace(/,/g, '') || '0');
          }
          return acc;
        }, 0);
      } else {
        amount = parseFloat(t.amount.replace(/,/g, '') || '0');
      }

      if (t.type === 'expense') total -= amount;
      if (t.type === 'income') total += amount;
    });
    return total;
  }, [user?.id, highlightLabelId, highlightCategoryId]);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [date, txs] of Object.entries(filteredGroups)) {
      totals[date] = getDailyTotal(txs);
    }
    return totals;
  }, [filteredGroups, getDailyTotal]);

  const filteredDates = Object.keys(filteredGroups);

  if (filteredDates.length === 0) {
    if (!selectedCategoryId) return null;
    return (
      <div className="space-y-2">
        {selectedCategoryId && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-accent/30 rounded-md">
            <span className="text-xs text-muted-foreground">
              Filtered by: <span className="font-medium">{selectedCategoryName || selectedCategoryId}</span>
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline min-h-8 px-2 flex items-center"
              onClick={() => {
                setSelectedCategoryId(null);
                setSelectedCategoryName(null);
              }}
              aria-label="Clear category filter"
            >
              Clear filter
            </button>
          </div>
        )}
        <EmptyState icon={Receipt} description="No transactions for this category." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedCategoryId && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-accent/30 rounded-md">
          <span className="text-xs text-muted-foreground">
            Filtered by: <span className="font-medium">{selectedCategoryName || selectedCategoryId}</span>
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline min-h-8 px-2 flex items-center"
            onClick={() => {
              setSelectedCategoryId(null);
              setSelectedCategoryName(null);
            }}
            aria-label="Clear category filter"
          >
            Clear filter
          </button>
        </div>
      )}
      {filteredDates.map((date, dateIndex) => {
        const dailyTotal = dailyTotals[date];
        
        return (
          <div key={date} className="space-y-3 motion-safe:animate-in motion-reduce:animate-none fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${dateIndex * 50}ms` }}>
            <div className="sticky top-16 bg-background py-2 z-20 flex justify-between items-center border-b border-border mb-2 shadow-sm">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                  {date}
              </h2>
              {dailyTotal !== 0 && (
                <span className={cn("text-xs font-bold", dailyTotal > 0 ? "text-success" : "text-destructive")}>
                  {dailyTotal > 0 ? '+' : '-'}{formatCurrency(Math.abs(dailyTotal), { isPrivacyMode })}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {filteredGroups[date].map((transaction: TransactionWithDetails, index: number) => (
                <TransactionItemWrapper
                  key={transaction._id}
                  transaction={transaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  highlightLabelId={highlightLabelId}
                  highlightCategoryId={highlightCategoryId}
                  isPrivacyMode={isPrivacyMode}
                  index={index}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  );
}
