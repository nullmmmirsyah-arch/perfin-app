import React, { useEffect, useMemo, useState, useRef } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
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
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PlusCircle, 
  AlertCircle, 
  Wallet, 
  LayoutGrid, 
  CalendarDays, 
  FileText, 
  ArrowRight,
  Tag,
  Loader2
} from 'lucide-react';
import { cn, formatCurrency, parseAmount } from '@/lib/utils';
import { Doc, Id } from '../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useHousehold } from '@/components/HouseholdProvider';
import { SplitEditorDrawer } from './SplitEditorDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileInputCard, MobileSelectionDrawer } from './ui/mobile-inputs';
import { TRANSACTION_TYPES, ACCOUNT_TYPES, CATEGORY_TYPES } from '../convex/lib/constants';

type TransactionWithDetails = Doc<'transactions'> & {
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  label?: Doc<'labels'> | null;
  splits?: Array<{
    categoryId: string;
    amount: string;
    description?: string;
    labelId?: string;
    categoryName?: string;
  }>;
};

// Adapted for use with api.budgets.getBudgetStatus
type CategoryOption = {
    _id: Id<'categories'>;
    name: string;
    type: string;
    budgetLimit?: number;
    remaining?: number;
};

const createTransactionFormSchema = (accounts: Doc<'accounts'>[]) => z.object({
  type: z.enum([
    TRANSACTION_TYPES.EXPENSE, 
    TRANSACTION_TYPES.INCOME, 
    TRANSACTION_TYPES.TRANSFER
  ]),
  amount: z.string()
    .min(1, "Amount is required")
    .refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
      message: 'Amount must be a number',
    })
    .refine(val => parseFloat(val.replace(/,/g, '')) > 0, {
      message: 'Amount must be greater than 0',
    }),
  date: z.date(),
  description: z.string().optional(),
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().optional(),
  toAccountId: z.string().optional(),
  isSplit: z.boolean().optional(),
  splits: z.array(z.object({
    categoryId: z.string().optional(),
    amount: z.string().optional(),
    description: z.string().optional(),
    labelId: z.string().optional(),
  })).optional(),
  labelId: z.string().optional(),
  assetDetails: z.object({
    quantity: z.string().optional(),
    unitPrice: z.number().optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.type === TRANSACTION_TYPES.TRANSFER) {
    if (!data.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'To account is required for transfers',
      });
    }
    if (data.accountId === data.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'From and To accounts cannot be the same',
      });
    }

    // Asset / Saving Transaction Logic
    const sourceAccount = accounts.find(a => a._id === data.accountId);
    const destAccount = accounts.find(a => a._id === data.toAccountId);
    
    // Helper to determine liquidity
    const isLiquid = (type?: string) => !type || type === ACCOUNT_TYPES.CASH;
    const sourceIsSpecial = !isLiquid(sourceAccount?.type);
    const destIsSpecial = !isLiquid(destAccount?.type);

    // Require category if ANY side involves a Special Account (Saving/Asset)
    const requiresCategory = sourceIsSpecial || destIsSpecial;

    if (requiresCategory) {
      if (!data.categoryId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['categoryId'],
            message: 'Category is required to track this Saving/Asset movement',
        });
      }
    }

    if (sourceAccount?.type === ACCOUNT_TYPES.ASSET || destAccount?.type === ACCOUNT_TYPES.ASSET) {
        if (!data.assetDetails?.quantity || parseFloat(data.assetDetails.quantity) <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['assetDetails', 'quantity'],
            message: 'Quantity/Weight is required for asset transfers',
        });
        }
    }

  } else {
    if (!data.isSplit && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'Category is required',
      });
    }
    if (data.isSplit) {
      if (!data.splits || data.splits.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['splits'],
          message: 'Splits are required for split transactions',
        });
      } else {
        let totalSplitAmount = 0;
        data.splits.forEach((split, index) => {
            if (!split.categoryId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['splits', index, 'categoryId'],
                    message: 'Category is required',
                });
            }
            if (!split.amount) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['splits', index, 'amount'],
                    message: 'Amount is required',
                });
            } else if (isNaN(parseFloat(split.amount.replace(/,/g, '')))) {
                 ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['splits', index, 'amount'],
                    message: 'Amount must be a number',
                });
            } else {
                totalSplitAmount += parseFloat(split.amount.replace(/,/g, ''));
            }
        });

        if (Math.abs(totalSplitAmount - parseFloat(data.amount.replace(/,/g, ''))) > 0.01) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['splits'],
            message: 'Total split amount must equal the total amount',
          });
        }
      }
    }
  }
});

type TransactionFormValues = z.infer<ReturnType<typeof createTransactionFormSchema>>;

type TransactionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionWithDetails;
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

// --- Main Wrapper Component ---
const TransactionDrawer = (props: TransactionDrawerProps) => {
  const isMobile = useIsMobile();
  const { open, onOpenChange, transaction } = props;
  const isEditMode = !!transaction;
  const title = isEditMode ? 'Edit transaction' : 'Create a new transaction';

  // State lifted from TransactionForm
  const [splitDrawerOpen, setSplitDrawerOpen] = useState(false);
  
  // New States for Navigation Safety
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  
  // History Management
  useEffect(() => {
    if (open) {
      // 1. Push State when Drawer Opens
      window.history.pushState({ drawer: 'transaction' }, '', window.location.href);

      const handlePopState = (event: PopStateEvent) => {
        // Handle Back Button Logic
        
        // Scenario A: Split Drawer is Open -> Close it
        if (splitDrawerOpen) {
           // We assume the split drawer pushed its own state or we handle it here.
           // Ideally, if we use a stacked approach:
           // If we are here, it means we popped a state.
           // If we managed split drawer with its own pushState, good.
           // Let's implement a simple robust check.
           setSplitDrawerOpen(false);
           // If we just popped the 'split' state, we are back to 'transaction' state.
           // If we didn't push a split state, we might have popped 'transaction' state.
           // To be safe, we always want to be in 'transaction' state if the main drawer is open.
           // But simply preventing the default back behavior is tricky.
           
           // Simple Strategy: Check if we need to restore state
           // If we want to stay on the page, we might need to push state back if we popped the LAST one.
           // But if we had 2 states (Base -> Tx -> Split), popping Split leaves us at Tx. Correct.
           return;
        }

        // Scenario B: Main Drawer Open (Split Closed) -> Check Dirty
        if (isDirty) {
            // User tried to go back but has unsaved changes.
            // 1. Restore the history state because we want to stay here for the dialog.
            window.history.pushState({ drawer: 'transaction' }, '', window.location.href);
            // 2. Show Confirmation
            setShowDiscardDialog(true);
        } else {
            // Scenario C: Clean State -> Allow Close
            onOpenChange(false);
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // Cleanup: If we are closing (and not because of back button), we might need to pop.
        // But doing this reliably is hard. 
        // Best effort: If we are still in the 'transaction' state according to history, back() it.
        // However, checking history.state is not always reliable across browsers.
        // We'll let the browser history naturally accumulate if user closes via UI, 
        // or we can try to back() if we know we pushed.
      };
    }
  }, [open, isDirty, splitDrawerOpen, onOpenChange]);

  // Nested History for Split Drawer
  useEffect(() => {
    if (splitDrawerOpen) {
        window.history.pushState({ drawer: 'split' }, '', window.location.href);
    }
  }, [splitDrawerOpen]);

  // Intercept UI Close Attempts (Clicking outside / Close Button)
  const handleOpenChangeWrapper = (newOpen: boolean) => {
      if (!newOpen) {
          // Attempting to close
          if (isDirty) {
              setShowDiscardDialog(true);
              return;
          }
           // If closing via UI, we should technically clean up history, but it's often optional.
           // Ideally: window.history.back();
           // But only if the top state is ours.
      }
      onOpenChange(newOpen);
  };

  const handleDiscard = () => {
      setShowDiscardDialog(false);
      setIsDirty(false); // Reset dirty so we don't loop
      onOpenChange(false);
  };

  const Content = (
      <div className="flex-1 overflow-y-auto px-4 pb-4">
         <TransactionForm 
            {...props} 
            isMobile={isMobile} 
            // Pass lifted props
            splitDrawerOpen={splitDrawerOpen}
            setSplitDrawerOpen={setSplitDrawerOpen}
            onDirtyChange={setIsDirty}
         />
      </div>
  );

  return (
    <>
        {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChangeWrapper}>
            <DrawerContent className="max-h-[96dvh] flex flex-col bg-background" onInteractOutside={(e) => {
                if(isDirty) {
                    e.preventDefault();
                    setShowDiscardDialog(true);
                }
            }}>
            <DrawerHeader className="sr-only">
                <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            
            {/* Visual Handle for Mobile */}
            <div className="pt-2 px-4 flex justify-center">
                <div className="w-12 h-1.5 bg-muted rounded-full mb-4" />
            </div>
            
            {Content}
            </DrawerContent>
        </Drawer>
        ) : (
        <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
            <DialogContent 
                className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0"
                onInteractOutside={(e) => {
                    if(isDirty) {
                        e.preventDefault();
                        setShowDiscardDialog(true);
                    }
                }}
            >
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2">
                 <TransactionForm 
                    {...props} 
                    isMobile={false} 
                    splitDrawerOpen={splitDrawerOpen}
                    setSplitDrawerOpen={setSplitDrawerOpen}
                    onDirtyChange={setIsDirty}
                 />
            </div>
            </DialogContent>
        </Dialog>
        )}

        <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Are you sure you want to discard them?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Discard
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
};

// --- Form Logic Component ---
const TransactionForm = ({ 
    open, 
    onOpenChange, 
    transaction, 
    isMobile,
    splitDrawerOpen,
    setSplitDrawerOpen,
    onDirtyChange
}: TransactionDrawerProps & { 
    isMobile: boolean,
    splitDrawerOpen: boolean,
    setSplitDrawerOpen: (open: boolean) => void,
    onDirtyChange: (isDirty: boolean) => void
}) => {
  const { householdId } = useHousehold();
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  
  // Removed local splitDrawerOpen state
  const [isProcessing, setIsProcessing] = useState(false);
  const submitLock = useRef(false);
  const editingTransactionId = useRef<string | null>(null);

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });
  const isEditMode = !!transaction;

  const formSchema = useMemo(() => createTransactionFormSchema(accounts || []), [accounts]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: TRANSACTION_TYPES.EXPENSE as any,
      amount: '',
      date: new Date(),
      description: '',
      accountId: '',
      isSplit: false,
      splits: [{ categoryId: '', amount: '', description: '', labelId: '' }],
      labelId: undefined,
      assetDetails: { quantity: '', unitPrice: undefined },
    }
  });

  const { formState: { isSubmitting, isDirty } } = form;

  // Sync dirty state with parent
  useEffect(() => {
      onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  // Re-validate splits when the sub-drawer closes to refresh error indicators
  const splitWasOpen = useRef(false);
  useEffect(() => {
    if (splitWasOpen.current && !splitDrawerOpen) {
        form.trigger('splits');
    }
    splitWasOpen.current = splitDrawerOpen;
  }, [splitDrawerOpen, form]);

  const transactionType = useWatch({ control: form.control, name: 'type' });
  const transactionDate = useWatch({ control: form.control, name: 'date' });
  
  // Dynamic Month/Year for Budget Status (Consistent with Dashboard)
  const selectedMonth = transactionDate ? transactionDate.getMonth() : new Date().getMonth();
  const selectedYear = transactionDate ? transactionDate.getFullYear() : new Date().getFullYear();

  // Use EXISTING budget status query
  const budgetStatus = useQuery(api.budgets.getBudgetStatus, { 
      householdId: householdId ?? undefined, 
      month: selectedMonth, 
      year: selectedYear 
  });

  // Also fetch simple categories list for Income (which might not be in budgetStatus fully if filtered)
  const allCategories = useQuery(api.categories.get, {
      householdId: householdId ?? undefined
  });

  // Merge Data
  const categories: CategoryOption[] = useMemo(() => {
      const typeFilter = transactionType === TRANSACTION_TYPES.TRANSFER ? CATEGORY_TYPES.SAVING : transactionType;
      
      // If Expense/Saving, prefer budgetStatus data
      if (typeFilter === TRANSACTION_TYPES.EXPENSE || typeFilter === CATEGORY_TYPES.SAVING) {
          if (!budgetStatus?.data) return [];
          
          return budgetStatus.data
            .filter(item => item.category.type === typeFilter)
            .map(item => {
                const allocated = item.budget ? parseFloat(item.budget.amount.replace(/,/g, '') || '0') : 0;
                const carryover = item.budget ? parseFloat(item.budget.carryoverAmount?.replace(/,/g, '') || '0') : 0;
                const limit = allocated + carryover;
                // remaining can be negative
                const remaining = limit - (item.spent || 0);
                
                return {
                    _id: item.category._id,
                    name: item.category.name,
                    type: item.category.type,
                    budgetLimit: limit,
                    remaining: remaining
                };
            });
      }
      
      // Fallback for Income (or if budgetStatus fails)
      if (!allCategories) return [];
      return allCategories
        .filter(c => c.type === typeFilter)
        .map(c => ({
            _id: c._id,
            name: c.name,
            type: c.type
        }));

  }, [transactionType, budgetStatus, allCategories]);

  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined });

  // Reset form when opening/closing or changing transaction
  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;

      if (isEditMode && transaction) {
        editingTransactionId.current = transaction._id;
        form.reset({
          type: transaction.type as any,
          amount: transaction.amount,
          date: new Date(transaction.date),
          description: transaction.description || '',
          accountId: transaction.accountId,
          categoryId: transaction.categoryId || undefined,
          toAccountId: transaction.toAccountId || undefined,
          isSplit: transaction.isSplit || false,
          splits: transaction.splits?.map(s => ({
            categoryId: s.categoryId,
            amount: s.amount,
            description: s.description || '',
            labelId: s.labelId || undefined,
          })) || [{ categoryId: '', amount: '', description: '', labelId: '' }],
          labelId: transaction.labelId || undefined,
          assetDetails: transaction.assetDetails ? {
            quantity: transaction.assetDetails.quantity,
            unitPrice: transaction.assetDetails.unitPrice,
          } : undefined,
        });
      } else {
        editingTransactionId.current = null;
        form.reset({
          type: TRANSACTION_TYPES.EXPENSE as any,
          amount: '',
          date: new Date(),
          description: '',
          accountId: '',
          isSplit: false,
          splits: [{ categoryId: '', amount: '', description: '', labelId: '' }],
          labelId: undefined,
          assetDetails: { quantity: '', unitPrice: undefined },
        });
      }
    }
  }, [open, isEditMode, transaction, form]);

  const { fields, append, replace, remove } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  const cashAccounts = useMemo(() => 
    accounts?.filter(a => !a.type || a.type === ACCOUNT_TYPES.CASH) || [], 
  [accounts]);

  const onSubmit = async (data: TransactionFormValues) => {
    if (submitLock.current || isProcessing) return;
    
    // Date Normalization Logic:
    // 1. If date is Today, use current time to keep the natural order of entries.
    // 2. If date is NOT Today (manual pick), set to 12:00 PM to avoid timezone shift bugs (e.g. 00:00 WIB -> 17:00 UTC prev day).
    const now = new Date();
    const selectedDate = new Date(data.date);
    // Always set to 12:00 PM (noon) local time to prevent UTC timezone shifts from changing the date.
    // This ensures transactions are assigned to the correct fiscal month regardless of time of entry.
    selectedDate.setHours(12, 0, 0, 0);
    const dateStr = selectedDate.toISOString();

    const assetDetails = data.assetDetails?.quantity 
      ? { quantity: data.assetDetails.quantity, unitPrice: data.assetDetails.unitPrice }
      : undefined;

    // Only send splits if isSplit is true, and ensure we don't send empty strings for IDs
    const finalSplits = data.isSplit 
      ? data.splits?.map(s => ({
          categoryId: s.categoryId as Id<'categories'>,
          amount: s.amount || '0',
          description: s.description,
          labelId: (s.labelId && s.labelId !== 'none' && s.labelId !== "") ? s.labelId as Id<'labels'> : undefined,
        }))
      : undefined;

    try {
        submitLock.current = true;
        setIsProcessing(true);

        if (editingTransactionId.current) {
            await updateTransaction({
              id: editingTransactionId.current as Id<'transactions'>,
              type: data.type,
              amount: data.amount,
              date: dateStr,
              description: data.description,
              accountId: data.accountId as Id<'accounts'>,
              categoryId: data.categoryId as Id<'categories'> | undefined,
              toAccountId: data.toAccountId as Id<'accounts'> | undefined,
              isSplit: data.isSplit,
              splits: finalSplits,
              labelId: (data.labelId && data.labelId !== 'none') ? data.labelId as Id<'labels'> : undefined,
              assetDetails,
            });
            toast.success("Transaction updated");
          } else {
            await createTransaction({
              householdId: householdId ?? undefined,
              type: data.type,
              amount: data.amount,
              date: dateStr,
              description: data.description,
              accountId: data.accountId as Id<'accounts'>,
              categoryId: data.categoryId as Id<'categories'> | undefined,
              toAccountId: data.toAccountId as Id<'accounts'> | undefined,
              isSplit: data.isSplit,
              splits: finalSplits,
              labelId: (data.labelId && data.labelId !== 'none') ? data.labelId as Id<'labels'> : undefined,
              assetDetails,
            });
            toast.success("Transaction created");
          }
          onOpenChange(false);
    } catch (error) {
        console.error(error);
        toast.error("Failed to save transaction");
        setIsProcessing(false);
        submitLock.current = false;
    }
  };

  const isSplit = useWatch({ control: form.control, name: 'isSplit' });
  const splits = useWatch({ control: form.control, name: 'splits' });

  const allocated = splits?.reduce((acc, split) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;
  const splitCount = splits?.length || 0;

  const handleSplitToggle = (checked: boolean) => {
      form.setValue('isSplit', checked);
      if (checked) {
          setSplitDrawerOpen(true);
          // Check current value directly from form to avoid stale state issues
          const currentSplits = form.getValues('splits');
          if (!currentSplits || currentSplits.length === 0) {
             // Use replace to ensure UI updates immediately
             replace([{ categoryId: '', amount: '', description: '', labelId: '' }]);
          }
      } else {
          // Clear splits when toggled off
          replace([]);
      }
  };
  
  const handleTabChange = (value: string) => {
    form.setValue('type', value as any);
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form Validation Errors:", errors);
          toast.error("Please check the form for errors");
        })} className="space-y-4 flex-1 flex flex-col h-full">
          <Tabs value={transactionType} className="w-full" onValueChange={(v) => form.setValue('type', v as any)}>
            <TabsList className={cn(
              "p-1 w-full mb-6",
              isMobile ? "bg-muted/50 rounded-full h-12 flex items-center" : "grid grid-cols-3 h-11 bg-muted/30"
            )}>
              {[TRANSACTION_TYPES.EXPENSE, TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.TRANSFER].map(t => (
                <TabsTrigger 
                  key={t} 
                  value={t} 
                  className={cn(
                    "rounded-full transition-all duration-200 font-semibold text-xs uppercase tracking-wider",
                    isMobile ? "h-10 flex-1" : "h-9",
                    // Custom active states for each tab type
                    t === TRANSACTION_TYPES.EXPENSE && "data-[state=active]:bg-destructive! data-[state=active]:text-destructive-foreground! shadow-sm",
                    t === TRANSACTION_TYPES.INCOME && "data-[state=active]:bg-success! data-[state=active]:text-success-foreground! shadow-sm",
                    t === TRANSACTION_TYPES.TRANSFER && "data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground! shadow-sm"
                  )}
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="">
                <TabsContent value={TRANSACTION_TYPES.EXPENSE} className="space-y-4 mt-0 outline-none">
                  <TransactionFormFields 
                    form={form} 
                    categories={categories || []} 
                    accounts={cashAccounts} 
                    labels={labels || []} 
                    onSplitToggle={handleSplitToggle}
                    splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                    onEditSplit={() => setSplitDrawerOpen(true)}
                    isMobile={isMobile}
                    open={open}
                  />
                </TabsContent>
                <TabsContent value={TRANSACTION_TYPES.INCOME} className="space-y-4 mt-0 outline-none">
                  <TransactionFormFields 
                    form={form} 
                    categories={categories || []} 
                    accounts={cashAccounts} 
                    labels={labels || []} 
                    onSplitToggle={handleSplitToggle}
                    splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                    onEditSplit={() => setSplitDrawerOpen(true)}
                    isMobile={isMobile}
                    open={open}
                  />
                </TabsContent>
                <TabsContent value={TRANSACTION_TYPES.TRANSFER} className="space-y-4 mt-0 outline-none">
                  <TransferFormFields 
                    form={form} 
                    accounts={accounts || []} 
                    labels={labels || []} 
                    categories={categories || []} 
                    isMobile={isMobile} 
                  />
                </TabsContent>
            </div>
          </Tabs>

           {/* Footer Rendering */}
           {isMobile ? (
              <div className="mt-auto pt-6 pb-2">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isProcessing}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  className="w-full rounded-full h-14 text-base font-semibold shadow-lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Transaction <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
           ) : (
              <div className="flex justify-end gap-2 border-t -mx-6 pt-4 px-6 mt-6">
                 <DialogClose asChild>
                    <Button variant="outline" type="button" disabled={isProcessing}>Cancel</Button>
                 </DialogClose>
                 <Button 
                   type="submit" 
                   disabled={isProcessing}
                   onClick={() => {
                     if (navigator.vibrate) navigator.vibrate(10);
                   }}
                 >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save changes"
                    )}
                 </Button>
              </div>
           )}
        </form>

      <SplitEditorDrawer 
        open={splitDrawerOpen} 
        onOpenChange={setSplitDrawerOpen}
        form={form}
        categories={categories || []}
        labels={labels || []}
        fields={fields}
        append={append}
        remove={remove}
      />
    </Form>
  );
}

const TransactionFormFields = ({ 
    form, categories, accounts, labels, onSplitToggle, splitSummary, onEditSplit, isMobile, open 
}: { 
    form: UseFormReturn<TransactionFormValues>, 
    categories: CategoryOption[], 
    accounts: Doc<'accounts'>[], 
    labels: Doc<'labels'>[],
    onSplitToggle?: (checked: boolean) => void,
    splitSummary?: { count: number, total: number },
    onEditSplit?: () => void,
    isMobile?: boolean,
    open?: boolean
}) => {
  const isSplit = useWatch({ control: form.control, name: 'isSplit' });
  const type = useWatch({ control: form.control, name: 'type' });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const accountId = useWatch({ control: form.control, name: 'accountId' });
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const labelId = useWatch({ control: form.control, name: 'labelId' });
  
  const descriptionRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const selectedAccount = accounts.find(a => a._id === accountId);
  const selectedCategory = categories.find(c => c._id === categoryId);
  const selectedLabel = labels?.find(l => l._id === labelId);

  const amountValue = parseAmount(amount);
  const balanceValue = parseAmount(selectedAccount?.balance);
  
  // Logic for Edit Mode to prevent false "Insufficient Balance"
  const originalAmount = form.formState.defaultValues?.amount 
      ? parseAmount(form.formState.defaultValues.amount) 
      : 0;
  
  const isEditingSameAccount = form.formState.defaultValues?.accountId === accountId;
  const effectiveAmountToCheck = isEditingSameAccount ? (amountValue - originalAmount) : amountValue;

  const isOverspent = (type === TRANSACTION_TYPES.EXPENSE || type === TRANSACTION_TYPES.TRANSFER) && 
                      selectedAccount && 
                      effectiveAmountToCheck > balanceValue;

  // SAFE AUTO-FOCUS: Trigger every time 'open' becomes true.
  const amountInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
          amountInputRef.current?.focus({ preventScroll: true });
      }, 250); // Slightly increased to 250ms for better stability
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Helper to merge refs
  const mergeRefs = (...refs: any[]) => (value: any) => {
    refs.forEach(ref => {
      if (typeof ref === 'function') ref(value);
      else if (ref != null) ref.current = value;
    });
  };

  return (
    <>
      <div className={cn(isMobile && "space-y-6")}>
          {/* AMOUNT FIELD */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className={cn(isMobile ? "mb-2" : "")}>
                {!isMobile && <FormLabel>Amount</FormLabel>}
                <FormControl>
                  {isMobile ? (
                      <div className="relative flex flex-col items-center justify-center py-4">
                        <div className="flex items-start justify-center gap-1 text-foreground">
                            <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                            <Input
                                {...field}
                                ref={mergeRefs(amountInputRef, field.ref)}
                                placeholder="0"
                                inputMode="numeric"
                                enterKeyHint="next"
                                className={cn(
                                    "h-auto p-0 text-5xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors w-full min-w-[100px]",
                                    isOverspent ? "text-destructive" : "text-foreground"
                                )}
                                value={field.value || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(formatNumber(value));
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                    }
                                }}
                            />
                        </div>
                        {isOverspent && (
                            <div className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                                <AlertCircle className="h-3 w-3" /> Insufficient Balance
                            </div>
                        )}
                        <div className="h-1 w-16 bg-primary/20 rounded-full mt-4" />
                      </div>
                  ) : (
                    <Input
                        placeholder="0"
                        inputMode="numeric"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(formatNumber(value));
                        }}
                    />
                  )}
                </FormControl>
                <FormMessage className={cn(isMobile && "text-center")} />
              </FormItem>
            )}
          />

          {/* CARD INPUTS FOR MOBILE */}
          {isMobile ? (
             <div className="space-y-3">
                <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MobileSelectionDrawer
                                    title="Select Account"
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={accounts.map(acc => ({
                                        value: acc._id,
                                        label: acc.name,
                                        subLabel: `Balance: ${formatCurrency(acc.balance)}`
                                    }))}
                                    trigger={
                                        <button type="button" className="w-full text-left outline-none">
                                            <MobileInputCard 
                                                label="Account" 
                                                icon={Wallet} 
                                                valueDisplay={selectedAccount?.name}
                                                subValueDisplay={selectedAccount ? `Balance: ${formatCurrency(selectedAccount.balance)}` : undefined}
                                            />
                                        </button>
                                    }
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-3">
                    <div className="flex-1">
                        {!isSplit ? (
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MobileSelectionDrawer
                                                title="Select Category"
                                                value={field.value}
                                                onSelect={(val) => {
                                                    if (val === 'ACTION_SPLIT') {
                                                        onSplitToggle?.(true);
                                                        setTimeout(() => onEditSplit?.(), 0);
                                                        return;
                                                    }
                                                    field.onChange(val);
                                                }}
                                                options={[
                                                    { value: 'ACTION_SPLIT', label: '🔀 Split Transaction', subLabel: 'Divide into multiple categories', isAction: true },
                                                    ...categories.map(cat => ({
                                                        value: cat._id,
                                                        label: cat.name,
                                                        subLabel: cat.type === CATEGORY_TYPES.EXPENSE && (cat.budgetLimit || 0) > 0 
                                                            ? `Available: ${formatCurrency(cat.remaining)}` 
                                                            : undefined
                                                    }))
                                                ]}
                                                trigger={
                                                    <button type="button" className="w-full text-left outline-none">
                                                        <MobileInputCard 
                                                            label="Category" 
                                                            icon={LayoutGrid}
                                                            valueDisplay={selectedCategory?.name}
                                                            subValueDisplay={selectedCategory?.type === CATEGORY_TYPES.EXPENSE && (selectedCategory.budgetLimit || 0) > 0 
                                                                ? `Avail: ${formatCurrency(selectedCategory.remaining)}` 
                                                                : undefined
                                                            }
                                                        />
                                                    </button>
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <div 
                                className={cn(
                                    "rounded-2xl p-4 shadow-sm border border-dashed relative active:scale-[0.99] transition-transform flex items-center justify-between cursor-pointer",
                                    form.formState.errors.splits 
                                        ? "bg-destructive/5 border-destructive border-solid" 
                                        : "bg-card border-primary/50"
                                )}
                                onClick={onEditSplit}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                        form.formState.errors.splits ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                                    )}>
                                        <LayoutGrid className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Category</p>
                                        <p className={cn("font-semibold", form.formState.errors.splits ? "text-destructive" : "text-primary")}>
                                            Split Transaction
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {splitSummary?.count} Items • {formatCurrency(splitSummary?.total)}
                                        </p>
                                        {form.formState.errors.splits && (
                                            <p className="text-[10px] font-bold text-destructive mt-1 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> Fix Errors
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <ArrowRight className={cn("h-5 w-5", form.formState.errors.splits ? "text-destructive" : "text-muted-foreground/50")} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem className={cn("flex flex-col", isSplit && "col-span-2")}>
                                <FormControl>
                                    <MobileSelectionDrawer
                                        title="Select Date"
                                        trigger={
                                            <button type="button" className="w-full text-left outline-none">
                                                <MobileInputCard label="Date" icon={CalendarDays} valueDisplay={field.value ? field.value.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Pick'} />
                                            </button>
                                        }
                                    >
                                        {({ close }) => (
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(date) => {
                                                    if(date) {
                                                        field.onChange(date);
                                                        close();
                                                    }
                                                }}
                                                disabled={(date) =>
                                                    date > new Date() || date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        )}
                                    </MobileSelectionDrawer>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {!isSplit && (
                        <FormField
                            control={form.control}
                            name="labelId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MobileSelectionDrawer
                                            title="Select Label"
                                            value={field.value}
                                            onSelect={field.onChange}
                                            options={[
                                                { value: 'none', label: 'None' },
                                                ...(labels?.map(lbl => ({
                                                    value: lbl._id,
                                                    label: lbl.name
                                                })) || [])
                                            ]}
                                            trigger={
                                                <button type="button" className="w-full text-left outline-none">
                                                    <MobileInputCard label="Label" icon={Tag} valueDisplay={selectedLabel?.name || "None"} />
                                                </button>
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                {!isSplit && (
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                                <div className="flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                                        <Textarea 
                                            placeholder="Write a note..." 
                                            className="min-h-[60px] border-none shadow-none resize-none p-0 focus-visible:ring-0 text-base" 
                                            enterKeyHint="done"
                                            {...field}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    />
                )}
                
                {/* Split Toggle Button - Only Revert Option Remaining */}
                {isSplit && (
                    <div 
                        className="flex items-center justify-center gap-2 py-2 cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => onSplitToggle?.(false)}
                    >
                        <span className="text-sm font-medium">Revert to Single Category</span>
                    </div>
                )}

             </div>
          ) : (
             // DESKTOP LAYOUT (Standard)
             <>
                <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                    <FormItem>
                        <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select an account" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {accounts.map(account => (
                            <SelectItem key={account._id} value={account._id}>
                                <div className="flex w-full items-center justify-between gap-4">
                                    <span className="font-medium truncate">{account.name}</span>
                                    <span className="text-muted-foreground text-xs font-normal shrink-0">
                                        {formatCurrency(account.balance)}
                                    </span>
                                </div>
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                
                {/* ... (Existing Desktop Fields Logic for Category, Date, etc.) ... */}
                {/* Reusing existing logic blocks inside standard layout */}
                <FormItem className="space-y-2">
                    <div className="flex items-center justify-between">
                        <FormLabel className="mb-0">Category</FormLabel>
                        {isSplit && (
                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onEditSplit}>
                                Edit Splits
                            </Button>
                        )}
                        {/* Revert option for Desktop */}
                        {isSplit && (
                            <Button 
                                type="button" 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive ml-2" 
                                onClick={() => onSplitToggle?.(false)}
                            >
                                (Revert)
                            </Button>
                        )}
                    </div>

                    {!isSplit ? (
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                        <>
                            <Select 
                                onValueChange={(val) => {
                                    if (val === 'ACTION_SPLIT') {
                                        onSplitToggle?.(true);
                                        // Small timeout to allow re-render before opening drawer
                                        setTimeout(() => onEditSplit?.(), 0);
                                        return;
                                    }
                                    field.onChange(val);
                                }} 
                                value={field.value} 
                                key={field.value}
                            >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="ACTION_SPLIT" className="font-semibold text-primary">
                                        🔀 Split Transaction
                                    </SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                                <SelectGroup>
                                    <SelectLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 py-2">My Categories</SelectLabel>
                                    {categories.map(category => {
                                        const showBudget = category.type === CATEGORY_TYPES.EXPENSE && (category.budgetLimit || 0) > 0;
                                        const remaining = category.remaining || 0;
                                        const isLow = remaining < 0;

                                        return (
                                        <SelectItem key={category._id} value={category._id}>
                                            <div className="flex w-full items-center justify-between gap-4">
                                                <span className="font-medium truncate">{category.name}</span>
                                                {showBudget && (
                                                    <span className={cn(
                                                        "text-xs font-normal shrink-0",
                                                        isLow ? "text-destructive" : "text-muted-foreground"
                                                    )}>
                                                        Avail: {formatCurrency(remaining)}
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                        );
                                    })}
                                </SelectGroup>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </>
                        )}
                    />
                    ) : (
                        <div 
                            className={cn(
                                "p-3 border rounded-md flex items-center justify-between cursor-pointer transition-colors",
                                form.formState.errors.splits 
                                    ? "bg-destructive/10 border-destructive hover:bg-destructive/20" 
                                    : "bg-muted/30 hover:bg-muted/50"
                            )}
                            onClick={onEditSplit}
                        >
                            <div className="space-y-1">
                                <p className={cn("text-sm font-medium", form.formState.errors.splits ? "text-destructive" : "")}>
                                    {splitSummary?.count || 0} Items
                                </p>
                                <p className={cn("text-xs", form.formState.errors.splits ? "text-destructive/80" : "text-muted-foreground")}>
                                    Total: {new Intl.NumberFormat().format(splitSummary?.total || 0)}
                                </p>
                                {form.formState.errors.splits && (
                                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wide flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" /> Check Errors
                                    </p>
                                )}
                            </div>
                            <div className={cn("border rounded-full p-1", form.formState.errors.splits ? "bg-destructive/10 border-destructive" : "bg-background")}>
                                <PlusCircle className={cn("h-4 w-4", form.formState.errors.splits ? "text-destructive" : "text-muted-foreground")} />
                            </div>
                        </div>
                    )}
                </FormItem>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                            <DatePicker 
                                date={field.value}
                                setDate={field.onChange}
                                disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                            />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="labelId"
                        render={({ field }) => (
                        <FormItem>
                                        <FormLabel>Label</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} key={field.value}>                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select a label (optional)" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {labels?.map(label => (
                                <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                        <Input placeholder="Add a description" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
             </>
          )}
      </div>
    </>
  );
};

const TransferFormFields = ({ form, accounts, labels, categories, isMobile }: { form: UseFormReturn<TransactionFormValues>, accounts: Doc<'accounts'>[], labels: Doc<'labels'>[], categories: CategoryOption[], isMobile?: boolean }) => {
  // Transfer form fields logic remains largely the same, but we can apply the card style here too if needed.
  // For brevity, I'll apply the same MobileInputCard pattern here.
  
  const fromAccountId = useWatch({ control: form.control, name: 'accountId' });
  const toAccountId = useWatch({ control: form.control, name: 'toAccountId' });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const quantity = useWatch({ control: form.control, name: 'assetDetails.quantity' });

  // Prefill category if destination account has a linked category
  useEffect(() => {
    if (toAccountId) {
      const destAccount = accounts.find(a => a._id === toAccountId);
      if (destAccount?.linkedCategoryId) {
        form.setValue('categoryId', destAccount.linkedCategoryId);
      }
    }
  }, [toAccountId, accounts, form]);

  const fromAccount = accounts.find(a => a._id === fromAccountId);
  const toAccount = accounts.find(a => a._id === toAccountId);
  
  // Helper to determine liquidity
  const isLiquid = (type?: string) => !type || type === ACCOUNT_TYPES.CASH;
  const sourceIsSpecial = !isLiquid(fromAccount?.type);
  const destIsSpecial = !isLiquid(toAccount?.type);

  // Show category selector if ANY side involves a Special Account
  const showCategory = sourceIsSpecial || destIsSpecial;
  
  const isAssetTransaction = fromAccount?.type === ACCOUNT_TYPES.ASSET || toAccount?.type === ACCOUNT_TYPES.ASSET;

  // Auto-linked category logic
  const linkedCategory = useMemo(() => {
      const linkedId = toAccount?.linkedCategoryId || fromAccount?.linkedCategoryId;
      return categories.find(c => c._id === linkedId);
  }, [toAccount, fromAccount, categories]);

  let amountLabel = 'Amount';
  if (fromAccount?.type !== ACCOUNT_TYPES.ASSET && toAccount?.type === ACCOUNT_TYPES.ASSET) {
    amountLabel = 'Total Cost'; // Buy
  } else if (fromAccount?.type === ACCOUNT_TYPES.ASSET && toAccount?.type !== ACCOUNT_TYPES.ASSET) {
    amountLabel = 'Total Sale Value'; // Sell
  }

  const amountValue = parseAmount(amount);
  const fromBalanceValue = parseAmount(fromAccount?.balance);

  // Logic for Edit Mode to prevent false "Insufficient Balance"
  const originalAmount = form.formState.defaultValues?.amount 
      ? parseAmount(form.formState.defaultValues.amount) 
      : 0;

  const isEditingSameAccount = form.formState.defaultValues?.accountId === fromAccountId;
  const effectiveAmountToCheck = isEditingSameAccount ? (amountValue - originalAmount) : amountValue;

  const isOverspent = fromAccount && effectiveAmountToCheck > fromBalanceValue;

  const parsedAmount = parseFloat(amount?.replace(/,/g, '') || '0');
  const parsedQuantity = parseFloat(quantity || '0');
  const impliedPrice = parsedQuantity > 0 ? parsedAmount / parsedQuantity : 0;

  return (
    <>
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem className={cn(isMobile && "mb-8")}>
            <FormLabel className={cn(isMobile && "text-center block text-muted-foreground uppercase text-[10px] font-bold tracking-widest")}>
              {amountLabel}
            </FormLabel>
            <FormControl>
              {isMobile ? (
                  <div className="relative group">
                    <div className="flex items-start justify-center gap-1 text-foreground">
                        <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                        <Input
                            placeholder="0"
                            inputMode="numeric"
                            enterKeyHint="next"
                            className={cn(
                                "h-auto p-0 text-6xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors w-full min-w-[100px]",
                                isOverspent ? "text-destructive" : "text-foreground"
                            )}
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(formatNumber(value));
                            }}
                        />
                    </div>
                    {isOverspent && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" /> Insufficient Balance
                        </div>
                    )}
                    <div className="h-1 w-16 bg-primary/20 rounded-full mt-4 mx-auto" />
                  </div>
              ) : (
                <Input
                    placeholder="0"
                    inputMode="numeric"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(formatNumber(value));
                    }}
                />
              )}
            </FormControl>
            <FormMessage className={cn(isMobile && "text-center")} />
          </FormItem>
        )}
      />

      {isMobile ? (
          <div className="space-y-3">
             <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <MobileSelectionDrawer
                                title="From Account"
                                value={field.value}
                                onSelect={field.onChange}
                                options={accounts.map(acc => ({
                                    value: acc._id,
                                    label: acc.name,
                                    subLabel: `Balance: ${formatCurrency(acc.balance)}`
                                }))}
                                trigger={
                                    <button type="button" className="w-full text-left outline-none">
                                        <MobileInputCard 
                                            label="From Account" 
                                            icon={Wallet} 
                                            valueDisplay={fromAccount?.name}
                                            subValueDisplay={fromAccount ? `Balance: ${formatCurrency(fromAccount.balance)}` : undefined}
                                        />
                                    </button>
                                }
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="toAccountId"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <MobileSelectionDrawer
                                title="To Account"
                                value={field.value}
                                onSelect={field.onChange}
                                options={accounts.map(acc => ({
                                    value: acc._id,
                                    label: acc.name,
                                    subLabel: `Balance: ${formatCurrency(acc.balance)}`
                                }))}
                                trigger={
                                    <button type="button" className="w-full text-left outline-none">
                                        <MobileInputCard 
                                            label="To Account" 
                                            icon={ArrowRight} 
                                            valueDisplay={toAccount?.name}
                                            subValueDisplay={toAccount ? `Balance: ${formatCurrency(toAccount.balance)}` : undefined}
                                        />
                                    </button>
                                }
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-2 gap-3">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                         <div className="relative">
                            <MobileSelectionDrawer
                                title="Select Date"
                                trigger={
                                    <button type="button" className="w-full text-left outline-none">
                                        <MobileInputCard label="Date" icon={CalendarDays} valueDisplay={field.value ? field.value.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Pick'} />
                                    </button>
                                }
                            >
                                {({ close }) => (
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={(date) => {
                                            if(date) {
                                                field.onChange(date);
                                                close();
                                            }
                                        }}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                )}
                            </MobileSelectionDrawer>
                        </div>
                    )}
                />
                
                {showCategory && (
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MobileSelectionDrawer
                                        title="Category"
                                        value={field.value}
                                        onSelect={field.onChange}
                                        options={categories.map(cat => ({
                                            value: cat._id,
                                            label: cat.name,
                                            subLabel: linkedCategory?.name === cat.name ? '(Linked)' : undefined
                                        }))}
                                        trigger={
                                            <button type="button" className="w-full text-left outline-none">
                                                <MobileInputCard label="Category" icon={LayoutGrid} valueDisplay={linkedCategory?.name || "Select"} />
                                            </button>
                                        }
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                )}
            </div>

            {isAssetTransaction && (
                <FormField
                    control={form.control}
                    name="assetDetails.quantity"
                    render={({ field }) => (
                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                    <Tag className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Quantity/Weight</p>
                                    <Input 
                                        type="number" 
                                        step="any" 
                                        placeholder="0.00" 
                                        className="h-auto p-0 border-none shadow-none text-lg font-semibold focus-visible:ring-0" 
                                        {...field}
                                    />
                                    {parsedAmount > 0 && parsedQuantity > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            @ {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(impliedPrice)} / unit
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                />
            )}

            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                                <Textarea 
                                    placeholder="Write a note..." 
                                    className="min-h-[60px] border-none shadow-none resize-none p-0 focus-visible:ring-0 text-base" 
                                    enterKeyHint="done"
                                    {...field}
                                />
                            </div>
                        </div>
                    </div>
                )}
            />
          </div>
      ) : (
          <div className="grid grid-cols-2 gap-4">
             <FormField control={form.control} name="accountId" render={({ field }) => (
                <FormItem><FormLabel>From</FormLabel><Select onValueChange={field.onChange} value={field.value} key={field.value}><SelectTrigger><SelectValue placeholder="From" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
             )} />
             <FormField control={form.control} name="toAccountId" render={({ field }) => (
                <FormItem><FormLabel>To</FormLabel><Select onValueChange={field.onChange} value={field.value} key={field.value}><SelectTrigger><SelectValue placeholder="To" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
             )} />
          </div>
      )}
    </>
  );
};

export default TransactionDrawer;