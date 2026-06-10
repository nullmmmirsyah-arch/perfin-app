import React, { useState } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Doc } from '../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter, // Added DrawerFooter
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { PlusCircle, Trash2, ArrowLeft, LayoutGrid, Tag, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileInputCard, MobileSelectionDrawer } from './ui/mobile-inputs';
import { MobileAmountInput } from './mobile-amount-input';
import { Textarea } from '@/components/ui/textarea';

// Reusing types from TransactionDrawer parent context if possible,
// but for clarity we define what we need.
type SplitEditorDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  categories: { _id: string; name: string; type?: string; budgetLimit?: number; remaining?: number }[]; // Updated type
  labels: Doc<'labels'>[];
  fields: any[];
  append: (value: any) => void;
  remove: (index: number | number[]) => void;
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value).replace('IDR', 'Rp');
};


export const SplitEditorDrawer = (props: SplitEditorDrawerProps) => {
  const isMobile = useIsMobile();
  const { open, onOpenChange } = props;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[96dvh] flex flex-col bg-background">
          <DrawerHeader className="border-b px-4 py-3 flex items-center justify-between shrink-0">
              <Button variant="ghost" size="sm" className="-ml-2 h-9" onClick={() => onOpenChange(false)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <DrawerTitle>Edit Splits</DrawerTitle>
              <div className="w-16 flex justify-end">
                <Button size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs font-semibold rounded-full">
                    Done
                </Button>
              </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto bg-muted/10">
             <SplitEditorContent {...props} isMobile={true} />
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
           <SplitEditorContent {...props} isMobile={false} />
        </div>
        <DialogFooter className="p-4 border-t">
           <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SplitEditorContent = ({ form, categories, labels, isMobile, fields, append, remove }: SplitEditorDrawerProps & { isMobile: boolean }) => {
  const amount = form.watch('amount') as string | undefined;
  const splits = form.watch('splits') as { amount: string }[] | undefined;

  const allocated = splits?.reduce((acc: number, split) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;
  const remaining = parseFloat(amount?.replace(/,/g, '') || '0') - allocated;

  const [activeSplitAmount, setActiveSplitAmount] = useState<{ index: number; value: string } | null>(null);

  return (
    <div className={cn("space-y-6", isMobile ? "p-4" : "")}>
        {/* Summary Card */}
        <div className={cn(
            "rounded-xl p-4 border space-y-3 sticky top-0 z-10 shadow-sm backdrop-blur-md",
             remaining === 0 ? "bg-green-50/90 border-green-200" : "bg-card/90 border-border"
        )}>
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Transaction</span>
                <span className="font-semibold">{formatNumber(amount)}</span>
            </div>
            
             <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                    className={cn("absolute top-0 left-0 h-full transition-all duration-300", remaining === 0 ? "bg-green-500" : "bg-blue-500")}
                    style={{ width: `${Math.min(100, (allocated / (parseFloat(amount?.replace(/,/g, '') || '0') || 1)) * 100)}%` }}
                />
            </div>

            <div className="flex justify-between items-end">
                 <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Allocated</span>
                    <div className="font-medium text-blue-600 text-lg">
                        {new Intl.NumberFormat().format(allocated)}
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Remaining</span>
                    <div className={cn("font-medium text-lg", remaining !== 0 ? 'text-destructive' : 'text-green-600')}>
                        {new Intl.NumberFormat().format(remaining)}
                    </div>
                 </div>
            </div>
        </div>

        <div className="space-y-4">
            {fields.map((field, index) => (
                <div key={field.id} className={cn("relative group animate-in slide-in-from-bottom-2 fade-in duration-300", isMobile ? "bg-card rounded-2xl border shadow-sm overflow-hidden" : "p-3 border rounded-lg space-y-3 bg-card shadow-sm")}>
                    
                    {/* Header for Item */}
                    <div className={cn("flex justify-between items-center p-3 pb-0", isMobile ? "bg-muted/30 border-b border-dashed px-4 py-2" : "")}>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Item {index + 1}</span>
                        {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    
                    {isMobile ? (
                        <div className="p-4 space-y-3">
                            {/* Amount Input */}
                             <FormField
                                control={form.control}
                                name={`splits.${index}.amount`}
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                                            <button
                                              type="button"
                                              className="w-full flex items-center gap-4 outline-none"
                                              onClick={() => setActiveSplitAmount({ index, value: field.value || '' })}
                                            >
                                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                                    <span className="font-serif font-bold text-sm">Rp</span>
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
                                                    <p className={cn(
                                                      "font-bold text-xl",
                                                      field.value ? "text-foreground" : "text-muted-foreground/50"
                                                    )}>
                                                      {field.value || '0'}
                                                    </p>
                                                </div>
                                            </button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                             {/* Category Input */}
                             <FormField
                                control={form.control}
                                name={`splits.${index}.categoryId`}
                                render={({ field }) => {
                                    const selectedCat = categories.find(c => c._id === field.value);
                                    return (
                                        <FormItem>
                                            <FormControl>
                                                <MobileSelectionDrawer
                                                    title="Select Category"
                                                    value={field.value}
                                                    onSelect={field.onChange}
                                                    options={categories.map(cat => ({
                                                        value: cat._id,
                                                        label: cat.name,
                                                        subLabel: cat.type === 'expense' && (cat.budgetLimit || 0) > 0 
                                                            ? `Available: ${formatCurrency(cat.remaining)}` 
                                                            : undefined
                                                    }))}
                                                    trigger={
                                                        <button type="button" className="w-full text-left outline-none">
                                                            <MobileInputCard 
                                                                label="Category" 
                                                                icon={LayoutGrid} 
                                                                valueDisplay={selectedCat?.name}
                                                                subValueDisplay={selectedCat?.type === 'expense' && (selectedCat.budgetLimit || 0) > 0 
                                                                    ? `Avail: ${formatCurrency(selectedCat.remaining)}` 
                                                                    : undefined
                                                                }
                                                            />
                                                        </button>
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />

                            {/* Label Input */}
                            <FormField
                                control={form.control}
                                name={`splits.${index}.labelId`}
                                render={({ field }) => {
                                     const selectedLabel = labels?.find(l => l._id === field.value);
                                     return (
                                        <FormItem>
                                            <FormControl>
                                                <MobileSelectionDrawer
                                                    title="Select Label"
                                                    value={field.value}
                                                    onSelect={field.onChange}
                                                    options={[
                                                        { value: 'none', label: 'None' },
                                                        ...(labels?.map(lbl => ({
                                                            value: lbl._id,
                                                            label: lbl.name
                                                        })) || [])
                                                    ]}
                                                    trigger={
                                                        <button type="button" className="w-full text-left outline-none">
                                                            <MobileInputCard label="Label" icon={Tag} valueDisplay={selectedLabel?.name || "None"} />
                                                        </button>
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                     );
                                }}
                            />

                            {/* Note Input */}
                             <FormField
                                control={form.control}
                                name={`splits.${index}.description`}
                                render={({ field }) => (
                                    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                                                <Textarea 
                                                    placeholder="Add split note..." 
                                                    className="min-h-[40px] border-none shadow-none resize-none p-0 focus-visible:ring-0 text-base" 
                                                    enterKeyHint="done"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                    ) : (
                         // Desktop Layout for Split Item (Preserved compact style)
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name={`splits.${index}.categoryId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value} key={field.value}>
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
                                            <FormMessage />
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
                                            <FormMessage />
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
                                            <Select onValueChange={field.onChange} value={field.value} key={field.value}>
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
                        </>
                    )}
                </div>
            ))}
        </div>

        <MobileAmountInput
            open={activeSplitAmount !== null}
            onOpenChange={(open) => {
              if (!open) setActiveSplitAmount(null);
            }}
            value={activeSplitAmount?.value || ''}
            onChange={(val) => {
              if (activeSplitAmount !== null) {
                form.setValue(`splits.${activeSplitAmount.index}.amount`, val as any);
              }
            }}
            onDone={() => setActiveSplitAmount(null)}
        />

        <Button 
            type="button" 
            variant="outline" 
            size="lg"
            className="w-full border-dashed h-12 rounded-xl text-muted-foreground hover:text-primary hover:border-primary/50" 
            onClick={() => append({ categoryId: '', amount: '', description: '', labelId: '' })}
        >
            <PlusCircle className="mr-2 h-5 w-5" /> Add Another Split
        </Button>
    </div>
  );
};
