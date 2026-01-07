import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function TransactionItemSkeleton({ variant = 'default' }: { variant?: 'default' | 'slim' }) {
  const isSlim = variant === 'slim'
  return (
    <div className={cn(
      "flex justify-between items-center bg-card",
      isSlim ? "py-2" : "p-4 border rounded-lg shadow-sm"
    )}>
      <div className="flex items-center gap-4 flex-1 overflow-hidden">
        {/* Icon Circle */}
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        
        <div className="space-y-1.5 flex-1 min-w-0">
          {/* Category Name */}
          <Skeleton className="h-4 w-32" />
          {/* Account/Date/Desc */}
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 ml-4 shrink-0">
        {/* Amount */}
        <Skeleton className="h-4 w-20" />
        {/* Status/Badge */}
        {!isSlim && <Skeleton className="h-3 w-12 rounded-full" />}
      </div>
    </div>
  )
}

export function DashboardCardSkeleton() {
  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center p-2 rounded-md bg-muted/10">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentTransactionsSkeleton() {
  return (
    <div className="space-y-4 mt-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20 uppercase tracking-wider" />
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <TransactionItemSkeleton key={i} variant="slim" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20 uppercase tracking-wider" />
        <div className="grid gap-2">
          {[1, 2].map((i) => (
            <TransactionItemSkeleton key={i} variant="slim" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TransactionsListSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      {[1, 2].map((group) => (
        <div key={group} className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <Skeleton className="h-4 w-24" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3].map((i) => (
              <TransactionItemSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function GenericItemSkeleton() {
  return (
    <Card className="p-4 flex flex-row justify-between items-center shadow-sm">
      <div className="space-y-2 w-full max-w-[200px]">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </Card>
  )
}

export function AccountsListSkeleton() {
  return (
    <div className="mt-8 space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <GenericItemSkeleton key={i} />
      ))}
    </div>
  )
}

export function CategoriesListSkeleton() {
  return (
    <div className="mt-8 space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <GenericItemSkeleton key={i} />
      ))}
    </div>
  )
}

export function LabelsListSkeleton() {
  return (
    <div className="mt-8 space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <GenericItemSkeleton key={i} />
      ))}
    </div>
  )
}

export function BudgetListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-full max-w-[120px]">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}