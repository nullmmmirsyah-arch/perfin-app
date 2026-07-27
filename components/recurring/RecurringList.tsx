'use client'

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, parseAmount } from '@/lib/utils';
import { RecurringForm } from './RecurringForm';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt, CheckCircle2, AlertCircle, CalendarClock, Pencil, Trash2 } from '@/components/ui/icons';
import { toast } from 'sonner';
import { useHousehold } from '@/components/HouseholdProvider';
import { useState } from 'react';

export function RecurringList() {
  const { householdId } = useHousehold();
  const expenses = useQuery(api.recurring.getRecurringExpenses, { householdId: householdId ?? undefined });
  const markPaid = useMutation(api.recurring.markRecurringPaid);
  const deleteExpense = useMutation(api.recurring.deleteRecurringExpense);
  const now = new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [editItem, setEditItem] = useState<any>(null);

  const paidExpenseIds = useQuery(
    api.recurring.getPaidThisMonth,
    { year, month }
  );

  const handleMarkPaid = async (expenseId: Id<"recurringExpenses">) => {
    try {
      await markPaid({ recurringExpenseId: expenseId, year, month });
      toast.success('Marked as paid');
    } catch {
      toast.error('Failed to mark as paid');
    }
  };

  const handleDelete = async (expenseId: Id<"recurringExpenses">) => {
    try {
      await deleteExpense({ id: expenseId });
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (expenses === undefined || paidExpenseIds === undefined) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Recurring Expenses</CardTitle></CardHeader>
        <CardContent><div className="h-[200px] flex items-center justify-center"><p className="text-xs text-muted-foreground">Loading...</p></div></CardContent>
      </Card>
    );
  }

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recurring Expenses</CardTitle>
          <RecurringForm householdId={householdId ?? undefined} />
        </CardHeader>
        <CardContent>
          <EmptyState icon={Receipt} title="No recurring expenses" description="Add your monthly bills and subscriptions to track them here." />
        </CardContent>
      </Card>
    );
  }

  const paidSet = new Set(paidExpenseIds);

  const getStatus = (expense: { _id: Id<"recurringExpenses">; dayOfMonth: number }) => {
    if (paidSet.has(expense._id)) return 'paid';
    if (expense.dayOfMonth < currentDay) return 'overdue';
    return 'upcoming';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Recurring Expenses</CardTitle>
        <RecurringForm householdId={householdId ?? undefined} onDone={() => setEditItem(null)} />
      </CardHeader>
      <CardContent className="space-y-2">
        {expenses.map((expense) => {
          const status = getStatus(expense);
          return (
            <div key={expense._id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {status === 'paid' ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : status === 'overdue' ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{expense.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Day {expense.dayOfMonth}</span>
                    {status === 'paid' && <span className="text-success">• Paid</span>}
                    {status === 'overdue' && <span className="text-destructive">• Overdue {currentDay - expense.dayOfMonth}d</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(parseAmount(expense.amount))}</span>
                {status !== 'paid' && (
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => handleMarkPaid(expense._id)}>
                    Bayar
                  </Button>
                )}
                <RecurringForm
                  householdId={householdId ?? undefined}
                  editItem={{
                    _id: expense._id,
                    name: expense.name,
                    amount: expense.amount,
                    categoryId: expense.categoryId,
                    dayOfMonth: expense.dayOfMonth,
                  }}
                  onDone={() => setEditItem(null)}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleDelete(expense._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
