import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const AccountFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  balance: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
    message: 'Balance must be a number',
  }),
  type: z.enum(['CASH', 'ASSET', 'SAVING']),
  initialQuantity: z.string().optional(),
  unit: z.string().optional(),
  targetAmount: z.string().optional(),
  targetDate: z.date().optional(),
  enableGoal: z.boolean().optional(),
  goalType: z.enum(['investment', 'bill', 'purchase']).optional(),
});

type AccountFormValues = z.infer<typeof AccountFormSchema>;

type AccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Doc<'accounts'>;
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const AccountDrawer = ({ open, onOpenChange, account }: AccountDrawerProps) => {
  const { householdId } = useHousehold();
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);
  const categories = useQuery(api.categories.get, { householdId: householdId ?? undefined, showArchived: true });

  const isEditMode = !!account;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: {
      name: '',
      balance: '',
      type: 'CASH',
      initialQuantity: '',
      unit: '',
      targetAmount: '',
      targetDate: undefined,
      enableGoal: false,
      goalType: 'purchase',
    },
  });

  const accountType = useWatch({ control: form.control, name: 'type' });
  const enableGoal = useWatch({ control: form.control, name: 'enableGoal' });

  useEffect(() => {
    if (open && isEditMode && account) {
      // Find linked category to prepopulate goal data
      const linkedCategory = categories?.find(c => c._id === account.linkedCategoryId);
      
      form.reset({
        name: account.name,
        balance: account.balance,
        type: (account.type as 'CASH' | 'ASSET' | 'SAVING') || 'CASH',
        initialQuantity: account.initialQuantity || '',
        unit: account.unit || '',
        targetAmount: linkedCategory?.targetAmount || '',
        targetDate: linkedCategory?.targetDate ? new Date(linkedCategory.targetDate) : undefined,
        enableGoal: !!linkedCategory?.targetAmount, // Enable if target exists
        goalType: (linkedCategory?.goalType as 'investment' | 'bill' | 'purchase') || 'purchase',
      });
    } else if (open && !isEditMode) {
      form.reset({
        name: '',
        balance: '',
        type: 'CASH',
        initialQuantity: '',
        unit: '',
        targetAmount: '',
        targetDate: undefined,
        enableGoal: false,
        goalType: 'purchase',
      });
    }
  }, [open, isEditMode, account, form, categories]);

  const onSubmit = (data: AccountFormValues) => {
    const payload = {
        name: data.name,
        balance: data.balance,
        type: data.type,
        initialQuantity: data.initialQuantity,
        unit: data.unit,
        targetAmount: data.enableGoal ? data.targetAmount : undefined,
        targetDate: data.enableGoal && data.targetDate ? data.targetDate.toISOString() : undefined,
        goalType: data.enableGoal ? data.goalType : undefined,
    };

    if (isEditMode && account) {
      updateAccount({
        id: account._id,
        ...payload,
      });
    } else {
      createAccount({
        householdId: householdId ?? undefined,
        ...payload,
      });
    }
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-dvh flex flex-col">
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Account' : 'Create a new Account'}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-4 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                        <Tabs 
                            value={field.value} 
                            onValueChange={(val) => field.onChange(val as 'CASH' | 'ASSET' | 'SAVING')} 
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="CASH">Cash</TabsTrigger>
                                <TabsTrigger value="SAVING">Saving</TabsTrigger>
                                <TabsTrigger value="ASSET">Asset</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Wallet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {accountType === 'ASSET' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initialQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isEditMode ? 'Quantity' : 'Initial Quantity'}</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="any" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Grams, Shares" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEditMode ? 'Current Balance' : 'Initial Balance'}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0" 
                        inputMode="numeric" 
                        {...field} 
                        disabled={isEditMode}
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
                    {isEditMode && (
                        <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded italic">
                            Balance can only be changed via transactions (Income/Expense/Transfer) to keep your financial reports accurate.
                        </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Goal Settings Section */}
              {(accountType === 'SAVING' || accountType === 'ASSET') && (
                  <div className="border rounded-md p-3 bg-muted/20 space-y-3">
                      <FormField
                        control={form.control}
                        name="enableGoal"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg p-0 space-y-0">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Set Goal Target</FormLabel>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                      />
                      
                      {enableGoal && (
                          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                               <div className="grid grid-cols-2 gap-4">
                                   <FormField
                                        control={form.control}
                                        name="targetAmount"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Target Amount</FormLabel>
                                            <FormControl>
                                            <Input 
                                                className="h-8"
                                                placeholder="0" 
                                                {...field}
                                                value={field.value || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
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
                                        name="targetDate"
                                        render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-xs">Target Date</FormLabel>
                                            <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                    "w-full h-8 pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? format(field.value, "PP") : <span>Pick date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                                />
                                            </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                               </div>

                               {accountType === 'SAVING' && (
                                   <FormField
                                        control={form.control}
                                        name="goalType"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Goal Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="purchase">✨ Purchase (Wishlist)</SelectItem>
                                                    <SelectItem value="bill">📅 Bill (Sinking Fund)</SelectItem>
                                                    <SelectItem value="investment">🛡️ Investment (Wealth)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                               )}
                          </div>
                      )}
                  </div>
              )}
              {/* Hidden submit button */}
              <button type="submit" className="hidden" />
            </form>
          </Form>
        </div>
        <DrawerFooter className="border-t bg-background pt-4 pb-safe px-4">
            <Button onClick={form.handleSubmit(onSubmit)}>Save changes</Button>
            <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
            </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AccountDrawer;