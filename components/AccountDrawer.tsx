import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc } from '../convex/_generated/dataModel';
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

const AccountFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  balance: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
    message: 'Balance must be a number',
  }),
});

type AccountFormValues = z.infer<typeof AccountFormSchema>;

type AccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Doc<'accounts'>;
};

const AccountDrawer = ({ open, onOpenChange, account }: AccountDrawerProps) => {
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);

  const isEditMode = !!account;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormSchema),
  });

  useEffect(() => {
    if (open && isEditMode) {
      form.reset(account);
    } else if (open && !isEditMode) {
      form.reset({
        name: '',
        balance: '',
      });
    }
  }, [open, isEditMode, account, form]);

  const onSubmit = (data: AccountFormValues) => {
    if (isEditMode) {
      updateAccount({
        id: account._id,
        ...data,
      });
    } else {
      createAccount(data);
    }
    onOpenChange(false);
  };

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
