import React from 'react';
import { useFieldArray, UseFormReturn, FieldValues } from 'react-hook-form';
import { Doc } from '../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Reusing types from TransactionDrawer parent context if possible,
// but for clarity we define what we need.
type SplitEditorDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  categories: { _id: string; name: string }[];
  labels: Doc<'labels'>[];
};
const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

export const SplitEditorDrawer = (props: SplitEditorDrawerProps) => {
  const isMobile = useIsMobile();
  const { open, onOpenChange } = props;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[96%] flex flex-col">
          <DrawerHeader className="border-b px-4 py-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => onOpenChange(false)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <DrawerTitle>Edit Splits</DrawerTitle>
              <Button size="sm" onClick={() => onOpenChange(false)} className="bg-primary text-primary-foreground">
                  Done
              </Button>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 pb-24">
             <SplitEditorContent {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
           <DialogTitle>Edit Splits</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4">
           <SplitEditorContent {...props} />
        </div>
        <DialogFooter className="p-4 border-t">
           <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SplitEditorContent = ({ form, categories, labels }: SplitEditorDrawerProps) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  const amount = form.watch('amount') as string | undefined;
  const splits = form.watch('splits') as { amount: string }[] | undefined;

  const allocated = splits?.reduce((acc: number, split) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;
  const remaining = parseFloat(amount?.replace(/,/g, '') || '0') - allocated;

  return (
    <div className="space-y-4">
        {/* Summary Card */}
        <div className="bg-muted/30 rounded-lg p-4 border space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Transaction:</span>
                <span className="font-medium">{new Intl.NumberFormat().format(parseFloat(amount?.replace(/,/g, '') || '0'))}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Allocated:</span>
                <span className="font-medium text-blue-600">{new Intl.NumberFormat().format(allocated)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                <span>Remaining:</span>
                <span className={cn(remaining !== 0 ? 'text-destructive' : 'text-green-600')}>
                    {new Intl.NumberFormat().format(remaining)}
                </span>
            </div>
        </div>

        <div className="space-y-3">
            {fields.map((field, index) => (
                <div key={field.id} className="p-3 border rounded-lg space-y-3 bg-card shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item {index + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive -mr-2 -mt-2" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <FormField
                            control={form.control}
                            name={`splits.${index}.categoryId`}
                            render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories?.map(category => (
                                                <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`splits.${index}.amount`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            className="h-9"
                                            placeholder="Amount"
                                            inputMode="numeric"
                                            {...field}
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
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                            <FormField
                            control={form.control}
                            name={`splits.${index}.description`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            className="h-9"
                                            placeholder="Description (optional)"
                                            {...field}
                                            value={field.value || ''}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                            <FormField
                            control={form.control}
                            name={`splits.${index}.labelId`}
                            render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Label (opt)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {labels?.map(label => (
                                                <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            ))}
        </div>

        <Button 
            type="button" 
            variant="outline" 
            className="w-full border-dashed" 
            onClick={() => append({ categoryId: '', amount: '', description: '', labelId: '' })}
        >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Split Item
        </Button>
    </div>
  );
};