import React from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Doc, Id } from '../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  FormControl,
  FormField,
  FormItem,
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
import { PlusCircle, Trash2, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Reusing types from TransactionDrawer parent context if possible, 
// but for clarity we define what we need.
type SplitEditorDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<any>; // Using any to avoid circular dependency mess, but should be TransactionFormValues
  categories: Doc<'categories'>[];
  labels: Doc<'labels'>[];
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

export const SplitEditorDrawer = ({ open, onOpenChange, form, categories, labels }: SplitEditorDrawerProps) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  const amount = form.watch('amount');
  const splits = form.watch('splits');

  const allocated = splits?.reduce((acc: number, split: any) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;
  const remaining = parseFloat(amount?.replace(/,/g, '') || '0') - allocated;

  const handleDone = () => {
      // Basic validation? Or let parent handle it on submit.
      // Parent form schema handles validation (Total match).
      onOpenChange(false);
  };

  const handleBack = () => {
      // Maybe revert changes? Or just close.
      // Current behavior: Just close (keep changes).
      // If user wants to cancel split, they should toggle the checkbox in parent.
      onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[96%] flex flex-col">
        <DrawerHeader className="border-b px-4 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <DrawerTitle>Edit Splits</DrawerTitle>
            <Button size="sm" onClick={handleDone} className="bg-primary text-primary-foreground">
                Done
            </Button>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
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
            
            {/* Bottom spacer for mobile keyboard */}
            {/*<div className="h-40" />*/}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
