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
  '#FF5733', '#33FF57', '#3357FF', '#FF33FF', '#33FFFF', '#FFFF33', // Brights
  '#FF9933', '#99FF33', '#9933FF', '#FF3399', '#3399FF', '#33FF99', // Pastels/Middles
  '#800000', '#008000', '#000080', // Darks
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
        color: predefinedColors[0], // Default to first color
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
        <div className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-5 gap-2">
                        {predefinedColors.map((colorOption) => (
                          <div
                            key={colorOption}
                            className={cn(
                              "h-8 w-8 rounded-full cursor-pointer border-2 border-transparent",
                              field.value === colorOption && "border-primary"
                            )}
                            style={{ backgroundColor: colorOption }}
                            onClick={() => field.onChange(colorOption)}
                          />
                        ))}
                      </div>
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

export default LabelDrawer;
