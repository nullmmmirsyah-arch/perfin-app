"use client";

import { useState, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

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
  const prevOpen = useRef(open);
  const [rawValue, setRawValue] = useState('');

  if (open && !prevOpen.current) {
    setRawValue(value ? value.replace(/,/g, '') : '');
  }
  prevOpen.current = open;

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setRawValue(prev => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (rawValue.includes('.')) return;
      if (!rawValue) {
        setRawValue('0.');
        return;
      }
      setRawValue(prev => prev + '.');
      return;
    }
    setRawValue(prev => prev + key);
  };

  const handleDone = () => {
    if (!rawValue || parseFloat(rawValue) === 0) return;
    onChange(formatNumber(rawValue));
    onDone();
  };

  const displayAmount = formatNumber(rawValue);
  const isEmpty = !rawValue || parseFloat(rawValue) === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background z-50">
        <div className="px-6 pt-4 pb-8 flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center py-6 min-h-[100px]">
            <span className="text-sm font-medium text-muted-foreground mb-2">Rp</span>
            <div className={cn(
              "font-bold text-foreground text-center transition-all leading-tight",
              displayAmount.length > 12 ? "text-3xl" : displayAmount.length > 8 ? "text-4xl" : "text-5xl"
            )}>
              {displayAmount || '0'}
            </div>
            {isOverspent && (
              <div className="flex items-center gap-1 mt-3 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                <AlertCircle className="h-3 w-3" /> Insufficient Balance
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 items-center">
            {numpadRows.map((row, ri) => (
              <div key={ri} className="flex gap-3 justify-center">
                {row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "h-16 w-16 rounded-full text-xl font-semibold transition-all active:scale-90 select-none",
                      key === '⌫'
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-card text-foreground shadow-sm border border-border/50 hover:bg-accent"
                    )}
                    onClick={() => {
                      handleKey(key);
                      if (navigator.vibrate) navigator.vibrate(10);
                    }}
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
              "w-full h-14 rounded-full text-base font-semibold transition-all select-none",
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
