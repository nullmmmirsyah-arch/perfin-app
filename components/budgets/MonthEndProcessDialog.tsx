'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Id } from '../../convex/_generated/dataModel'
import { formatCurrency } from '@/lib/utils'
import { Loader2, ArrowRight } from 'lucide-react'

type ProposalItem = {
    type: 'sweep' | 'rollover';
    categoryId: Id<"categories">;
    categoryName: string;
    amount: number;
}

interface MonthEndProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: ProposalItem[];
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
}

export function MonthEndProcessDialog({
  open,
  onOpenChange,
  proposals,
  onConfirm,
  isProcessing
}: MonthEndProcessDialogProps) {
  
  const sweeps = proposals.filter(p => p.type === 'sweep');
  const rollovers = proposals.filter(p => p.type === 'rollover');

  const totalSwept = sweeps.reduce((acc, p) => acc + p.amount, 0);
  const totalRollover = rollovers.reduce((acc, p) => acc + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Process Month End</DialogTitle>
          <DialogDescription>
            Review the actions that will be taken to finalize last month's budget.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-2">
            
            {/* SWEEPS SECTION */}
            {sweeps.length > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg">
                        <span className="font-semibold text-sm">Sweeping to Unassigned</span>
                        <span className="font-bold text-primary">+{formatCurrency(totalSwept)}</span>
                    </div>
                    <div className="border rounded-md divide-y">
                        {sweeps.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 text-xs">
                                <span className="text-muted-foreground">{item.categoryName}</span>
                                <span>{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ROLLOVERS SECTION */}
            {rollovers.length > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg">
                        <span className="font-semibold text-sm">Rollover to This Month</span>
                        <span className={cn("font-bold", totalRollover >= 0 ? "text-primary" : "text-destructive")}>
                            {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
                        </span>
                    </div>
                    <div className="border rounded-md divide-y">
                        {rollovers.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 text-xs">
                                <span className="text-muted-foreground">{item.categoryName}</span>
                                <span className={cn(item.amount >= 0 ? "text-primary" : "text-destructive")}>
                                    {formatCurrency(item.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {proposals.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No pending actions found.
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing || proposals.length === 0}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm Process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper util import (needed because I used cn without importing it)
import { cn } from '@/lib/utils';
