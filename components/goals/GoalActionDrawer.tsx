'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useHousehold } from '@/components/HouseholdProvider'
import { parseAmount, formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowRightLeft, PiggyBank, Wallet } from '@/components/ui/icons'
import { ACCOUNT_TYPES, TRANSACTION_TYPES } from '@/convex/lib/constants'

type ActionType = 'deposit' | 'withdraw'

interface GoalActionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalName: string
  goalAccountId: Id<"accounts">
  goalCategoryId: Id<"categories">
  actionType: ActionType
  suggestionAmount?: number
}

export function GoalActionDrawer({ 
  open, 
  onOpenChange, 
  goalName, 
  goalAccountId,
  goalCategoryId,
  actionType,
  suggestionAmount
}: GoalActionDrawerProps) {
  const { householdId } = useHousehold()
  
  // Form State
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [selectedLiquidAccountId, setSelectedLiquidAccountId] = useState<string>('')
  const [isDisbursement, setIsDisbursement] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sourceBalance, setSourceBalance] = useState<number>(0)
  const [goalBalance, setGoalBalance] = useState<number>(0)

  // Fetch Liquid Accounts (Cash/Bank)
  const allAccounts = useQuery(api.accounts.get, { 
    householdId: householdId ?? undefined,
    showArchived: false
  })

  const goalAccount = allAccounts?.find(a => a._id === goalAccountId)
  const isAsset = goalAccount?.type === ACCOUNT_TYPES.ASSET
  const isDeposit = actionType === 'deposit'

  const liquidAccounts = allAccounts?.filter(a => 
    !a.type || a.type === ACCOUNT_TYPES.CASH
  ) || []

  useEffect(() => {
    if (allAccounts) {
      const source = allAccounts.find(a => a._id === selectedLiquidAccountId)
      if (source) {
        setSourceBalance(parseAmount(source.balance))
      }
      const goal = allAccounts.find(a => a._id === goalAccountId)
      if (goal) {
        setGoalBalance(parseAmount(goal.balance))
      }
    }
  }, [allAccounts, selectedLiquidAccountId, goalAccountId])

  // Set default liquid account (first one) when loaded
  useEffect(() => {
    if (open && liquidAccounts.length > 0 && !selectedLiquidAccountId) {
      setSelectedLiquidAccountId(liquidAccounts[0]._id)
    }
    // We NO LONGER auto-set the amount. We let the user choose.
    if (!open) {
        // Reset state on close
        setAmount('')
        setQuantity('')
        setIsDisbursement(false)
    }
  }, [open, liquidAccounts, selectedLiquidAccountId])

  const handleQuickFill = (percentage: number) => {
    const balance = isDeposit ? sourceBalance : goalBalance
    const amount = Math.floor(balance * percentage)
    setAmount(amount.toString())
  }

  const numericAmount = parseAmount(amount)
  const afterBalance = isDeposit 
    ? sourceBalance - numericAmount 
    : goalBalance - numericAmount
  const hasInsufficientBalance = amount && numericAmount > (isDeposit ? sourceBalance : goalBalance)

  const createTransaction = useMutation(api.transactions.create)

  const handleSubmit = async () => {
    const submitAmount = parseAmount(amount)
    if (!amount || submitAmount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    if (!selectedLiquidAccountId) {
      toast.error("Please select a wallet account")
      return
    }
    if (isAsset && (!quantity || parseFloat(quantity) <= 0)) {
      toast.error(`Please enter the quantity of ${goalAccount?.unit || 'units'}`)
      return
    }

    setIsSubmitting(true)
    try {
      const txData = actionType === 'deposit' 
        ? {
            // DEPOSIT: Liquid -> Goal
            accountId: selectedLiquidAccountId as Id<"accounts">,
            toAccountId: goalAccountId,
            categoryId: goalCategoryId,
            description: `Deposit to ${goalName}`,
            isGoalDisbursement: false,
            assetDetails: isAsset ? { quantity: quantity } : undefined
          }
        : {
            // WITHDRAW: Goal -> Liquid
            accountId: goalAccountId,
            toAccountId: selectedLiquidAccountId as Id<"accounts">,
            categoryId: goalCategoryId,
            description: isDisbursement ? `Goal Reached: ${goalName}` : `Withdraw from ${goalName}`,
            isGoalDisbursement: isDisbursement,
            assetDetails: isAsset ? { quantity: quantity } : undefined
          }

      await createTransaction({
        householdId: householdId ?? undefined,
        type: TRANSACTION_TYPES.TRANSFER,
        amount: submitAmount.toString(),
        date: new Date().toISOString(),
        ...txData
      })

      toast.success(actionType === 'deposit' ? 'Funds added successfully!' : 'Funds withdrawn successfully!')
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error("Failed to process transaction")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Visuals
  const ActionIcon = isDeposit ? PiggyBank : ArrowRightLeft
  const themeColor = isDeposit ? "text-primary" : "text-destructive"

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-center gap-2 text-xl">
              <div className={`p-2 rounded-full bg-muted ${themeColor}`}>
                <ActionIcon className="h-6 w-6" />
              </div>
              {isDeposit ? "Add Funds" : "Withdraw Funds"}
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="p-4 space-y-6">
            {/* Visual Flow */}
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border border-dashed">
                <div className="flex flex-col items-center gap-1 w-1/3">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">From</span>
                    <div className="flex items-center gap-1 font-medium text-sm text-center">
                        {isDeposit ? (
                            <>
                                <Wallet className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">Wallet</span>
                            </>
                        ) : (
                            <>
                                <PiggyBank className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">{goalName}</span>
                            </>
                        )}
                    </div>
                </div>

                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />

                <div className="flex flex-col items-center gap-1 w-1/3">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">To</span>
                    <div className="flex items-center gap-1 font-medium text-sm text-center">
                        {isDeposit ? (
                            <>
                                <PiggyBank className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">{goalName}</span>
                            </>
                        ) : (
                            <>
                                <Wallet className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">Wallet</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Account Selection */}
            <div className="space-y-2">
                <Label>{isDeposit ? "Source Account (Wallet)" : "Destination Account (Wallet)"}</Label>
                <Select value={selectedLiquidAccountId} onValueChange={setSelectedLiquidAccountId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                        {liquidAccounts.map(acc => (
                            <SelectItem key={acc._id} value={acc._id}>
                                {acc.name} ({formatCurrency(acc.balance)})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
                <Label>{isDeposit ? "Jumlah yang ingin ditabung" : "Jumlah yang ingin ditarik"}</Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                        Rp
                    </span>
                    <Input 
                        type="number" 
                        inputMode="numeric"
                        className="pl-10 text-lg font-bold"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                {suggestionAmount && suggestionAmount > 0 && (
                    <div className="flex justify-end">
                        <button 
                            onClick={() => setAmount(suggestionAmount.toString())}
                            className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded-full transition-colors font-medium"
                        >
                            Suggestion: {formatCurrency(suggestionAmount)}
                        </button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-medium">Quick Fill:</span>
                    {[0.25, 0.5, 1].map((pct) => (
                        <button
                            key={pct}
                            type="button"
                            onClick={() => handleQuickFill(pct)}
                            className="text-[10px] bg-muted hover:bg-muted/80 px-2 py-1 rounded-full transition-colors font-medium"
                        >
                            {pct * 100}%
                        </button>
                    ))}
                </div>
                {amount && numericAmount > 0 && (
                    <div className="animate-in fade-in duration-200">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Saldo setelah:</span>
                            <div className="text-right">
                                <span className={cn("font-semibold", afterBalance < 0 ? "text-destructive" : "text-foreground")}>
                                    {formatCurrency(afterBalance)}
                                </span>
                                <span className={cn("text-xs ml-1", afterBalance < 0 ? "text-destructive" : "text-success")}>
                                    ({isDeposit ? "-" : "+"}{formatCurrency(numericAmount)})
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                {hasInsufficientBalance && (
                    <div className="text-destructive text-xs font-medium bg-destructive/10 p-2 rounded-md animate-in fade-in">
                        Saldo tidak mencukupi. Kurang {formatCurrency(numericAmount - (isDeposit ? sourceBalance : goalBalance))}
                    </div>
                )}
            </div>

            {/* Asset Quantity (Only for Assets) */}
            {isAsset && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <Label>Quantity ({goalAccount?.unit || 'units'})</Label>
                    <div className="relative">
                        <Input 
                            type="number" 
                            step="any"
                            inputMode="decimal"
                            className="pr-12 text-lg font-bold"
                            placeholder="0.00"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded text-xs">
                            {goalAccount?.unit || 'units'}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                        {isDeposit 
                            ? `How many ${goalAccount?.unit || 'units'} did you buy?` 
                            : `How many ${goalAccount?.unit || 'units'} did you sell?`}
                    </p>
                </div>
            )}

            {/* Withdraw Options */}
            {!isDeposit && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-md border border-blue-100 dark:border-blue-800">
                    <Switch 
                        id="disburse" 
                        checked={isDisbursement} 
                        onCheckedChange={setIsDisbursement} 
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="disburse" className="text-sm font-semibold cursor-pointer">
                            Spend Goal (Disbursement)
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                            Enable this if you are using the money for its intended purpose (e.g. buying the item). This won&apos;t mess up your saving history.
                        </p>
                    </div>
                </div>
            )}
          </div>

          <DrawerFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting || !!hasInsufficientBalance} className={!isDeposit ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}>
              {isSubmitting ? "Processing..." : (isDeposit ? "Confirm Deposit" : "Confirm Withdraw")}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}