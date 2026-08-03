import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch"
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
  FileText, 
  ArrowRight,
  Tag,
  Store,
  Loader2,
} from '@/components/ui/icons';
import { cn, formatCurrency, parseAmount } from '@/lib/utils';
import { Doc, Id } from '../convex/_generated/dataModel';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { drawerFieldStagger, drawerFieldItem, shake } from '@/lib/animations';
import { useHousehold } from '@/components/HouseholdProvider';
import { SplitEditorDrawer } from './SplitEditorDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { MobileInputCard, MobileSelectionDrawer } from './ui/mobile-inputs';
import MerchantCombobox from './MerchantCombobox';
import LabelCombobox from './LabelCombobox';
import { MobileAmountInput } from './mobile-amount-input';
import { MobileDatePicker } from '@/components/ui/mobile-date-picker';
import { TRANSACTION_TYPES, ACCOUNT_TYPES, CATEGORY_TYPES } from '../convex/lib/constants';
import { getFiscalDateDetails } from '@/lib/finance-utils';
import TransactionSuccessView from './TransactionSuccessView';
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

type TransactionWithDetails = Doc<'transactions'> & {
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  label?: Doc<'labels'> | null;
  merchant?: Doc<'merchants'> | null;
  splits?: Array<{
    categoryId: string;
    amount: string;
    description?: string;
    labelIds?: string[];
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
    labelIds: z.array(z.string()).optional(),
  })).optional(),
  labelIds: z.array(z.string()).optional(),
  merchantId: z.string().optional(),
  assetDetails: z.object({
    quantity: z.string().optional(),
    unitPrice: z.number().optional(),
  }).optional(),
  // Receivables
  isReimbursable: z.boolean().optional(),
  owedBy: z.string().optional(),
  reimbursementStatus: z.union([
    z.literal("pending"),
    z.literal("settled"),
    z.literal("forgiven"),
  ]).optional(),
}).superRefine((data, ctx) => {
  if (data.isReimbursable && !data.owedBy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['owedBy'],
        message: 'Name of person/entity is required',
      });
  }

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
  initialData?: Partial<TransactionFormValues> & { parentTransactionId?: string };
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
  
  // Defensive lock to prevent re-triggering the dialog after choosing "Keep Editing"
  const [isLocked, setIsLocked] = useState(false);

  type SuccessStep = "form" | "success";
  const [step, setStep] = useState<SuccessStep>("form");
  const [savedData, setSavedData] = useState<{
    amount: number;
    categoryName: string;
    overallRemaining: number | null;
    categoryRemaining: number | null;
    categoryBudgetTotal: number | null;
    affectedCategoryId: string;
    householdId: string | null;
    month: number;
    year: number;
    displayName: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep("form");
        setSavedData(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // History Management
  useEffect(() => {
    if (open) {
      window.history.pushState({ drawer: 'transaction' }, '', window.location.href);

      const handlePopState = (event: PopStateEvent) => {
        if (splitDrawerOpen) {
           setSplitDrawerOpen(false);
           return;
        }

        if (isDirty) {
            // Restore state and show dialog
            window.history.pushState({ drawer: 'transaction' }, '', window.location.href);
            setShowDiscardDialog(true);
        } else {
            onOpenChange(false);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [open, isDirty, splitDrawerOpen, onOpenChange]);

  // Nested History for Split Drawer
  useEffect(() => {
    if (splitDrawerOpen) {
        window.history.pushState({ drawer: 'split' }, '', window.location.href);
    }
  }, [splitDrawerOpen]);

  const handleKeepEditing = () => {
      setShowDiscardDialog(false);
      // Lock all close attempts for 500ms to allow UI to stabilize
      setIsLocked(true);
      setTimeout(() => setIsLocked(false), 500);
  };

  const handleOpenChangeWrapper = (newOpen: boolean) => {
      // If we are in a locked state, ignore the request to close
      if (!newOpen && isLocked) {
          return;
      }

      if (!newOpen && isDirty) {
          if (!showDiscardDialog) setShowDiscardDialog(true);
          return;
      }
      onOpenChange(newOpen);
  };

  const handleDiscard = () => {
      setShowDiscardDialog(false);
      setIsDirty(false); // Reset dirty so we don't loop
      onOpenChange(false);
  };

  const handleDismiss = useCallback(() => {
    if (isLocked) return;
    onOpenChange(false);
  }, [isLocked, onOpenChange]);

  const Content = step === "success" && savedData ? (
    <TransactionSuccessView
      {...savedData}
      onDismiss={handleDismiss}
    />
  ) : (
      <div className="flex-1 overflow-y-auto px-4 pb-4">
         <TransactionForm 
            {...props} 
            isMobile={isMobile} 
            splitDrawerOpen={splitDrawerOpen}
            setSplitDrawerOpen={setSplitDrawerOpen}
            onDirtyChange={setIsDirty}
            onSaveSuccess={(data) => {
              setIsDirty(false);
              setSavedData(data);
              setStep("success");
            }}
         />
      </div>
  );

  return (
    <>
        {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChangeWrapper}>
            <DrawerContent className="max-h-[96dvh] flex flex-col bg-background">
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
        <Sheet open={open} onOpenChange={handleOpenChangeWrapper}>
            <SheetContent 
                side="right"
                className="sm:max-w-[500px] flex flex-col p-0 gap-0"
            >
            <SheetHeader className="p-6 pb-2">
                <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2">
                 {step === "success" && savedData ? (
                   <TransactionSuccessView
                     {...savedData}
                     onDismiss={handleDismiss}
                   />
                 ) : (
                 <TransactionForm 
                    {...props} 
                    isMobile={false} 
                    splitDrawerOpen={splitDrawerOpen}
                    setSplitDrawerOpen={setSplitDrawerOpen}
                    onDirtyChange={setIsDirty}
                    onSaveSuccess={(data) => {
                      setIsDirty(false);
                      setSavedData(data);
                      setStep("success");
                    }}
                 />
                 )}
            </div>
            </SheetContent>
        </Sheet>
        )}

        <AlertDialog 
            open={showDiscardDialog} 
            onOpenChange={(isOpen) => {
                if (!isOpen) handleKeepEditing();
                else setShowDiscardDialog(true);
            }}
        >
            <AlertDialogContent className="z-100" onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Are you sure you want to discard them?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Button variant="outline" onClick={handleKeepEditing} className="mt-2 sm:mt-0">
                        Keep Editing
                    </Button>
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
    initialData,
    isMobile,
    splitDrawerOpen,
    setSplitDrawerOpen,
    onDirtyChange,
    onSaveSuccess
}: TransactionDrawerProps & { 
    isMobile: boolean,
    splitDrawerOpen: boolean,
    setSplitDrawerOpen: (open: boolean) => void,
    onDirtyChange: (isDirty: boolean) => void,
    onSaveSuccess: (data: { amount: number; categoryName: string; overallRemaining: number | null; categoryRemaining: number | null; categoryBudgetTotal: number | null; affectedCategoryId: string; householdId: string | null; month: number; year: number; displayName: string }) => void,
}) => {
  const { householdId, households } = useHousehold();
  const { user } = useUser();
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  
  // Removed local splitDrawerOpen state
  const [isProcessing, setIsProcessing] = useState(false);
  const submitLock = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const editingTransactionId = useRef<string | null>(null);
  const isSettlement = !!initialData?.parentTransactionId;

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined, includeAll: true });
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
      splits: [{ categoryId: '', amount: '', description: '', labelIds: [] }],
      labelIds: [],
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
  
  // Dynamic Month/Year for Budget Status (Fiscal-aware, consistent with Dashboard)
  const activeHousehold = households?.find(h => h._id === householdId);
  const displayName = activeHousehold?.name ?? user?.firstName ?? "";
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;
  const dateStr = transactionDate ? transactionDate.toISOString() : new Date().toISOString();
  const { month: selectedMonth, year: selectedYear } = getFiscalDateDetails(dateStr, budgetStartDay);

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
      const initialCatId = initialData?.categoryId;
      
      // If Expense/Saving, prefer budgetStatus data
      if (typeFilter === TRANSACTION_TYPES.EXPENSE || typeFilter === CATEGORY_TYPES.SAVING) {
          if (!budgetStatus?.data) return [];
          
          const filtered = budgetStatus.data
            .filter(item => item.category.type === typeFilter || item.category._id === initialCatId)
            .map(item => {
                const allocated = item.budget ? parseFloat(item.budget.amount.replace(/,/g, '') || '0') : 0;
                const carryover = item.budget ? parseFloat(item.budget.carryoverAmount?.replace(/,/g, '') || '0') : 0;
                const limit = allocated + carryover;
                const remaining = limit - (item.spent || 0);
                
                return {
                    _id: item.category._id,
                    name: item.category.name,
                    type: item.category.type,
                    budgetLimit: limit,
                    remaining: remaining
                };
            });
          return filtered;
      }
      
      // Fallback for Income (or if budgetStatus fails)
      if (!allCategories) return [];
      return allCategories
        .filter(c => c.type === typeFilter || c._id === initialCatId)
        .map(c => ({
            _id: c._id,
            name: c.name,
            type: c.type
        }));

  }, [transactionType, budgetStatus, allCategories, initialData?.categoryId]);

  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined });
  const merchants = useQuery(api.merchants.get, { householdId: householdId ?? undefined });

  // Reset form when opening/closing or changing transaction
  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;
      setSubmitError(null);

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
            labelIds: s.labelIds || [],
          })) || [{ categoryId: '', amount: '', description: '', labelIds: [] }],
          labelIds: transaction.labelIds || [],
          merchantId: transaction.merchantId || undefined,
          assetDetails: transaction.assetDetails ? {
            quantity: transaction.assetDetails.quantity,
            unitPrice: transaction.assetDetails.unitPrice,
          } : undefined,
          // Receivables
          isReimbursable: transaction.isReimbursable || false,
          owedBy: transaction.owedBy || '',
          reimbursementStatus: transaction.reimbursementStatus || 'pending',
        });
      } else {
        editingTransactionId.current = null;
        form.reset({
          type: initialData?.type || TRANSACTION_TYPES.EXPENSE as any,
          amount: initialData?.amount ? formatNumber(initialData.amount) : '',
          date: initialData?.date || new Date(),
          description: initialData?.description || '',
          accountId: initialData?.accountId || '',
          categoryId: initialData?.categoryId || undefined,
          isSplit: initialData?.isSplit || false,
          splits: initialData?.splits || [{ categoryId: '', amount: '', description: '', labelIds: [] }],
          labelIds: initialData?.labelIds || [],
          merchantId: initialData?.merchantId || undefined,
          assetDetails: initialData?.assetDetails || { quantity: '', unitPrice: undefined },
          isReimbursable: initialData?.isReimbursable || false,
          owedBy: initialData?.owedBy || '',
          reimbursementStatus: 'pending',
        });
      }
    }
  }, [open, isEditMode, transaction, form, initialData]);

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
          labelIds: (s.labelIds || []).filter(Boolean) as Id<'labels'>[],
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
              labelIds: (data.labelIds || []).filter(Boolean) as Id<'labels'>[],
              merchantId: (data.merchantId && data.merchantId !== 'none') ? data.merchantId as Id<'merchants'> : undefined,
              assetDetails,
              // Receivables
              isReimbursable: data.isReimbursable,
              owedBy: data.owedBy,
              reimbursementStatus: data.reimbursementStatus,
            });
            toast.success("Transaction updated");
            onOpenChange(false);
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
              labelIds: (data.labelIds || []).filter(Boolean) as Id<'labels'>[],
              merchantId: (data.merchantId && data.merchantId !== 'none') ? data.merchantId as Id<'merchants'> : undefined,
              assetDetails,
              // Receivables
              isReimbursable: data.isReimbursable,
              owedBy: data.owedBy,
              reimbursementStatus: data.reimbursementStatus,
              parentTransactionId: initialData?.parentTransactionId as Id<'transactions'> | undefined,
            });

            const isExpenseCreate = data.type === TRANSACTION_TYPES.EXPENSE && !editingTransactionId.current;
            if (!isExpenseCreate) {
              toast.success("Transaction created");
              onOpenChange(false);
            } else {
              const parsedAmount = parseAmount(data.amount);
              const cat = categories.find(c => c._id === data.categoryId);
              const categoryName = cat?.name || "Uncategorized";

              const totalRemaining = (categories || []).reduce((sum, c) => sum + (c.remaining || 0), 0);
              const catRemaining = cat?.remaining != null ? cat.remaining - parsedAmount : null;
              const catBudgetTotal = cat?.budgetLimit != null ? cat.budgetLimit : null;
              const newOverallRemaining = totalRemaining - parsedAmount;

              onSaveSuccess({
                amount: parsedAmount,
                categoryName,
                overallRemaining: newOverallRemaining,
                categoryRemaining: catRemaining,
                categoryBudgetTotal: catBudgetTotal,
                affectedCategoryId: data.isSplit
                  ? (finalSplits?.sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount))[0]?.categoryId ?? "")
                  : (data.categoryId ?? ""),
                householdId,
                month: selectedMonth,
                year: selectedYear,
                displayName,
              });

              setIsProcessing(false);
              submitLock.current = false;
            }
          }
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to save transaction";
        setSubmitError(message);
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
             replace([{ categoryId: '', amount: '', description: '', labelIds: [] }]);
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
        {submitError && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">Couldn&apos;t save transaction</p>
                    <p className="text-xs text-destructive/80 mt-0.5">{submitError}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => {
                        setSubmitError(null);
                        form.handleSubmit(onSubmit)();
                    }}
                >
                    Try Again
                </Button>
            </div>
        )}
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

            {allCategories === undefined || accounts === undefined ? (
                <div className="space-y-3 p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
            ) : (
            <div className="">
                <TabsContent value={TRANSACTION_TYPES.EXPENSE} className="space-y-4 mt-0 outline-none">
                  <TransactionFormFields 
                    form={form} 
                    categories={categories || []} 
                    accounts={cashAccounts} 
                    labels={labels || []} 
                    merchants={merchants || []}
                    onSplitToggle={handleSplitToggle}
                    splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                    onEditSplit={() => setSplitDrawerOpen(true)}
                    isMobile={isMobile}
                    open={open}
                    isEditMode={isEditMode}
                    isSettlement={isSettlement}
                  />
                </TabsContent>
                <TabsContent value={TRANSACTION_TYPES.INCOME} className="space-y-4 mt-0 outline-none">
                  <TransactionFormFields 
                    form={form} 
                    categories={categories || []} 
                    accounts={cashAccounts} 
                    labels={labels || []} 
                    merchants={merchants || []}
                    onSplitToggle={handleSplitToggle}
                    splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                    onEditSplit={() => setSplitDrawerOpen(true)}
                    isMobile={isMobile}
                    open={open}
                    isEditMode={isEditMode}
                    isSettlement={isSettlement}
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
            )}
          </Tabs>

           {/* Footer Rendering */}
           {isMobile ? (
              <motion.div 
                className="mt-auto pt-6 pb-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
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
                        {isEditMode ? "Save Changes" : "Save Expense"} <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
           ) : (
              <div className="flex justify-end gap-2 border-t -mx-6 pt-4 px-6 mt-6">
                 <SheetClose asChild>
                    <Button variant="outline" type="button" disabled={isProcessing}>Cancel</Button>
                 </SheetClose>
                 <motion.div
                   whileTap={{ scale: 0.97 }}
                   transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                 >
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
                         isEditMode ? "Save Changes" : "Save Expense"
                       )}
                   </Button>
                 </motion.div>
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
    form, categories, accounts, labels, merchants, onSplitToggle, splitSummary, onEditSplit, isMobile, open, isEditMode, isSettlement 
}: { 
    form: UseFormReturn<TransactionFormValues>, 
    categories: CategoryOption[], 
    accounts: Doc<'accounts'>[], 
    labels: Doc<'labels'>[],
    merchants?: Doc<'merchants'>[],
    onSplitToggle?: (checked: boolean) => void,
    splitSummary?: { count: number, total: number },
    onEditSplit?: () => void,
    isMobile?: boolean,
    open?: boolean,
    isEditMode?: boolean,
    isSettlement?: boolean
}) => {
  const { user } = useUser();

  const hideBalance = (account: Doc<'accounts'>) =>
    account.visibility === "private" && account.userId !== user?.id;

  const isSplit = useWatch({ control: form.control, name: 'isSplit' });
  const type = useWatch({ control: form.control, name: 'type' });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const accountId = useWatch({ control: form.control, name: 'accountId' });
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const labelIds = useWatch({ control: form.control, name: 'labelIds' });
  const merchantId = useWatch({ control: form.control, name: 'merchantId' });
  
  const [amountSheetOpen, setAmountSheetOpen] = useState(false);

  const descriptionRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const selectedAccount = accounts.find(a => a._id === accountId);
  const selectedCategory = categories.find(c => c._id === categoryId);
  const selectedMerchant = merchants?.find(m => m._id === merchantId);

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

  return (
    <>
      <motion.div
        className={cn(isMobile && "space-y-6")}
        variants={drawerFieldStagger}
        initial="hidden"
        animate="visible"
      >
          {/* AMOUNT FIELD */}
          <motion.div variants={drawerFieldItem}>
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className={cn(isMobile ? "mb-2" : "")}>
                {!isMobile && <FormLabel>Amount</FormLabel>}
                <FormControl>
                  {isMobile ? (
                      <div className="relative flex flex-col items-center justify-center py-4">
                        <button
                          type="button"
                          className="flex items-start justify-center gap-1 text-foreground outline-none"
                          onClick={() => setAmountSheetOpen(true)}
                        >
                            <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                            <div className={cn(
                                "h-auto p-0 text-5xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors",
                                isOverspent ? "text-destructive" : "text-foreground"
                            )}>
                                {field.value || '0'}
                            </div>
                        </button>
                        {isOverspent && (
                            <motion.div
                              variants={shake}
                              animate="shake"
                              className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full"
                            >
                                <AlertCircle className="h-3 w-3" /> Insufficient Balance
                            </motion.div>
                        )}
                        <div className="h-1 w-16 bg-primary/20 rounded-full mt-4" />

                        <MobileAmountInput
                          open={amountSheetOpen}
                          onOpenChange={setAmountSheetOpen}
                          value={field.value || ''}
                          onChange={field.onChange}
                          onDone={() => setAmountSheetOpen(false)}
                          isOverspent={isOverspent}
                        />
                      </div>
                  ) : (
                    <Input
                        placeholder="0"
                        inputMode="numeric"
                        ref={(e) => {
                            field.ref(e);
                            amountInputRef.current = e;
                        }}
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
          </motion.div>

          {/* MERCHANT FIELD - After Amount, Before Account */}
          <motion.div variants={drawerFieldItem}>
          <FormField
            control={form.control}
            name="merchantId"
            render={({ field }) => (
              <FormItem>
                {!isMobile && <FormLabel>Merchant</FormLabel>}
                <FormControl>
                  <MerchantCombobox
                    value={field.value}
                    onSelect={(id) => field.onChange(id || '')}
                    merchants={merchants || []}
                    trigger={isMobile ? (
                      <button type="button" className="w-full text-left outline-none">
                        <MobileInputCard 
                          label="Merchant" 
                          icon={Store} 
                          valueDisplay={selectedMerchant ? (selectedMerchant.icon.startsWith('http') ? selectedMerchant.name : `${selectedMerchant.icon} ${selectedMerchant.name}`) : undefined}
                        />
                      </button>
                    ) : undefined}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </motion.div>

          {/* CARD INPUTS FOR MOBILE */}
          {isMobile ? (
             <motion.div className="space-y-3" variants={drawerFieldItem}>
                 {accounts.length === 0 ? (
                    <EmptyState
                        icon={Wallet}
                        title="No accounts yet"
                        description="Create an account to start tracking transactions."
                        variant="compact"
                    />
                 ) : (
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
                                        subLabel: hideBalance(acc) ? undefined : `Balance: ${formatCurrency(acc.balance)}`
                                    }))}
                                    trigger={
                                        <button type="button" className="w-full text-left outline-none">
                                            <MobileInputCard 
                                                label="Account" 
                                                icon={Wallet} 
                                                valueDisplay={selectedAccount?.name}
                                                subValueDisplay={selectedAccount && !hideBalance(selectedAccount) ? `Balance: ${formatCurrency(selectedAccount.balance)}` : undefined}
                                            />
                                        </button>
                                    }
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                )}

                <div className="flex gap-3">
                    <div className="flex-1">
                        {!isSplit ? (
                            categories.length === 0 && !isEditMode ? (
                                <EmptyState
                                    icon={Tag}
                                    title="No categories yet"
                                    description="Create a category first to categorize your expenses."
                                    variant="compact"
                                />
                            ) : (
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormDescription className="text-[10px]">
                                            Choose the category that best matches this expense
                                        </FormDescription>
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
                                                disabled={isSettlement}
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
                                                    <button type="button" className={cn("w-full text-left outline-none", isSettlement && "opacity-70 cursor-not-allowed")}>
                                                        <MobileInputCard 
                                                            label={isSettlement ? "Category (Locked)" : "Category"}
                                                            icon={LayoutGrid}
                                                            valueDisplay={selectedCategory?.name}
                                                            subValueDisplay={isSettlement 
                                                                ? "Locked for settlement integrity" 
                                                                : (selectedCategory?.type === CATEGORY_TYPES.EXPENSE && (selectedCategory.budgetLimit || 0) > 0 
                                                                    ? `Avail: ${formatCurrency(selectedCategory.remaining)}` 
                                                                    : undefined)
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
                            )
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
                                    <MobileDatePicker
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
                    
                    {!isSplit && (
                        <FormField
                            control={form.control}
                            name="labelIds"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <LabelCombobox
                                            value={field.value || []}
                                            onSelect={field.onChange}
                                            labels={labels || []}
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

                {/* Receivables Toggle (Mobile) */}
                <FormField
                    control={form.control}
                    name="isReimbursable"
                    render={({ field }) => (
                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", field.value ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                                        <ArrowRight className={cn("h-5 w-5 transition-transform", field.value ? "-rotate-45" : "")} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">To be reimbursed?</p>
                                        <p className="text-xs text-muted-foreground">Mark as owed by someone else</p>
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </div>

                            {field.value && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 fade-in pt-2 border-t">
                                    <FormField
                                        control={form.control}
                                        name="owedBy"
                                        render={({ field: owedField }) => (
                                            <div>
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Owed By</p>
                                                <Input 
                                                    placeholder="e.g. John, Office, Client" 
                                                    {...owedField}
                                                    className="bg-muted/30 border-none shadow-none focus-visible:ring-0 pl-0 h-auto py-1 font-medium"
                                                />
                                                <FormMessage />
                                            </div>
                                        )}
                                    />

                                    {/* Status Management */}
                                    <FormField
                                        control={form.control}
                                        name="reimbursementStatus"
                                        render={({ field: statusField }) => (
                                            <div className="flex items-center justify-between bg-muted/20 p-2 rounded-lg border border-dashed border-muted-foreground/20">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Status</p>
                                                    <p className="text-xs font-semibold capitalize">{statusField.value || 'pending'}</p>
                                                </div>
                                                
                                                {statusField.value === 'forgiven' ? (
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 text-[10px] px-2 bg-background"
                                                        onClick={() => statusField.onChange('pending')}
                                                    >
                                                        Re-open Debt
                                                    </Button>
                                                ) : statusField.value === 'pending' && isEditMode && (
                                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                        Active
                                                    </Badge>
                                                )}
                                                
                                                {statusField.value === 'settled' && (
                                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                                        Settled ✅
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                />
                
                {/* Split Toggle Button - Only Revert Option Remaining */}
                {isSplit && (
                    <div 
                        className="flex items-center justify-center gap-2 py-2 cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => onSplitToggle?.(false)}
                    >
                        <span className="text-sm font-medium">Revert to Single Category</span>
                    </div>
                )}

             </motion.div>
          ) : (
             // DESKTOP LAYOUT (Standard)
              <motion.div variants={drawerFieldItem}>
                {accounts.length === 0 ? (
                    <EmptyState
                        icon={Wallet}
                        title="No accounts yet"
                        description="Create an account to start tracking transactions."
                        variant="compact"
                    />
                ) : (
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
                                        {hideBalance(account) ? '••••' : formatCurrency(account.balance)}
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
                )}
                
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
                    <FormDescription className="text-[10px]">
                        Choose the category that best matches this expense
                    </FormDescription>

                    {!isSplit ? (
                        categories.length === 0 && !isEditMode ? (
                        <EmptyState
                            icon={Tag}
                            title="No categories yet"
                            description="Create a category first to categorize your expenses."
                            variant="compact"
                        />
                    ) : (
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
                                disabled={isSettlement}
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
                    )
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
                        name="labelIds"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Labels</FormLabel>
                            <LabelCombobox
                                value={field.value || []}
                                onSelect={field.onChange}
                                labels={labels || []}
                            />
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

                <FormField
                    control={form.control}
                    name="isReimbursable"
                    render={({ field }) => (
                        <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/10 mt-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Reimbursement</FormLabel>
                                    <p className="text-sm text-muted-foreground">
                                        Is this transaction owed by someone else?
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </div>
                            
                            {field.value && (
                                <FormField
                                    control={form.control}
                                    name="owedBy"
                                    render={({ field: owedField }) => (
                                        <FormItem>
                                            <FormLabel>Owed By</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Person or Entity Name" {...owedField} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    )}
                />
             </motion.div>
          )}
      </motion.div>
    </>
  );
};

const TransferFormFields = ({ form, accounts, labels, categories, isMobile }: { form: UseFormReturn<TransactionFormValues>, accounts: Doc<'accounts'>[], labels: Doc<'labels'>[], categories: CategoryOption[], isMobile?: boolean }) => {
  const { user } = useUser();
  // Transfer form fields logic remains largely the same, but we can apply the card style here too if needed.
  // For brevity, I'll apply the same MobileInputCard pattern here.
  
  const hideBalance = (account: Doc<'accounts'>) =>
    account.visibility === "private" && account.userId !== user?.id;

  const fromAccountId = useWatch({ control: form.control, name: 'accountId' });
  const toAccountId = useWatch({ control: form.control, name: 'toAccountId' });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const quantity = useWatch({ control: form.control, name: 'assetDetails.quantity' });

   const [transferAmountSheetOpen, setTransferAmountSheetOpen] = useState(false);

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
    <motion.div
      variants={drawerFieldStagger}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={drawerFieldItem}>
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
                  <div className="relative flex flex-col items-center justify-center py-4">
                    <button
                      type="button"
                      className="flex items-start justify-center gap-1 text-foreground outline-none"
                      onClick={() => setTransferAmountSheetOpen(true)}
                    >
                        <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                        <div className={cn(
                            "h-auto p-0 text-5xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors",
                            isOverspent ? "text-destructive" : "text-foreground"
                        )}>
                            {field.value || '0'}
                        </div>
                    </button>
                    {isOverspent && (
                        <motion.div
                          variants={shake}
                          animate="shake"
                          className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full"
                        >
                            <AlertCircle className="h-3 w-3" /> Insufficient Balance
                        </motion.div>
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
      </motion.div>

      {isMobile ? (
          <motion.div className="space-y-3" variants={drawerFieldItem}>
              {accounts.length === 0 ? (
                 <EmptyState
                     icon={Wallet}
                     title="No accounts yet"
                     description="Create an account to start tracking transactions."
                     variant="compact"
                 />
              ) : (
              <>
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
                                     subLabel: hideBalance(acc) ? undefined : `Balance: ${formatCurrency(acc.balance)}`
                                 }))}
                                 trigger={
                                     <button type="button" className="w-full text-left outline-none">
                                         <MobileInputCard 
                                             label="From Account" 
                                             icon={Wallet} 
                                             valueDisplay={fromAccount?.name}
                                             subValueDisplay={fromAccount && !hideBalance(fromAccount) ? `Balance: ${formatCurrency(fromAccount.balance)}` : undefined}
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
                                     subLabel: hideBalance(acc) ? undefined : `Balance: ${formatCurrency(acc.balance)}`
                                 }))}
                                 trigger={
                                     <button type="button" className="w-full text-left outline-none">
                                         <MobileInputCard 
                                             label="To Account" 
                                             icon={ArrowRight} 
                                             valueDisplay={toAccount?.name}
                                             subValueDisplay={toAccount && !hideBalance(toAccount) ? `Balance: ${formatCurrency(toAccount.balance)}` : undefined}
                                         />
                                     </button>
                                 }
                             />
                         </FormControl>
                     </FormItem>
                 )}
             />
             </>
             )}

            <div className="grid grid-cols-2 gap-3">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                         <div className="relative">
                            <MobileDatePicker
                                date={field.value}
                                setDate={field.onChange}
                                disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                            />
                        </div>
                    )}
                />
                
                {showCategory && (
                    categories.length === 0 ? (
                        <EmptyState
                            icon={Tag}
                            title="No categories yet"
                            description="Create a category first to categorize your expenses."
                            variant="compact"
                        />
                    ) : (
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
                    )
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
          </motion.div>
      ) : (
           <motion.div className="space-y-4" variants={drawerFieldItem}>
              {accounts.length === 0 ? (
                 <EmptyState
                     icon={Wallet}
                     title="No accounts yet"
                     description="Create an account to start tracking transactions."
                     variant="compact"
                 />
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
                    name="labelIds"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Labels</FormLabel>
                        <LabelCombobox
                            value={field.value || []}
                            onSelect={field.onChange}
                            labels={labels || []}
                        />
                        <FormMessage />
                    </FormItem>
                    )}
                />
             </div>

             {showCategory && (
                categories.length === 0 ? (
                    <EmptyState
                        icon={Tag}
                        title="No categories yet"
                        description="Create a category first to categorize your expenses."
                        variant="compact"
                    />
                ) : (
                <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {categories.map(category => (
                            <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )
             )}

             {isAssetTransaction && (
                <FormField
                    control={form.control}
                    name="assetDetails.quantity"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity / Weight</FormLabel>
                        <FormControl>
                        <Input type="number" step="any" placeholder="0.00" {...field} />
                        </FormControl>
                        {parsedAmount > 0 && parsedQuantity > 0 && (
                            <p className="text-xs text-muted-foreground">
                                @ {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(impliedPrice)} / unit
                            </p>
                        )}
                        <FormMessage />
                    </FormItem>
                    )}
                />
             )}

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
          </motion.div>
        )}

        <MobileAmountInput
          open={transferAmountSheetOpen}
          onOpenChange={setTransferAmountSheetOpen}
          value={form.getValues('amount') || ''}
          onChange={(val) => form.setValue('amount', val)}
          onDone={() => setTransferAmountSheetOpen(false)}
        />
    </motion.div>
  );
};

export default TransactionDrawer;