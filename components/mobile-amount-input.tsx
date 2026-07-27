"use client";

import { useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { AlertCircle } from '@/components/ui/icons';
import { toast } from 'sonner';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const controls = useAnimation();

  const triggerPulse = () => {
    controls.start({
      scale: [1, 1.06, 1],
      transition: { duration: 0.25, ease: 'easeOut' },
    });
  };

  const applyPaste = (text: string) => {
    if (!text?.trim()) return;
    const result = parseClipboardAmount(text.trim());
    if (!result) return;
    onChange(result.value);
    triggerPulse();
    if (navigator.vibrate) navigator.vibrate(10);
    if (result.capped) {
      toast.warning('Amount capped at maximum');
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    applyPaste(e.clipboardData.getData('text'));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
  };

  const handleKey = (key: string) => {
    if (key === '⌫') {
      const newRaw = rawValue.slice(0, -1);
      onChange(newRaw ? formatNumber(newRaw) : '');
      if (navigator.vibrate) navigator.vibrate(10);
      triggerPulse();
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
      triggerPulse();
      return;
    }
    onChange(formatNumber(rawValue + key));
    if (navigator.vibrate) navigator.vibrate(10);
    triggerPulse();
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
          <div className="flex flex-col items-center justify-center py-4 min-h-[80px]">
            <span className="text-xs font-medium text-muted-foreground mb-1">Rp</span>
            <motion.input
              ref={inputRef}
              type="text"
              inputMode="none"
              animate={controls}
              value={displayAmount || '0'}
              className={cn(
                "font-bold text-foreground text-center leading-tight bg-muted/50 border border-border/50 rounded-xl px-4 py-2 outline-none max-w-[280px] w-full caret-primary",
                displayAmount.length > 12 ? "text-2xl" : displayAmount.length > 8 ? "text-3xl" : "text-4xl"
              )}
              onPaste={handlePasteEvent}
              onKeyDown={handleKeyDown}
              onChange={() => {}}
              onFocus={(e) => e.target.select()}
            />
            <AnimatePresence>
              {isOverspent && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full"
                >
                  <AlertCircle className="h-3 w-3" /> Insufficient Balance
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-2">
            {numpadRows.map((row, ri) => (
              <div key={ri} className="flex gap-2 justify-center">
                {row.map((key) => (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    className={cn(
                      "h-14 w-0 flex-1 max-w-[88px] rounded-xl text-lg font-semibold select-none",
                      key === '⌫'
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-card text-foreground shadow-sm border border-border/50 hover:bg-accent"
                    )}
                    onClick={() => handleKey(key)}
                  >
                    {key}
                  </motion.button>
                ))}
              </div>
            ))}
          </div>

          <motion.button
            type="button"
            disabled={isEmpty}
            whileTap={isEmpty ? {} : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={cn(
              "w-full h-12 rounded-xl text-base font-semibold select-none",
              isEmpty
                ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                : "bg-primary text-primary-foreground shadow-lg hover:opacity-90"
            )}
            onClick={handleDone}
          >
            Done
          </motion.button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
