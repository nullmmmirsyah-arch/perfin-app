import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc } from '../convex/_generated/dataModel';

const TransactionFormSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
    message: 'Amount must be a number',
  }),
  date: z.date(),
  description: z.string().optional(),
  accountId: z.string(),
  categoryId: z.string().optional(),
  toAccountId: z.string().optional(),
  isSplit: z.boolean().optional(),
  splits: z.array(z.object({
    categoryId: z.string(),
    amount: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
      message: 'Amount must be a number',
    }),
  })).optional(),
  labelId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'transfer') {
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
        const totalSplitAmount = data.splits.reduce((acc, split) => acc + parseFloat(split.amount.replace(/,/g, '')), 0);
        if (totalSplitAmount !== parseFloat(data.amount.replace(/,/g, ''))) {
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

type TransactionFormValues = z.infer<typeof TransactionFormSchema>;

type TransactionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: any;
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const TransactionDrawer = ({ open, onOpenChange, transaction }: TransactionDrawerProps) => {
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);

  const accounts = useQuery(api.accounts.get);

  const isEditMode = !!transaction;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(TransactionFormSchema),
  });

  const transactionType = form.watch('type');
  const categories = useQuery(
    api.categories.get,
    transactionType === 'transfer' ? 'skip' : { type: transactionType }
  );
  const labels = useQuery(api.labels.get);

  useEffect(() => {
    if (open && isEditMode) {
      form.reset({
        ...transaction,
        date: new Date(transaction.date),
      });
    } else if (open && !isEditMode) {
      form.reset({
        type: 'expense',
        amount: '',
        date: new Date(),
        description: '',
        isSplit: false,
        splits: [{ categoryId: '', amount: '' }],
        labelId: undefined, // Initialize labelId
      });
    }
  }, [open, isEditMode, transaction, form]);

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  const onSubmit = (data: TransactionFormValues) => {
    if (isEditMode) {
      updateTransaction({
        id: transaction._id,
        ...(data as any),
        date: data.date.toISOString(),
      });
    } else {
      createTransaction({
        ...(data as any),
        date: data.date.toISOString(),
      });
    }
    onOpenChange(false);
  };

  const isSplit = form.watch('isSplit');
  const amount = form.watch('amount');
  const splits = form.watch('splits');

  useEffect(() => {
    if (!isSplit) {
      replace([]);
    } else if (fields.length === 0) {
      append({ categoryId: '', amount: '' });
    }
  }, [isSplit, replace, append, fields.length]);


  const allocated = splits?.reduce((acc, split) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;
  const remaining = parseFloat(amount?.replace(/,/g, '') || '0') - allocated;

  const handleTabChange = (value: string) => {
    form.setValue('type', value as 'expense' | 'income' | 'transfer');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit transaction' : 'Create a new transaction'}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <Tabs value={transactionType} className="w-full" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
            </TabsList>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <TabsContent value="expense" className="space-y-4">
                  <TransactionFormFields form={form} categories={categories || []} accounts={accounts || []} labels={labels || []} />
                </TabsContent>
                <TabsContent value="income" className="space-y-4">
                  <TransactionFormFields form={form} categories={categories || []} accounts={accounts || []} labels={labels || []} />
                </TabsContent>
                <TabsContent value="transfer" className="space-y-4">
                  <TransferFormFields form={form} accounts={accounts || []} labels={labels || []} />
                </TabsContent>


                {isSplit && transactionType !== 'transfer' && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Split Transaction</h3>
                      <Button type="button" size="sm" onClick={() => append({ categoryId: '', amount: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Split
                      </Button>
                    </div>
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name={`splits.${index}.categoryId`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories?.map(category => (
                                    <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`splits.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Amount"
                                  inputMode="numeric"
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(formatNumber(value));
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value;
                                    field.onBlur();
                                    field.onChange(formatNumber(value));
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-end gap-4 text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span>{new Intl.NumberFormat().format(parseFloat(amount?.replace(/,/g, '') || '0'))}</span>
                    </div>
                    <div className="flex justify-end gap-4 text-sm">
                      <span className="text-muted-foreground">Allocated:</span>
                      <span>{new Intl.NumberFormat().format(allocated)}</span>
                    </div>
                    <div className="flex justify-end gap-4 text-sm">
                      <span className={cn("font-medium", remaining !== 0 ? 'text-destructive' : 'text-primary')}>
                        Remaining:
                      </span>
                      <span className={cn(remaining !== 0 ? 'text-destructive' : 'text-primary')}>
                        {new Intl.NumberFormat().format(remaining)}
                      </span>
                    </div>
                  </div>
                )}
                <DrawerFooter>
                  <Button type="submit">Save changes</Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DrawerClose>
                </DrawerFooter>
              </form>
            </Form>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

const TransactionFormFields = ({ form, categories, accounts, labels }: { form: any, categories: Doc<'categories'>[], accounts: Doc<'accounts'>[], labels: Doc<'labels'>[] }) => {
  const isSplit = form.watch('isSplit');

  return (
    <>
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Amount</FormLabel>
            <FormControl>
              <Input
                placeholder="0"
                inputMode="numeric"
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(formatNumber(value));
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  field.onBlur();
                  field.onChange(formatNumber(value));
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="accountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {!isSplit && (
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
      <FormField
        control={form.control}
        name="labelId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
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
      <FormField
        control={form.control}
        name="isSplit"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <FormLabel>Split Transaction</FormLabel>
            </div>
            <FormControl>
              <input type="checkbox" checked={field.value} onChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
};

const TransferFormFields = ({ form, accounts, labels }: { form: any, accounts: Doc<'accounts'>[], labels: Doc<'labels'>[] }) => {
  return (
    <>
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Amount</FormLabel>
            <FormControl>
              <Input
                placeholder="0"
                inputMode="numeric"
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(formatNumber(value));
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  field.onBlur();
                  field.onChange(formatNumber(value));
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="accountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>From Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="toAccountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>To Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
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
        name="labelId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
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
    </>
  );
};

export default TransactionDrawer;
