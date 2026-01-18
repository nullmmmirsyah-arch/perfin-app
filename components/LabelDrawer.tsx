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
import { Check, Loader2 } from 'lucide-react';

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
  const { householdId } = useHousehold();
  const createLabel = useMutation(api.labels.create);
  const updateLabel = useMutation(api.labels.update);

  const isEditMode = !!label;
  const [isProcessing, setIsProcessing] = React.useState(false);
  const submitLock = React.useRef(false);

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(LabelFormSchema),
  });

  const { formState: { isSubmitting } } = form;

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

  const onSubmit = async (data: LabelFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
        submitLock.current = true;
        setIsProcessing(true);

        if (isEditMode) {
          await updateLabel({
            id: label._id,
            ...data,
          });
        } else {
          await createLabel({
            ...data,
            householdId: householdId ?? undefined,
          });
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
