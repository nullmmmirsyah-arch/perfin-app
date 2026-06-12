'use client'

import { useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseAmount } from '@/lib/utils';
import { getFiscalDateDetails } from '@/lib/finance-utils';
import { toast } from 'sonner';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

type Props = {
  householdId?: Id<"households">;
  budgetBreakdown: BudgetBreakdownItem[] | undefined;
  budgetStartDay?: number;
  isPrivacyMode?: boolean;
};

export function BudgetQuickEdit({ householdId, budgetBreakdown, budgetStartDay, isPrivacyMode }: Props) {
  const upsertBudget = useMutation(api.budgets.upsertBudget);
  const { year, month } = getFiscalDateDetails(new Date().toISOString(), budgetStartDay ?? 1);

  const items = (budgetBreakdown || []).filter(
    (item) => item.enablePacing !== false && item.limit > 0
  );

  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editOriginal, setEditOriginal] = useState(0);
  const [editCarryover, setEditCarryover] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleStartEdit = useCallback((item: BudgetBreakdownItem) => {
    const allocated = item.limit - item.carryover;
    setEditId(item.categoryId);
    setEditValue(String(allocated));
    setEditOriginal(allocated);
    setEditCarryover(item.carryover);
  }, []);

  const handleCancelEdit = useCallback(() => {
    const raw = parseAmount(editValue);
    if (Number.isFinite(raw) && raw !== editOriginal) {
      if (!confirm('Discard changes?')) return;
    }
    setEditId(null);
    setEditValue('');
    setEditOriginal(0);
    setEditCarryover(0);
  }, [editValue, editOriginal]);

  const handleSave = useCallback(async (categoryId: string) => {
    const numVal = parseAmount(editValue);
    if (!Number.isFinite(numVal) || numVal < 0) return;
    if (numVal === editOriginal) {
      setEditId(null);
      setEditValue('');
      setEditOriginal(0);
      setEditCarryover(0);
      return;
    }
    setSavingId(categoryId);
    try {
      await upsertBudget({
        householdId: householdId,
        categoryId: categoryId as Id<"categories">,
        amount: String(numVal),
        year,
        month,
      });
      setEditId(null);
      setEditValue('');
      setEditOriginal(0);
      setEditCarryover(0);
      toast.success('Budget updated');
    } catch (e) {
      toast.error('Failed to save budget');
    } finally {
      setSavingId(null);
    }
  }, [upsertBudget, householdId, year, month, editValue, editOriginal]);

  if (items.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Quick Edit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">
              Set up budgets to quickly adjust them here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Quick Edit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
        {items.map((item) => {
          const isEditing = editId === item.categoryId;
          const isSaving = savingId === item.categoryId;
          return (
            <div key={item.categoryId} className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
              <span className="text-xs truncate">{item.categoryName}</span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {isEditing ? (
                  <>
                    <Input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 w-24 text-xs text-right tabular-nums"
                      autoFocus
                      disabled={isSaving}
                    />
                    <Button variant="ghost" size="sm" onClick={() => handleSave(item.categoryId)} className="h-7 w-7 p-0" disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 w-7 p-0" disabled={isSaving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-end">
                      <span className="text-xs tabular-nums font-medium">
                        {formatCurrency(item.limit, { isPrivacyMode })}
                      </span>
                      {item.carryover !== 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          +{formatCurrency(item.carryover, { isPrivacyMode })} carryover
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleStartEdit(item)} className="h-7 w-7 p-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
