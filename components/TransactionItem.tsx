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
  variant = 'default'
}: { 
  transaction: TransactionWithDetails, 
  onEdit?: () => void, 
  onDelete?: () => void,
  variant?: 'default' | 'slim'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isSlim = variant === 'slim'

  return (
    <Card className={cn("overflow-hidden", isSlim ? "shadow-none" : "shadow-sm")}>
      <div className={cn(
        "flex justify-between items-center hover:bg-muted/30 transition-colors",
        isSlim ? "p-2 px-3" : "p-4"
      )}>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("p-0 h-6 w-6 shrink-0", isSlim && "h-4 w-4")}
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isSlim && "h-3 w-3", isOpen && "rotate-180")} />
            <span className="sr-only">Toggle Details</span>
          </Button>
          <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
            {transaction.type === 'transfer' ? (
              <>
                <p className={cn("font-medium", isSlim ? "text-sm" : "text-base")}>
                  {transaction.fromAccountName} <span className="text-muted-foreground">→</span> {transaction.toAccountName}
                </p>
                {transaction.description && !isSlim && (
                  <p className="text-sm text-muted-foreground">
                    {transaction.description}
                  </p>
                )}
              </>
            ) : (
              <p className={cn("font-medium", isSlim ? "text-sm" : "text-base")}>
                {!isSlim && <span className="text-muted-foreground font-normal mr-1">{transaction.fromAccountName}:</span>}
                {transaction.isSplit ? 'Split transaction' : (transaction.description || 'No description')}
              </p>
            )}
            {!isSlim && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
            )}
            {isSlim && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p
              className={cn(
                'font-semibold',
                isSlim ? "text-sm" : "text-base",
                transaction.type === 'expense'
                  ? 'text-destructive'
                  : transaction.type === 'income' ? 'text-green-600' : 'text-primary'
              )}
            >
              {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '' }
              {transaction.amount}
            </p>
            {transaction.label && (
              <div className="flex justify-end mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-5 border-0 bg-muted/50 text-muted-foreground font-normal hover:bg-muted"
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
                <Button variant="ghost" size="icon" className={cn("h-8 w-8", isSlim && "h-6 w-6")}>
                    <MoreHorizontal className={cn("h-4 w-4", isSlim && "h-3 w-3")} />
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
              {transaction.splits?.map((split, index) => (
                <div key={index} className="flex justify-between items-start text-sm border-b border-muted last:border-0 pb-2 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-medium">{split.description || 'No description'}</span>
                    <span className="text-muted-foreground text-xs">{split.categoryName || 'Uncategorized'}</span> 
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{split.amount}</span>
                    {split.labelId && <p className="text-[10px] text-muted-foreground">Has Label</p>}
                  </div>
                </div>
              ))}
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
