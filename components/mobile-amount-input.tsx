"use client";

import { useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MobileAmountInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
  isOverspent?: boolean;
}

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const MAX_AMOUNT = 99_999_999_999;

const parseClipboardAmount = (text: string): { value: string; capped: boolean } | null => {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  if (num > MAX_AMOUNT) return { value: formatNumber(String(MAX_AMOUNT)), capped: true };
  const hasDecimal = cleaned.includes('.');
  if (hasDecimal) {
    const dotIndex = cleaned.indexOf('.');
    const intPart = cleaned.slice(0, dotIndex);
    const decPart = cleaned.slice(dotIndex + 1);
    return { value: formatNumber(intPart) + '.' + decPart.slice(0, 2), capped: false };
  }
  return { value: formatNumber(cleaned), capped: false };
};

const numpadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export const MobileAmountInput = ({
  open,
  onOpenChange,
  value,
  onChange,
  onDone,
  isOverspent,
}: MobileAmountInputProps) => {
  const rawValue = value.replace(/,/g, '');

  const pasteInputRef = useRef<HTMLInputElement>(null);
  const pointerStartTime = useRef(0);

  const applyPaste = (text: string) => {
    if (!text?.trim()) {
      toast.info('Nothing to paste');
      return;
    }
    const result = parseClipboardAmount(text.trim());
    if (!result) {
      toast.error('Invalid amount');
      return;
    }
    onChange(result.value);
    if (navigator.vibrate) navigator.vibrate(10);
    if (result.capped) {
      toast.warning('Amount capped at maximum');
    } else {
      toast.success('Amount pasted');
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    applyPaste(text);
    pasteInputRef.current?.blur();
  };

  const handlePointerDown = () => {
    pointerStartTime.current = performance.now();
  };

  const handlePointerUp = () => {
    const elapsed = performance.now() - pointerStartTime.current;
    if (elapsed >= 500) {
      pasteInputRef.current?.focus();
    }
  };

  const handleKey = (key: string) => {
    if (key === '⌫') {
      const newRaw = rawValue.slice(0, -1);
      onChange(newRaw ? formatNumber(newRaw) : '');
      if (navigator.vibrate) navigator.vibrate(10);
      return;
    }
    if (key === '.') {
      if (rawValue.includes('.')) return;
      if (!rawValue) {
        onChange('0.');
      } else {
        onChange(formatNumber(rawValue) + '.');
      }
      if (navigator.vibrate) navigator.vibrate(10);
      return;
    }
    // Digit key
    onChange(formatNumber(rawValue + key));
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleDone = () => {
    const num = parseFloat(rawValue);
    if (!rawValue || num === 0) return;
    if (rawValue !== value.replace(/,/g, '')) {
      onChange(formatNumber(rawValue));
    }
    onDone();
  };

  const rawEndsWithDot = rawValue.endsWith('.');
  const displayAmount = rawEndsWithDot
    ? formatNumber(rawValue.slice(0, -1)) + '.'
    : (value || '0');
  const isEmpty = !rawValue || parseFloat(rawValue) === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background z-50">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Enter Amount</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pt-3 pb-6 flex flex-col gap-4">
          <input
            ref={pasteInputRef}
            type="text"
            className="absolute w-px h-px opacity-0 p-0 -z-10"
            onPaste={handlePasteEvent}
            aria-hidden="true"
          />
          <div className="flex flex-col items-center justify-center py-4 min-h-[80px]">
            <span className="text-xs font-medium text-muted-foreground mb-1">Rp</span>
            <div
              className={cn(
                "font-bold text-foreground text-center transition-all leading-tight cursor-pointer select-none active:scale-[0.98]",
                displayAmount.length > 12 ? "text-2xl" : displayAmount.length > 8 ? "text-3xl" : "text-4xl"
              )}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              {displayAmount || '0'}
            </div>
            {!rawValue && (
              <span className="text-[10px] text-muted-foreground/60 mt-1 motion-safe:animate-pulse">
                Long press to paste
              </span>
            )}
            {isOverspent && (
              <div className="flex items-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                <AlertCircle className="h-3 w-3" /> Insufficient Balance
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {numpadRows.map((row, ri) => (
              <div key={ri} className="flex gap-2 justify-center">
                {row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "h-14 w-0 flex-1 max-w-[88px] rounded-xl text-lg font-semibold transition-all active:scale-[0.97] select-none",
                      key === '⌫'
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-card text-foreground shadow-sm border border-border/50 hover:bg-accent"
                    )}
                    onClick={() => handleKey(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={isEmpty}
            className={cn(
              "w-full h-12 rounded-xl text-base font-semibold transition-all select-none",
              isEmpty
                ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                : "bg-primary text-primary-foreground shadow-lg active:scale-[0.98] hover:opacity-90"
            )}
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
