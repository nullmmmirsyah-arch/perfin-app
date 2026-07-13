import React, { useState, useMemo, useCallback } from 'react';
import { Doc } from '../convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, PlusCircle, Search, Store, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

type MerchantComboboxProps = {
  value?: string;
  onSelect: (merchantId: string | undefined) => void;
  merchants: Doc<'merchants'>[];
  trigger?: React.ReactNode;
};

const MerchantCombobox = ({ 
  value, 
  onSelect, 
  merchants,
  trigger
}: MerchantComboboxProps) => {
  const isMobile = useIsMobile();
  const { householdId } = useHousehold();
  const createMerchant = useMutation(api.merchants.create);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredMerchants = useMemo(() => {
    if (!search.trim()) return merchants;
    const lower = search.toLowerCase();
    return merchants.filter(m => 
      m.name.toLowerCase().includes(lower)
    );
  }, [merchants, search]);

  const selectedMerchant = merchants?.find(m => m._id === value);

  const handleSelect = useCallback((merchantId: string | undefined) => {
    onSelect(merchantId);
    setOpen(false);
    setSearch('');
  }, [onSelect]);

  const handleCreate = useCallback(async () => {
    if (!search.trim() || !householdId || isCreating) return;
    navigator.vibrate(10);
    
    setIsCreating(true);
    try {
      // Use first letter as icon
      const firstLetter = search.trim().charAt(0).toUpperCase();
      const newId = await createMerchant({
        householdId,
        name: search.trim(),
        icon: firstLetter,
      });
      onSelect(newId as string);
      setOpen(false);
      setSearch('');
      toast.success(`Merchant "${search.trim()}" created`);
    } catch (error) {
      console.error("Failed to create merchant:", error);
      toast.error("Failed to create merchant");
    } finally {
      setIsCreating(false);
    }
  }, [search, householdId, isCreating, createMerchant, onSelect]);

  const content = (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
        {/* None option */}
        <button
          type="button"
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
            !value ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
          )}
          onClick={() => handleSelect(undefined)}
        >
          <span className={cn("font-medium", !value ? "text-primary" : "text-muted-foreground")}>
            None
          </span>
          {!value && <Check className="h-4 w-4 text-primary" />}
        </button>

        {/* Merchant list */}
        {filteredMerchants.map((merchant) => (
          <button
            key={merchant._id}
            type="button"
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
              value === merchant._id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
            )}
            onClick={() => handleSelect(merchant._id)}
          >
            <div className="flex items-center gap-2">
              {merchant.icon.startsWith('http') ? (
                // URL icon (from Iconify)
                <img src={merchant.icon} alt="" className="w-6 h-6" />
              ) : merchant.icon.length <= 2 && !merchant.icon.includes(':') ? (
                // Letter avatar
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{merchant.icon}</span>
                </div>
              ) : (
                // Emoji
                <span className="text-lg">{merchant.icon}</span>
              )}
              <span className={cn("font-medium", value === merchant._id ? "text-primary" : "text-foreground")}>
                {merchant.name}
              </span>
            </div>
            {value === merchant._id && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}

        {/* No results */}
        {filteredMerchants.length === 0 && search.trim() && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No merchants found
          </div>
        )}

        {/* Create new button - only show when searching */}
        {search.trim() && (
          <button
            type="button"
            className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 text-primary font-medium transition-all hover:bg-primary/10"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            <span>Create &quot;{search.trim()}&quot;</span>
          </button>
        )}
      </div>
    </div>
  );

  const defaultTrigger = (
    <button type="button" className="w-full text-left outline-none">
      <div className="flex items-center justify-between w-full p-2 border rounded-md hover:bg-muted transition-colors">
        <div className="flex items-center gap-2">
          {selectedMerchant ? (
            <>
              {selectedMerchant.icon.startsWith('http') ? (
                <img src={selectedMerchant.icon} alt="" className="w-6 h-6" />
              ) : selectedMerchant.icon.length <= 2 && !selectedMerchant.icon.includes(':') ? (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{selectedMerchant.icon}</span>
                </div>
              ) : (
                <span className="text-lg">{selectedMerchant.icon}</span>
              )}
              <span>{selectedMerchant.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select merchant...</span>
          )}
        </div>
        <Store className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}>
        <div onClick={() => setOpen(true)}>
          {trigger || defaultTrigger}
        </div>
        <DrawerContent className="z-50 max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Select Merchant</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pt-0">
            {content}
          </div>
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) setSearch('');
    }}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
};

export default MerchantCombobox;
