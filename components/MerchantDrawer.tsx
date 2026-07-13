import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, Loader2 } from 'lucide-react';
import MerchantIconPicker from './MerchantIconPicker';

const MerchantFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
});

type MerchantFormValues = z.infer<typeof MerchantFormSchema>;

type MerchantDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchant?: Doc<'merchants'>;
  onCreateSuccess?: (merchantId: Id<'merchants'>) => void;
};

const MerchantDrawer = ({ open, onOpenChange, merchant, onCreateSuccess }: MerchantDrawerProps) => {
  const { householdId } = useHousehold();
  const createMerchant = useMutation(api.merchants.create);
  const updateMerchant = useMutation(api.merchants.update);

  const isEditMode = !!merchant;
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const submitLock = React.useRef(false);

  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(MerchantFormSchema),
  });

  const { formState: { isSubmitting } } = form;

  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;
      setIsDirty(false);
      setShowDiscardDialog(false);
      setIsLocked(false);

      if (isEditMode) {
        form.reset(merchant);
      } else {
        form.reset({
          name: '',
          icon: '',
        });
      }
    }
  }, [open, isEditMode, merchant, form]);

  useEffect(() => {
    if (open) {
      window.history.pushState({ drawer: 'merchant' }, '', window.location.href);

      const handlePopState = () => {
        if (isDirty) {
          window.history.pushState({ drawer: 'merchant' }, '', window.location.href);
          setShowDiscardDialog(true);
        } else {
          onOpenChange(false);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [open, isDirty, onOpenChange]);

  const handleKeepEditing = () => {
    setShowDiscardDialog(false);
    setIsLocked(true);
    setTimeout(() => setIsLocked(false), 500);
  };

  const handleOpenChangeWrapper = (newOpen: boolean) => {
    if (!newOpen && isLocked) return;

    if (!newOpen && isDirty) {
      if (!showDiscardDialog) setShowDiscardDialog(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  const onSubmit = async (data: MerchantFormValues) => {
    if (submitLock.current || isProcessing) return;
    navigator.vibrate(10);

    try {
        submitLock.current = true;
        setIsProcessing(true);

        if (isEditMode) {
          await updateMerchant({
            id: merchant._id,
            ...data,
          });
        } else {
          if (!householdId) {
            throw new Error("Household ID is required");
          }
          const newId = await createMerchant({
            householdId,
            ...data,
          });
          onCreateSuccess?.(newId);
        }
        setIsDirty(false);
        onOpenChange(false);
    } catch (error) {
        console.error("Failed to save merchant:", error);
    } finally {
        setIsProcessing(false);
        submitLock.current = false;
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChangeWrapper}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{isEditMode ? 'Edit Merchant' : 'Add New Merchant'}</DrawerTitle>
          </DrawerHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} onChange={() => setIsDirty(true)} className="p-4 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Starbucks, Amazon, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <MerchantIconPicker
                        value={field.value}
                        onSelect={(value) => {
                          field.onChange(value);
                          setIsDirty(true);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DrawerFooter className="pt-2">
                <Button type="submit" disabled={isSubmitting || isProcessing}>
                  {(isSubmitting || isProcessing) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {isEditMode ? 'Update Merchant' : 'Add Merchant'}
                    </>
                  )}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </Form>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepEditing}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MerchantDrawer;