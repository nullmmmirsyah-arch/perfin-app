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
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const LabelFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().min(1, 'Color is required'),
});

type LabelFormValues = z.infer<typeof LabelFormSchema>;

type LabelDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: Doc<'labels'>;
};

const predefinedColors = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
];

const LabelDrawer = ({ open, onOpenChange, label }: LabelDrawerProps) => {
  const createLabel = useMutation(api.labels.create);
  const updateLabel = useMutation(api.labels.update);

  const isEditMode = !!label;

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(LabelFormSchema),
  });

  useEffect(() => {
    if (open && isEditMode) {
      form.reset(label);
    } else if (open && !isEditMode) {
      form.reset({
        name: '',
        color: predefinedColors[0],
      });
    }
  }, [open, isEditMode, label, form]);

  const onSubmit = (data: LabelFormValues) => {
    if (isEditMode) {
      updateLabel({
        id: label._id,
        ...data,
      });
    } else {
      createLabel(data);
    }
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Label' : 'Create a new Label'}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Work" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2.5">
                        {predefinedColors.map((colorOption) => (
                          <button
                            key={colorOption}
                            type="button"
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95",
                              field.value === colorOption ? "ring-2 ring-offset-2 ring-primary" : ""
                            )}
                            style={{ backgroundColor: colorOption }}
                            onClick={() => field.onChange(colorOption)}
                          >
                            {field.value === colorOption && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DrawerFooter className="px-0 pt-2">
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

export default LabelDrawer;
