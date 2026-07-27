'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, ArrowRight, ArrowLeftRight, CircleArrowRight, CircleArrowDown, AlertTriangle } from '@/components/ui/icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Loader2 } from '@/components/ui/icons'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

type ProposalType = 'sweep' | 'rollover'

type ProposalItem = {
  type: ProposalType
  categoryId: string
  categoryName: string
  amount: number
}

interface ConfirmStepProps {
  proposals: ProposalItem[]
  isProcessing: boolean
  onConfirm: (result: { categoryId: string; type: ProposalType }[]) => void
  onBack: () => void
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export function ConfirmStep({
  proposals,
  isProcessing,
  onConfirm,
  onBack
}: ConfirmStepProps) {
  // Track which categories are selected and their overridden type
  const [items, setItems] = useState<Map<string, { selected: boolean; type: ProposalType }>>(
    new Map()
  )

  // Initialize from proposals
  useEffect(() => {
    const map = new Map<string, { selected: boolean; type: ProposalType }>()
    proposals.forEach(p => {
      map.set(String(p.categoryId), { selected: true, type: p.type })
    })
    setItems(map)
  }, [proposals])

  const toggleSelected = (categoryId: string) => {
    setItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(categoryId)
      if (item) {
        newMap.set(categoryId, { ...item, selected: !item.selected })
      }
      return newMap
    })
  }

  const toggleType = (categoryId: string) => {
    setItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(categoryId)
      if (item) {
        const newType: ProposalType = item.type === 'sweep' ? 'rollover' : 'sweep'
        newMap.set(categoryId, { ...item, type: newType })
      }
      return newMap
    })
  }

  // Build final list with overridden types
  const finalProposals = proposals.map(p => {
    const state = items.get(String(p.categoryId))
    return {
      ...p,
      selected: state?.selected ?? true,
      finalType: state?.type ?? p.type
    }
  })

  const selectedItems = finalProposals.filter(p => p.selected)
  const sweepItems = selectedItems.filter(p => p.finalType === 'sweep')
  const rolloverItems = selectedItems.filter(p => p.finalType === 'rollover')
  const totalSwept = sweepItems.reduce((acc, p) => acc + p.amount, 0)
  const totalRollover = rolloverItems.reduce((acc, p) => acc + p.amount, 0)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleConfirm = () => {
    const result = selectedItems.map(p => ({
      categoryId: p.categoryId,
      type: p.finalType
    }))
    onConfirm(result)
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-4"
    >
      {/* Empty state */}
      {proposals.length === 0 ? (
        <motion.div variants={fadeInUp} className="text-center py-8">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">All Caught Up!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No sweep or rollover actions needed for this period.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Your previous period budgets are all balanced.
          </p>
          <Button onClick={onBack} className="w-full">
            Back to Review
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
            <h3 className="text-lg font-bold">Customize Actions</h3>
            <p className="text-xs text-muted-foreground">
              Toggle type or exclude categories
            </p>
          </motion.div>

      {/* Category List */}
      <motion.div variants={fadeInUp} className="space-y-2">
        {proposals.map((item) => {
          const state = items.get(String(item.categoryId)) || { selected: true, type: item.type }
          const isSweep = state.type === 'sweep'
          const isNegative = item.amount < 0

          return (
            <motion.div
              key={String(item.categoryId)}
              variants={fadeInUp}
              className={cn(
                "p-3 rounded-xl border transition-all",
                state.selected
                  ? isNegative
                    ? "bg-destructive/5 border-destructive/20"
                    : isSweep
                      ? "bg-primary/5 border-primary/20"
                      : "bg-success/5 border-success/20"
                  : "bg-muted/30 border-muted opacity-50"
              )}
            >
              {/* Top row: checkbox + name + amount */}
              <div
                onClick={() => toggleSelected(String(item.categoryId))}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                    state.selected
                      ? isNegative ? "bg-destructive border-destructive"
                        : isSweep ? "bg-primary border-primary" : "bg-success border-success"
                      : "border-muted-foreground"
                  )}>
                    {state.selected && <CheckCircle2 className={cn(
                      "h-3 w-3",
                      isNegative ? "text-destructive-foreground"
                        : isSweep ? "text-primary-foreground" : "text-success-foreground"
                    )} />}
                  </div>
                  <span className={cn("text-sm font-medium", !state.selected && "text-muted-foreground")}>
                    {item.categoryName}
                  </span>
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  state.selected
                    ? isNegative ? "text-destructive"
                      : isSweep ? "text-primary" : "text-success"
                    : "text-muted-foreground"
                )}>
                  {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
                </span>
              </div>

              {/* Bottom row: type toggle */}
              {state.selected && (
                <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Action
                  </span>
                  <button
                    onClick={() => toggleType(String(item.categoryId))}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                      isNegative
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : isSweep
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-success/10 text-success hover:bg-success/20"
                    )}
                  >
                    {isSweep ? (
                      <>
                        <CircleArrowRight className="h-3 w-3" />
                        Sweep to Unassigned
                      </>
                    ) : (
                      <>
                        <CircleArrowDown className="h-3 w-3" />
                        Roll Over to Next Month
                      </>
                    )}
                    <ArrowLeftRight className="h-3 w-3 ml-1 opacity-50" />
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>

      {/* Summary */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        <div className="bg-primary/5 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-primary">{sweepItems.length}</p>
          <p className="text-[10px] text-muted-foreground">Sweep</p>
          {totalSwept > 0 && (
            <p className="text-[10px] text-primary">+{formatCurrency(totalSwept)}</p>
          )}
        </div>
        <div className="bg-success/5 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-success">{rolloverItems.length}</p>
          <p className="text-[10px] text-muted-foreground">Rollover</p>
          {totalRollover !== 0 && (
            <p className={cn("text-[10px]", totalRollover >= 0 ? "text-success" : "text-destructive")}>
              {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
            </p>
          )}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeInUp} className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1"
        >
          Back
        </Button>

        <Button
          onClick={() => setShowConfirmDialog(true)}
          disabled={isProcessing || selectedItems.length === 0}
          className="flex-1"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Process {selectedItems.length} Categories
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Month-End Process
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>You are about to process <strong>{selectedItems.length} categories</strong>:</div>
              {sweepItems.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium text-primary">{sweepItems.length} sweep</span>
                  {totalSwept > 0 && ` — ${formatCurrency(totalSwept)} will move to Unassigned`}
                </div>
              )}
              {rolloverItems.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium text-success">{rolloverItems.length} rollover</span>
                  {totalRollover !== 0 && ` — ${totalRollover > 0 ? '+' : ''}${formatCurrency(totalRollover)} will carry to next month`}
                </div>
              )}
              <div className="text-destructive font-medium text-sm pt-2">
                This action cannot be undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isProcessing}
              className={cn(
                buttonVariants(),
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Process'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </motion.div>
  )
}
