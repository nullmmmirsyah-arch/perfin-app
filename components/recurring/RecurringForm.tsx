'use client'

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from '@/components/ui/icons';

type Props = {
  householdId?: Id<"households">;
  editItem?: {
    _id: Id<"recurringExpenses">;
    name: string;
    amount: string;
    categoryId: Id<"categories">;
    dayOfMonth: number;
  };
  onDone?: () => void;
};

export function RecurringForm({ householdId, editItem, onDone }: Props) {
  const create = useMutation(api.recurring.createRecurringExpense);
  const update = useMutation(api.recurring.updateRecurringExpense);
  const categories = useQuery(api.categories.get, { householdId: householdId ?? undefined, type: 'expense' });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editItem?.name ?? '');
  const [amount, setAmount] = useState(editItem?.amount ?? '');
  const [categoryId, setCategoryId] = useState(editItem?.categoryId ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(editItem?.dayOfMonth ?? 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !amount || !categoryId) {
      toast.error('Please fill all fields');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await update({ id: editItem._id, name, amount, categoryId: categoryId as Id<"categories">, dayOfMonth });
        toast.success('Updated');
      } else {
        await create({ householdId, name, amount, categoryId: categoryId as Id<"categories">, dayOfMonth });
        toast.success('Created');
      }
      setOpen(false);
      setName('');
      setAmount('');
      setCategoryId('');
      setDayOfMonth(1);
      onDone?.();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editItem ? (
          <Button variant="ghost" size="sm">Edit</Button>
        ) : (
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Recurring</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Recurring Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electricity" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
            <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="500,000" type="text" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder={categories === undefined ? "Loading..." : "Select category"} /></SelectTrigger>
              <SelectContent>
                {categories?.map(c => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Day of month</label>
            <Input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
