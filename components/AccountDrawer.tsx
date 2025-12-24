import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc, Id } from '../convex/_generated/dataModel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AccountFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  balance: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
    message: 'Balance must be a number',
  }),
  type: z.enum(['CASH', 'ASSET']),
  initialQuantity: z.string().optional(),
  unit: z.string().optional(),
});

type AccountFormValues = {
  name: string;
  balance: string;
  type: 'CASH' | 'ASSET';
  initialQuantity?: string;
  unit?: string;
};

type AccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Doc<'accounts'>;
};

const AccountDrawer = ({ open, onOpenChange, account }: AccountDrawerProps) => {
  const { householdId } = useHousehold();
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);

  const isEditMode = !!account;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: {
      name: '',
      balance: '',
      type: 'CASH',
      initialQuantity: '',
      unit: '',
    },
  });

  useEffect(() => {
    if (open && isEditMode && account) {
      form.reset({
        name: account.name,
        balance: account.balance,
        type: (account.type as 'CASH' | 'ASSET') || 'CASH',
        initialQuantity: account.initialQuantity || '',
        unit: account.unit || '',
      });
    } else if (open && !isEditMode) {
      form.reset({
        name: '',
        balance: '',
        type: 'CASH',
        initialQuantity: '',
        unit: '',
      });
    }
  }, [open, isEditMode, account, form]);

  const onSubmit = (data: AccountFormValues) => {
    if (isEditMode && account) {
      updateAccount({
        id: account._id,
        name: data.name,
        balance: data.balance,
        type: data.type,
        initialQuantity: data.initialQuantity,
        unit: data.unit,
      });
    } else {
      createAccount({
        householdId: householdId ?? undefined,
        name: data.name,
        balance: data.balance,
        type: data.type,
        initialQuantity: data.initialQuantity,
        unit: data.unit,
      });
    }
    onOpenChange(false);
  };

  const accountType = useWatch({
    control: form.control,
    name: 'type',
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Account' : 'Create a new Account'}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CASH">Cash (Standard)</SelectItem>
                        <SelectItem value="ASSET">Asset (Gold, Stock, etc.)</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <FormLabel>{isEditMode ? 'Balance' : 'Initial Balance'}</FormLabel>
                    <FormControl>
                      <Input placeholder="0" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DrawerFooter>
                <Button type="submit">Save changes</Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AccountDrawer;