import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MobileSelectionDrawer = ({ 
  title, 
  options, 
  value, 
  selectedValues,
  onSelect, 
  trigger,
  children,
  disabled,
  closeOnSelect = true
}: { 
  title: string, 
  options?: { value: string, label: React.ReactNode, subLabel?: string, isAction?: boolean }[], 
  value?: string | Date, 
  selectedValues?: string[],
  onSelect?: (val: string) => void, 
  trigger: React.ReactNode,
  children?: React.ReactNode | ((props: { close: () => void }) => React.ReactNode),
  disabled?: boolean,
  closeOnSelect?: boolean
}) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  
  const isSelected = (optValue: string) => {
    if (selectedValues) return selectedValues.includes(optValue);
    return value === optValue;
  };
  
  return (
    <Drawer open={disabled ? false : open} onOpenChange={setOpen}>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="z-50 max-h-[85vh]">
         <DrawerHeader className="text-left pb-2">
            <DrawerTitle>{title}</DrawerTitle>
         </DrawerHeader>
         <div className="p-4 pt-0 flex flex-col gap-2 overflow-y-auto">
            {children ? (
                <div className="flex justify-center">
                    {typeof children === 'function' ? children({ close }) : children}
                </div>
            ) : (
                options?.map((opt) => (
                    <button 
                    key={opt.value} 
                    type="button"
                    className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] text-left",
                        isSelected(opt.value) ? "border-primary bg-primary/5" : "border-border bg-card",
                        opt.isAction && "border-primary/50 border-dashed bg-primary/5 shadow-sm"
                    )}
                    onClick={() => {
                        onSelect?.(opt.value);
                        if (closeOnSelect) setOpen(false);
                    }}
                    >
                    <div className="flex flex-col gap-0.5">
                            <span className={cn(
                                "font-semibold text-base", 
                                isSelected(opt.value) ? "text-primary" : "text-foreground",
                                opt.isAction && "text-primary"
                            )}>{opt.label}</span>
                            {opt.subLabel && <span className="text-xs text-muted-foreground">{opt.subLabel}</span>}
                    </div>
                    {isSelected(opt.value) ? (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                        opt.isAction && <PlusCircle className="h-5 w-5 text-primary/60 shrink-0" />
                    )}
                    </button>
                ))
            )}
         </div>
         <DrawerFooter className="pt-2">
            {!closeOnSelect && (
                <Button variant="default" className="w-full" onClick={close}>Done</Button>
            )}
            <DrawerClose asChild>
                <Button variant="outline" className="w-full">Cancel</Button>
            </DrawerClose>
         </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export const MobileInputCard = ({ 
    label, 
    icon: Icon, 
    children, 
    valueDisplay, 
    subValueDisplay,
    onClick 
}: { 
    label: string, 
    icon: React.ElementType, 
    children?: React.ReactNode, 
    valueDisplay?: string,
    subValueDisplay?: string,
    onClick?: () => void
}) => {
    // This is a visual wrapper that looks like a card.
    return (
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border relative group active:scale-[0.99] transition-transform duration-100" onClick={onClick}>
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="font-semibold text-foreground truncate text-base">
                        {valueDisplay || "Select..."}
                    </p>
                    {subValueDisplay && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{subValueDisplay}</p>
                    )}
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
            </div>
            {children && (
                <div className="absolute inset-0 opacity-0 cursor-pointer">
                    {children}
                </div>
            )}
        </div>
    );
};
