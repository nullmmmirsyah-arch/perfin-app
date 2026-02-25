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
import { formatCurrency, cn } from '@/lib/utils'
import { Loader2, ArrowRight, AlertTriangle } from 'lucide-react'

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
                    <div className={cn(
                        "flex justify-between items-center p-3 rounded-lg",
                        totalRollover >= 0 ? "bg-success/10" : "bg-destructive/10"
                    )}>
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm">
                                {totalRollover >= 0 ? "Rollover Surplus" : "Carryover Debt"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {totalRollover >= 0 ? "Moving savings forward" : "Budget deficit must be closed"}
                            </span>
                        </div>
                        <span className={cn("font-bold", totalRollover >= 0 ? "text-success" : "text-destructive")}>
                            {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
                        </span>
                    </div>
                    <div className="border rounded-md divide-y overflow-hidden">
                        {rollovers.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 text-xs bg-card">
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.categoryName}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {item.amount >= 0 ? "Remaining balance" : "Overspent this month"}
                                    </span>
                                </div>
                                <span className={cn("font-semibold", item.amount >= 0 ? "text-success" : "text-destructive")}>
                                    {formatCurrency(item.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {proposals.length === 0 && (
                <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed border-muted">
                    <div className="flex justify-center mb-2">
                         <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                            <ArrowRight className="h-6 w-6 text-muted-foreground rotate-45" />
                         </div>
                    </div>
                    <p className="font-medium text-sm">No actions required</p>
                    <p className="text-xs text-muted-foreground px-4">All budgets were either spent exactly or are already finalized.</p>
                </div>
            )}
        </div>

        <DialogFooter className="border-t pt-4 sm:pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing || proposals.length === 0} className="flex-1 sm:flex-none">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm Process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
