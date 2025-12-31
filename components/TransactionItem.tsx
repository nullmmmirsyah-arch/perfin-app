import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Trash2, Edit, ChevronDown } from 'lucide-react'
import { Doc, Id } from '../convex/_generated/dataModel'
import { TransactionWithDetails } from './transactions/types'

export function TransactionItem({ 
  transaction, 
  onEdit, 
  onDelete,
  highlightLabelId,
  highlightCategoryId,
}: { 
  transaction: TransactionWithDetails, 
  onEdit?: () => void, 
  onDelete?: () => void,
  highlightLabelId?: string,
  highlightCategoryId?: string,
}) {
  const [isOpen, setIsOpen] = useState(false)

  // Calculate effective amount based on filters
  let displayAmountVal = parseFloat(transaction.amount.replace(/,/g, '') || '0');
  const isFiltered = highlightLabelId || highlightCategoryId;
  
  if (isFiltered && transaction.isSplit && transaction.splits) {
    const filteredSum = transaction.splits.reduce((acc, split) => {
      const labelMatch = !highlightLabelId || String(split.labelId) === String(highlightLabelId);
      const categoryMatch = !highlightCategoryId || String(split.categoryId) === String(highlightCategoryId);
      
      if (labelMatch && categoryMatch) {
        return acc + parseFloat(split.amount.replace(/,/g, '') || '0');
      }
      return acc;
    }, 0);
    
    if (filteredSum > 0) displayAmountVal = filteredSum;
  }

  const displayAmount = new Intl.NumberFormat('en-US', {
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
                <p className="font-semibold text-sm">
                  {transaction.isSplit ? 'Split transaction' : (transaction.description || 'No description')}
                </p>
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
            {transaction.label && (
              <div className="flex justify-end mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-4 border-0 bg-muted/50 text-muted-foreground font-normal hover:bg-muted"
                  style={transaction.label.color ? { 
                      color: transaction.label.color,
                      backgroundColor: `${transaction.label.color}15` // 10% opacity hex
                  } : undefined}
                >
                  #{transaction.label.name}
                </Badge>
              </div>
            )}
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
                const labelMatch = !highlightLabelId || String(split.labelId) === String(highlightLabelId);
                const categoryMatch = !highlightCategoryId || String(split.categoryId) === String(highlightCategoryId);
                const isMatch = labelMatch && categoryMatch;
                
                const opacityClass = isMatch ? "opacity-100" : "opacity-30 grayscale";
                
                return (
                  <div key={index} className={cn("flex justify-between items-start text-sm border-b border-muted last:border-0 pb-2 last:pb-0 transition-opacity", opacityClass)}>
                    <div className="flex flex-col">
                      <span className="font-medium">{split.description || 'No description'}</span>
                      <span className="text-muted-foreground text-xs">{split.categoryName || 'Uncategorized'}</span> 
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{split.amount}</span>
                      {split.labelName && (
                        <div className="flex justify-end mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 h-4 border-0 bg-muted/50 text-muted-foreground font-normal hover:bg-muted"
                            style={split.labelColor ? { 
                                color: split.labelColor,
                                backgroundColor: `${split.labelColor}15`
                            } : undefined}
                          >
                            #{split.labelName}
                          </Badge>
                        </div>
                      )}
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
