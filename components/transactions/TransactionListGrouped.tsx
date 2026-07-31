'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Receipt } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionWithDetails } from './types';
import { TransactionItem } from '@/components/TransactionItem';
import { formatCurrency, groupTransactionsByDate } from '@/lib/utils';

interface Props {
  transactions: TransactionWithDetails[];
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  isPrivacyMode?: boolean;
  highlightLabelId?: string[];
  highlightCategoryId?: string[];
}

export function TransactionListGrouped({ transactions, onEdit, onDelete, isPrivacyMode, highlightLabelId, highlightCategoryId }: Props) {
  const { user } = useUser();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSelectedCategoryId(prev => prev === detail.categoryId ? null : detail.categoryId);
      setSelectedCategoryName(prev => prev === detail.categoryName ? null : detail.categoryName);
    };
    window.addEventListener('PERFIN_FILTER_CATEGORY', handler);
    return () => window.removeEventListener('PERFIN_FILTER_CATEGORY', handler);
  }, []);

  const { groupedTransactions, sortedDates } = useMemo(() => {
    const grouped = groupTransactionsByDate(transactions || []);
    return { groupedTransactions: grouped, sortedDates: Object.keys(grouped) };
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

  const getDailyTotal = (transactions: TransactionWithDetails[]) => {
    let total = 0;
    transactions.forEach(t => {
      const shouldMask = t.hideAmount && t.userId !== user?.id;
      if (shouldMask) return;

      let amount = 0;
      const isFiltered = (highlightLabelId && highlightLabelId.length > 0) || (highlightCategoryId && highlightCategoryId.length > 0);
      
      if (isFiltered && t.isSplit && t.splits) {
        // Sum only matching splits
        amount = t.splits.reduce((acc, split) => {
          const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelIds?.some(id => highlightLabelId.includes(String(id))));
          const categoryMatch = !highlightCategoryId || highlightCategoryId.length === 0 || (split.categoryId && highlightCategoryId.includes(String(split.categoryId)));
          
          if (labelMatch && categoryMatch) {
            return acc + parseFloat(split.amount.replace(/,/g, '') || '0');
          }
          return acc;
        }, 0);
      } else {
        // Use full amount if not split or not filtered (or if filtered but matches main transaction logic - handled by parent filter, here we just sum visible)
        // Note: The parent 'get' query already filters main transactions. 
        // But for daily total of SPLIT transactions where only SOME splits match, we need this logic.
        // If it's NOT split, we assume it matched the filter to get here.
        amount = parseFloat(t.amount.replace(/,/g, '') || '0');
      }

      if (t.type === 'expense') total -= amount;
      if (t.type === 'income') total += amount;
      // Transfers are neutral for daily net flow
    });
    return total;
  };

  const filteredDates = Object.keys(filteredGroups);

  if (filteredDates.length === 0) {
    if (!selectedCategoryId) return null;
    return (
      <div className="space-y-2">
        {selectedCategoryId && (
          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-xs text-muted-foreground">
              Filtered by: <span className="font-medium">{selectedCategoryName || selectedCategoryId}</span>
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => {
                setSelectedCategoryId(null);
                setSelectedCategoryName(null);
              }}
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
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => {
              setSelectedCategoryId(null);
              setSelectedCategoryName(null);
            }}
          >
            Clear filter
          </button>
        </div>
      )}
      {filteredDates.map((date) => {
        const dailyTotal = getDailyTotal(filteredGroups[date]);
        
        return (
          <div key={date} className="space-y-3">
            <div className="sticky top-0 bg-background/95 backdrop-blur-md py-2 z-10 flex justify-between items-center border-b border-border/40 mb-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {date}
              </h3>
              {dailyTotal !== 0 && (
                <span className={`text-xs font-bold ${dailyTotal > 0 ? 'text-success' : 'text-destructive'}`}>
                  {dailyTotal > 0 ? '+' : '-'}{formatCurrency(Math.abs(dailyTotal), { isPrivacyMode })}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {filteredGroups[date].map((transaction: TransactionWithDetails) => (
                <TransactionItem
                  key={transaction._id}
                  transaction={transaction}
                  onEdit={() => onEdit(transaction)}
                  onDelete={() => onDelete(transaction)}
                  highlightLabelId={highlightLabelId}
                  highlightCategoryId={highlightCategoryId}
                  isPrivacyMode={isPrivacyMode}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  );
}
