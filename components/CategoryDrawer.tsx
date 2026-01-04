import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
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
import { Switch } from '@/components/ui/switch';

const CategoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  targetAmount: z.string().optional(),
  targetDate: z.date().optional(),
  enablePacing: z.boolean(),
});

type CategoryFormValues = z.infer<typeof CategoryFormSchema>;

type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Doc<'categories'>;
};

const CategoryDrawer = ({ open, onOpenChange, category }: CategoryDrawerProps) => {
  const { householdId } = useHousehold();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);

  const isEditMode = !!category;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(CategoryFormSchema),
  });

  const categoryType = useWatch({
    control: form.control,
    name: 'type',
  });

  useEffect(() => {
    if (open && isEditMode) {
      form.reset({
        name: category.name,
        type: category.type,
        targetAmount: category.targetAmount || '',
        targetDate: category.targetDate ? new Date(category.targetDate) : undefined,
        enablePacing: category.enablePacing || false,
      });
    } else if (open && !isEditMode) {
      form.reset({
        name: '',
        type: '',
        targetAmount: '',
        targetDate: undefined,
        enablePacing: false,
      });
    }
  }, [open, isEditMode, category, form]);

  const onSubmit = (data: CategoryFormValues) => {
    const payload = {
        name: data.name,
        type: data.type,
        targetAmount: data.targetAmount,
        targetDate: data.targetDate ? data.targetDate.toISOString() : undefined,
        enablePacing: data.enablePacing,
    };

    if (isEditMode) {
      updateCategory({
        id: category._id,
        ...payload,
      });
    } else {
      createCategory({
        ...payload,
        householdId: householdId ?? undefined,
      });
    }
    onOpenChange(false);
  };

  const formatNumber = (value: string | undefined) => {
    if (!value) return '';
    const parsed = parseFloat(value.replace(/,/g, ''));
    if (isNaN(parsed)) return '';
    return new Intl.NumberFormat('en-US').format(parsed);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Category' : 'Create a new Category'}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Food" {...field} />
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
                    <FormLabel>Category Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="saving">Saving / Goal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {categoryType === 'expense' && (
                <FormField
                  control={form.control}
                  name="enablePacing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Smart Budget Pace
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Track daily spending pace for this category.
                        </div>
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
              )}

              {categoryType === 'saving' && (
                <div className="space-y-4 border-l-2 pl-4 border-primary/20">
                    <FormField
                        control={form.control}
                        name="targetAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Goal Target Amount</FormLabel>
                            <FormControl>
                            <Input 
                                placeholder="e.g., 50,000,000" 
                                {...field}
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
                            <FormLabel>Target Date</FormLabel>
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
              )}

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

export default CategoryDrawer;
