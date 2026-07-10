import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ArrowRightFromLine, Banknote } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileAmountInput } from './mobile-amount-input';

const MoveFundsFormSchema = z.object({
  fromCategoryId: z.string().min(1, 'Source is required'),
  categoryId: z.string().min(1, 'Destination is required'),
  amount: z.string().min(1, 'Amount is required'),
});

type MoveFundsFormValues = z.infer<typeof MoveFundsFormSchema>;

type MoveFundsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
};

const formatAmount = (value: string) => {
  const cleanValue = value.replace(/[^\d.]/g, '');
  const parts = cleanValue.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
};

const MoveFundsDrawer = ({ open, onOpenChange, year, month }: MoveFundsDrawerProps) => {
  const { householdId } = useHousehold();
  const moveBudgetFunds = useMutation(api.budgets.moveBudgetFunds);

  const categories = useQuery(api.categories.get, { type: 'expense', householdId: householdId ?? undefined });

  const budgetStatus = useQuery(api.budgets.getBudgetStatus, {
      month,
      year,
      householdId: householdId ?? undefined,
  });

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [amountSheetOpen, setAmountSheetOpen] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const submitLock = React.useRef(false);
  const isMobile = useIsMobile();

  const form = useForm<MoveFundsFormValues>({
    resolver: zodResolver(MoveFundsFormSchema),
    defaultValues: {
      fromCategoryId: '',
      categoryId: '',
      amount: '',
    },
  });

  const fromCategoryId = useWatch({ control: form.control, name: 'fromCategoryId' });
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const amountValue = useWatch({ control: form.control, name: 'amount' });

  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;
      setIsDirty(false);
      setShowDiscardDialog(false);
      setIsLocked(false);
      form.reset({
        fromCategoryId: '',
        categoryId: '',
        amount: '',
      });
    }
  }, [open, form]);

  useEffect(() => {
    if (open) {
      window.history.pushState({ drawer: 'move-funds' }, '', window.location.href);

      const handlePopState = () => {
        if (isDirty) {
          window.history.pushState({ drawer: 'move-funds' }, '', window.location.href);
          setShowDiscardDialog(true);
        } else {
          onOpenChange(false);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [open, isDirty, onOpenChange]);

  const handleKeepEditing = () => {
    setShowDiscardDialog(false);
    setIsLocked(true);
    setTimeout(() => setIsLocked(false), 500);
  };

  const handleOpenChangeWrapper = (newOpen: boolean) => {
    if (!newOpen && isLocked) return;

    if (!newOpen && isDirty) {
      if (!showDiscardDialog) setShowDiscardDialog(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  const onDirtyChange = React.useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  useEffect(() => {
    const subscription = form.watch(() => {
      onDirtyChange(form.formState.isDirty);
    });
    return () => subscription.unsubscribe();
  }, [form, onDirtyChange]);

  const onSubmit = async (data: MoveFundsFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      await moveBudgetFunds({
          householdId: householdId ?? undefined,
          fromCategoryId: data.fromCategoryId === 'unassigned' ? undefined : data.fromCategoryId as Id<"categories">,
          toCategoryId: data.categoryId === 'unassigned' ? undefined : data.categoryId as Id<'categories'>,
          amount: data.amount.replace(/,/g, ''),
          year,
          month
      });
      toast.success("Funds moved successfully");
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);

      if (errorMessage.includes("Budget not found")) {
          form.setError('root', { type: 'manual', message: errorMessage });
      } else if (errorMessage.includes("Insufficient") || errorString.includes("Insufficient")) {
          const match = (errorMessage + errorString).match(/Insufficient[^.]+\./);
          const cleanMessage = match ? match[0] : "Insufficient funds.";
          form.setError('amount', { type: 'manual', message: cleanMessage });
      } else {
          form.setError('root', { type: 'manual', message: errorMessage });
      }
      setIsProcessing(false);
      submitLock.current = false;
    }
  };

  const sourceOptions = budgetStatus?.data
    .filter(item => item.category._id !== categoryId && item.category.type === 'expense')
    .map(item => {
        const limit = item.budget ? parseFloat(item.budget.amount) : 0;
        const carryover = item.budget?.carryoverAmount ? parseFloat(item.budget.carryoverAmount) : 0;
        const effectiveLimit = limit + carryover;
        const remaining = Math.max(0, effectiveLimit - item.spent);
        return {
            id: item.category._id,
            name: item.category.name,
            limit,
            remaining,
            available: remaining
        };
    })
    .filter(opt => opt.available > 0) || [];

  const moveAmountParsed = parseFloat(amountValue?.replace(/,/g, '') || '0');

  const sourceBudgetItem = fromCategoryId && fromCategoryId !== 'unassigned'
    ? budgetStatus?.data?.find(i => i.category._id === fromCategoryId)
    : null;
  const sourceLimit = sourceBudgetItem?.budget ? parseFloat(sourceBudgetItem.budget.amount) : 0;
  const sourceCarryover = sourceBudgetItem?.budget?.carryoverAmount ? parseFloat(sourceBudgetItem.budget.carryoverAmount) : 0;
  const sourceEffectiveLimit = sourceLimit + sourceCarryover;
  const sourceSpent = sourceBudgetItem?.spent || 0;
  const sourceRemaining = Math.max(0, sourceEffectiveLimit - sourceSpent);
  const destBudgetItem = categoryId && categoryId !== 'unassigned'
    ? budgetStatus?.data?.find(i => i.category._id === categoryId)
    : null;
  const destLimit = destBudgetItem?.budget ? parseFloat(destBudgetItem.budget.amount) : 0;
  const destCarryover = destBudgetItem?.budget?.carryoverAmount ? parseFloat(destBudgetItem.budget.carryoverAmount) : 0;
  const destEffectiveLimit = destLimit + destCarryover;
  const destSpent = destBudgetItem?.spent || 0;
  const destRemaining = Math.max(0, destEffectiveLimit - destSpent);

  const sourceName = fromCategoryId === 'unassigned' ? 'Unassigned Cash'
    : sourceOptions.find(o => o.id === fromCategoryId)?.name || '';
  const destName = categoryId === 'unassigned' ? 'Unassigned Cash'
    : categories?.find(c => c._id === categoryId)?.name || '';

  return (
    <Drawer open={open} onOpenChange={handleOpenChangeWrapper}>
      <DrawerContent className="max-h-[96dvh]">
        <DrawerHeader>
          <DrawerTitle>Move Funds</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0 overflow-y-auto">
          <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                  control={form.control}
                  name="fromCategoryId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Move From (Source)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                          <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="unassigned">
                              <span className="flex items-center gap-2">
                                  <ArrowRightFromLine className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>Unassigned Cash</span>
                                  <span className="text-xs text-muted-foreground">({budgetStatus?.unassignedCash.toLocaleString() ?? '0'})</span>
                              </span>
                          </SelectItem>
                          {sourceOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                              <span className="flex items-center gap-2">
                                  <span>{opt.name}</span>
                                  <span className="text-xs text-muted-foreground">({opt.available.toLocaleString()} available)</span>
                              </span>
                          </SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />

              <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Destination</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                          <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {categories?.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                              {category.name}
                          </SelectItem>
                          ))}
                          <SelectItem value="unassigned">
                              <span className="flex items-center gap-2">
                              <Banknote className="h-3.5 w-3.5" />
                              <span>Return to Unassigned</span>
                              </span>
                          </SelectItem>
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />

              <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Amount to Move</FormLabel>
                      <FormControl>
                      {isMobile ? (
                          <button
                          type="button"
                          className="flex h-12 w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm active:scale-[0.99] transition-all"
                          onClick={() => setAmountSheetOpen(true)}
                          >
                          {amountValue ? (
                              <span className="text-foreground font-semibold tabular-nums">Rp {amountValue}</span>
                          ) : (
                              <span>Tap to enter amount</span>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                      ) : (
                          <Input
                          placeholder="0"
                          inputMode="decimal"
                          {...field}
                          onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(formatAmount(value));
                          }}
                          />
                      )}
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />

              {isMobile && (
                  <MobileAmountInput
                  open={amountSheetOpen}
                  onOpenChange={setAmountSheetOpen}
                  value={amountValue || ''}
                  onChange={(v) => form.setValue('amount', v)}
                  onDone={() => setAmountSheetOpen(false)}
                  />
              )}

              {moveAmountParsed > 0 && fromCategoryId && categoryId && fromCategoryId !== categoryId && (
                  <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
                  <div className="p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>

                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs text-destructive font-medium shrink-0">−</span>
                          <span className="text-sm truncate">{sourceName || 'Source'}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                          <span className="text-sm font-medium tabular-nums">
                          {fromCategoryId === 'unassigned' ? (
                              <>
                              <span className="text-muted-foreground line-through text-xs">{budgetStatus?.unassignedCash.toLocaleString() ?? '0'}</span>
                              <span className="ml-1.5 text-destructive">{((budgetStatus?.unassignedCash ?? 0) - moveAmountParsed).toLocaleString()}</span>
                              </>
                          ) : (
                              <>
                              <span className="text-muted-foreground line-through text-xs">{sourceRemaining.toLocaleString()}</span>
                              <span className="ml-1.5 text-destructive">{(sourceRemaining - moveAmountParsed).toLocaleString()}</span>
                              </>
                          )}
                          </span>
                      </div>
                      </div>

                      <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs text-success font-medium shrink-0">+</span>
                          <span className="text-sm truncate">{destName || 'Destination'}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                          <span className="text-sm font-medium tabular-nums">
                              {categoryId === 'unassigned' ? (
                                  <>
                                  <span className="text-muted-foreground line-through text-xs">{budgetStatus?.unassignedCash.toLocaleString() ?? '0'}</span>
                                  <span className="ml-1.5 text-success">{((budgetStatus?.unassignedCash ?? 0) + moveAmountParsed).toLocaleString()}</span>
                                  </>
                              ) : (
                                  <>
                                  <span className="text-muted-foreground line-through text-xs">{destRemaining > 0 ? destRemaining.toLocaleString() : '-'}</span>
                                  <span className="ml-1.5 text-success">{(destRemaining + moveAmountParsed).toLocaleString()}</span>
                                  </>
                              )}
                          </span>
                      </div>
                      </div>
                  </div>
                  </div>
              )}

              {fromCategoryId === categoryId && fromCategoryId && (
                  <p className="text-xs text-destructive text-center">Source and destination cannot be the same.</p>
              )}

              <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={isProcessing || (fromCategoryId === categoryId && !!fromCategoryId)}
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                    }}
                  >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Moving Funds...
                        </>
                      ) : (
                        'Move Funds'
                      )}
                  </Button>
                  <DrawerClose asChild>
                      <Button variant="outline" disabled={isProcessing}>Cancel</Button>
                  </DrawerClose>
              </div>
              </form>
          </Form>
        </div>
      </DrawerContent>
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepEditing}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
};

export default MoveFundsDrawer;
