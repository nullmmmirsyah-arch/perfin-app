import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
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
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/icons';

const LABEL_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  '#14b8a6', '#84cc16', '#a855f7', '#0ea5e9', '#64748b',
];

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

const LabelDrawer = ({ open, onOpenChange, label }: LabelDrawerProps) => {
  const { householdId } = useHousehold();
  const createLabel = useMutation(api.labels.create);
  const updateLabel = useMutation(api.labels.update);

  const isEditMode = !!label;
  const [isProcessing, setIsProcessing] = React.useState(false);
  const submitLock = React.useRef(false);

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(LabelFormSchema),
  });

  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;

      if (isEditMode) {
        form.reset({ name: label.name, color: label.color || '#6b7280' });
      } else {
        form.reset({ name: '', color: '#6b7280' });
      }
    }
  }, [open, isEditMode, label, form]);

  const onSubmit = async (data: LabelFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      if (isEditMode) {
        await updateLabel({ id: label._id, ...data });
      } else {
        await createLabel({ ...data, householdId: householdId ?? undefined });
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      submitLock.current = false;
    }
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
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {LABEL_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={cn(
                              "h-8 w-8 rounded-full border-2 transition-all",
                              field.value === color ? "border-primary scale-110" : "border-transparent"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DrawerFooter className="px-0 pt-2">
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
                <DrawerClose asChild>
                  <Button variant="outline" disabled={isProcessing}>Cancel</Button>
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
