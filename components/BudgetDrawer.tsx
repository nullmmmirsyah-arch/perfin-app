import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc, Id } from '../convex/_generated/dataModel';
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

const BudgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required'),
});

type BudgetFormValues = z.infer<typeof BudgetFormSchema>;

type BudgetDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: Doc<'categories'>;
  currentAmount?: string;
};

const BudgetDrawer = ({ open, onOpenChange, defaultCategory, currentAmount }: BudgetDrawerProps) => {
  const upsertBudget = useMutation(api.budgets.upsertBudget);
  const categories = useQuery(api.categories.get, { type: 'expense' }); // Filter by expense by default

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(BudgetFormSchema),
    defaultValues: {
      categoryId: '',
      amount: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        categoryId: defaultCategory?._id ?? '',
        amount: currentAmount ?? '',
      });
    }
  }, [open, defaultCategory, currentAmount, form]);

  const onSubmit = (data: BudgetFormValues) => {
    upsertBudget({
      categoryId: data.categoryId as Id<'categories'>,
      amount: data.amount,
    });
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Set Budget</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!defaultCategory}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Limit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 500.00" {...field} type="number" step="0.01" />
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

export default BudgetDrawer;