import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { Check, PlusCircle, Search, Tag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { MobileInputCard } from '@/components/ui/mobile-inputs';

const LABEL_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  '#14b8a6', '#84cc16', '#a855f7', '#0ea5e9', '#f59e0b',
];

function getRandomColor(existingColors: string[]): string {
  const available = LABEL_COLORS.filter(c => !existingColors.includes(c));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
}

type LabelComboboxProps = {
  value: string[];
  onSelect: (ids: string[]) => void;
  labels: Doc<'labels'>[];
  trigger?: React.ReactNode;
};

const LabelCombobox = ({
  value,
  onSelect,
  labels,
  trigger
}: LabelComboboxProps) => {
  const isMobile = useIsMobile();
  const { householdId } = useHousehold();
  const createLabel = useMutation(api.labels.create);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedIds = value || [];

  const filteredLabels = useMemo(() => {
    if (!search.trim()) return labels;
    const lower = search.toLowerCase();
    return labels.filter(l =>
      l.name.toLowerCase().includes(lower)
    );
  }, [labels, search]);

  const selectedLabels = useMemo(() => {
    return labels.filter(l => selectedIds.includes(l._id));
  }, [labels, selectedIds]);

  const toggleLabel = useCallback((labelId: string) => {
    const next = selectedIds.includes(labelId)
      ? selectedIds.filter(id => id !== labelId)
      : [...selectedIds, labelId];
    onSelect(next);
  }, [selectedIds, onSelect]);

  const handleCreate = useCallback(async () => {
    if (!search.trim() || !householdId || isCreating) return;
    if (navigator.vibrate) navigator.vibrate(10);

    setIsCreating(true);
    try {
      const usedColors = labels.map(l => l.color || '');
      const color = getRandomColor(usedColors);
      const newId = await createLabel({
        householdId,
        name: search.trim(),
        color,
      });
      onSelect([...selectedIds, newId as string]);
      searchInputRef.current?.blur();
      setOpen(false);
      setSearch('');
      toast.success(`Label "${search.trim()}" created`);
    } catch (error) {
      console.error("Failed to create label:", error);
      toast.error("Failed to create label");
    } finally {
      setIsCreating(false);
    }
  }, [search, householdId, isCreating, createLabel, onSelect, selectedIds, labels]);

  const content = (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search labels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
        {/* Clear all option */}
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-muted transition-all text-left"
            onClick={() => {
              onSelect([]);
              searchInputRef.current?.blur();
              setOpen(false);
              setSearch('');
            }}
          >
            <span className="font-medium text-muted-foreground">Clear all</span>
          </button>
        )}

        {/* Label list */}
        {filteredLabels.map((label) => {
          const isSelected = selectedIds.includes(label._id);
          return (
            <button
              key={label._id}
              type="button"
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
              )}
              onClick={() => toggleLabel(label._id)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: label.color || '#6b7280' }}
                />
                <span className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>
                  {label.name}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}

        {/* No results */}
        {filteredLabels.length === 0 && search.trim() && (
          <div className="text-center py-2 text-muted-foreground text-sm">
            No labels found
          </div>
        )}

        {/* Create new button */}
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

  const selectedDisplay = selectedLabels.length > 0
    ? `${selectedLabels.length} selected`
    : undefined;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}>
        <div onClick={() => setOpen(true)}>
          {trigger || (
            <button type="button" className="w-full text-left outline-none">
              <MobileInputCard
                label="Labels"
                icon={Tag}
                valueDisplay={selectedDisplay || 'None'}
              />
            </button>
          )}
        </div>
        <DrawerContent className="z-50 max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Select Labels</DrawerTitle>
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
        {trigger || (
          <button type="button" className="w-full text-left outline-none">
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px]">
              {selectedLabels.map((lbl) => (
                <span
                  key={lbl._id}
                  className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-1 rounded-md"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: lbl.color || '#6b7280' }}
                  />
                  {lbl.name}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLabel(lbl._id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleLabel(lbl._id);
                      }
                    }}
                    className="ml-0.5 hover:text-destructive cursor-pointer"
                  >
                    ×
                  </span>
                </span>
              ))}
              <span className="text-xs text-muted-foreground">+ Add</span>
            </div>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
};

export default LabelCombobox;
