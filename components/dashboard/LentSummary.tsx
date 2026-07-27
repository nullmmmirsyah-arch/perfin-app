'use client'

import { HandCoins, Check, Ban } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, parseAmount } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type PendingReceivable = {
  _id: string;
  amount: string;
  amountPaid: string;
  owedBy?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  fromAccountName?: string;
  settlementStatus?: string;
};

type SummaryData = {
  totalReceivables: number;
  pendingReceivables: PendingReceivable[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function LentSummary({ summary, isPrivacyMode }: Props) {
  const receivables: PendingReceivable[] = summary?.pendingReceivables || [];
  const totalOwed = receivables.reduce((acc, r) => {
    const amount = parseAmount(r.amount);
    const paid = parseAmount(r.amountPaid);
    return acc + (amount - paid);
  }, 0);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
          Total Lent
        </p>
        <p className="text-2xl font-bold">
          {formatCurrency(totalOwed, { isPrivacyMode })}
        </p>
      </div>

      {receivables.length === 0 && <EmptyState icon={HandCoins} description="No active receivables" compact />}

      {receivables.length > 0 && (
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {receivables.map((r) => {
            const amount = parseAmount(r.amount);
            const paid = parseAmount(r.amountPaid);
            const remaining = amount - paid;
            return (
              <div key={r._id} className="flex flex-col gap-2 p-3 rounded-lg bg-card border shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-accent/50 text-accent-foreground border-accent">
                        {r.owedBy || 'Someone'}
                      </Badge>
                      {r.categoryName && (
                        <>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground truncate">{r.categoryName}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs font-medium truncate">{r.description || 'No description'}</p>
                    {r.fromAccountName && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Paid from {r.fromAccountName}</p>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(remaining, { isPrivacyMode })}
                    </p>
                    <p className="text-[10px] text-muted-foreground italic capitalize">
                      {r.settlementStatus || 'Pending'}
                    </p>
                  </div>
                </div>

                {r.settlementStatus === 'partial' && (
                  <div className="relative h-1 w-full bg-muted rounded-full">
                    <div
                      className="absolute top-0 left-0 h-full bg-primary/30 rounded-full"
                      style={{ width: `${amount > 0 ? (paid / amount) * 100 : 0}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-dashed">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-[10px] flex-1 bg-primary hover:bg-primary/90 text-primary-foreground border-none"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('PERFIN_SETTLE_RECEIVABLE', { detail: r }));
                    }}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Settle up
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('PERFIN_FORGIVE_RECEIVABLE', { detail: r }));
                    }}
                  >
                    <Ban className="h-3 w-3 mr-1" /> Forgive
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
