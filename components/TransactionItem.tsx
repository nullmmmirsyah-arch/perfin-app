import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  MoreHorizontal, Trash2, Edit, ChevronDown, GitBranch,
} from '@/components/ui/icons'

import { TransactionWithDetails } from './transactions/types'

export function TransactionItem({ 
  transaction, 
  onEdit, 
  onDelete,
  highlightLabelId,
  highlightCategoryId,
  isPrivacyMode,
}: { 
  transaction: TransactionWithDetails, 
  onEdit?: () => void, 
  onDelete?: () => void,
  highlightLabelId?: string[],
  highlightCategoryId?: string[],
  isPrivacyMode?: boolean,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useUser();

  // Calculate effective amount based on filters
  let displayAmountVal = parseFloat(transaction.amount.replace(/,/g, '') || '0');
  const isFiltered = (highlightLabelId && highlightLabelId.length > 0) || (highlightCategoryId && highlightCategoryId.length > 0);
  
  if (isFiltered && transaction.isSplit && transaction.splits) {
    const filteredSum = transaction.splits.reduce((acc, split) => {
      const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelIds?.some(id => highlightLabelId.includes(String(id))));
      const categoryMatch = !highlightCategoryId || highlightCategoryId.length === 0 || (split.categoryId && highlightCategoryId.includes(String(split.categoryId)));
      
      if (labelMatch && categoryMatch) {
        return acc + parseFloat(split.amount.replace(/,/g, '') || '0');
      }
      return acc;
    }, 0);
    
    if (filteredSum > 0) displayAmountVal = filteredSum;
  }

  const shouldMask = (transaction.hideAmount && transaction.userId !== user?.id) || isPrivacyMode;

  const displayAmount = shouldMask
    ? '••••'
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(displayAmountVal);

  return (
    <Card className="overflow-hidden shadow-sm border-muted/60">
      <div className="flex justify-between items-center hover:bg-muted/30 transition-colors p-3.5">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-0 h-6 w-6 shrink-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
            <span className="sr-only">Toggle Details</span>
          </Button>
          <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
            {transaction.type === 'transfer' ? (
              <>
                <p className="font-semibold text-sm">
                  {transaction.fromAccountName} <span className="text-muted-foreground font-normal mx-1">→</span> {transaction.toAccountName}
                </p>
                {transaction.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {transaction.description}
                  </p>
                )}
              </>
            ) : (
              <div>
                <div className="flex items-center gap-1.5">
                  {transaction.merchant && (
                    transaction.merchant.icon.startsWith('http') ? (
                      <img src={transaction.merchant.icon} alt="" className="w-4 h-4 rounded-full shrink-0 object-cover" />
                    ) : transaction.merchant.icon.length === 1 && transaction.merchant.icon.match(/[a-zA-Z0-9]/) ? (
                      <div className="w-4 h-4 rounded-full shrink-0 bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                        {transaction.merchant.icon}
                      </div>
                    ) : (
                      <span className="shrink-0 text-sm">{transaction.merchant.icon}</span>
                    )
                  )}
                  <p className="font-semibold text-sm">
                    {transaction.merchant?.name || (transaction.description || 'No description')}
                  </p>
                  {transaction.isSplit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Transaksi ini di-split</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className="font-medium text-muted-foreground/80">{transaction.fromAccountName}</span>
                  {transaction.categoryName && (
                    <>
                      <span className="text-[10px] opacity-30">•</span>
                      <span>{transaction.categoryName}</span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                'font-bold text-sm',
                transaction.type === 'expense'
                  ? 'text-destructive'
                  : transaction.type === 'income' ? 'text-success' : 'text-primary'
              )}
            >
              {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '' }
              {displayAmount}
            </p>
            {transaction.labels?.map((label) => {
              return (
                <span
                  key={label._id}
                  className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-md"
                  title={label.name}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="hidden sm:inline">{label.name}</span>
                </span>
              );
            })}
          </div>
          {(onEdit || onDelete) && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                )}
                {onDelete && (
                    <DropdownMenuItem
                        className="text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                )}
                </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className="border-t bg-muted/10 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Account</p>
            <p className="text-sm">
              {transaction.type === 'transfer' 
                ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                : transaction.fromAccountName
              }
            </p>
          </div>

          {transaction.isSplit ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Breakdown</p>
              {transaction.splits?.map((split, index) => {
                // Determine opacity based on highlight filters
      const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelIds?.some(id => highlightLabelId.includes(String(id))));
                const categoryMatch = !highlightCategoryId || highlightCategoryId.length === 0 || (split.categoryId && highlightCategoryId.includes(String(split.categoryId)));
                const isMatch = labelMatch && categoryMatch;
                
                const opacityClass = isMatch ? "opacity-100" : "opacity-30 grayscale";
                
                return (
                  <div key={index} className={cn("flex justify-between items-start text-sm border-b border-muted last:border-0 pb-2 last:pb-0 transition-opacity", opacityClass)}>
                    <div className="flex flex-col">
                      <span className="font-medium">{split.description || 'No description'}</span>
                      <span className="text-muted-foreground text-xs">{split.categoryName || 'Uncategorized'}</span> 
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{shouldMask ? '••••' : split.amount}</span>
                      {split.labelColors?.map((color, i) => {
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            {split.labelNames?.[i]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                <p>{transaction.categoryName || 'Uncategorized'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                <p className="text-muted-foreground italic">&quot;{transaction.description || 'No description'}&quot;</p>
              </div>
              {transaction.assetDetails && (
                <div className="col-span-2 mt-2 pt-2 border-t">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Asset Details</p>
                   <p>Quantity: <span className="font-medium">{transaction.assetDetails.quantity}</span></p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
