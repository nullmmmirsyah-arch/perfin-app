'use client'

import { formatCurrency } from '@/lib/utils';

type PendingReceivable = {
  _id: string;
  amount: string;
  amountPaid: string;
  owedBy?: string;
  description?: string;
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
    const amount = parseFloat(r.amount) || 0;
    const paid = parseFloat(r.amountPaid) || 0;
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

      {receivables.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No active receivables</p>
      )}

      {receivables.length > 0 && (
        <div className="space-y-2 max-h-[160px] overflow-y-auto">
          {receivables.map((r) => {
            const amount = parseFloat(r.amount) || 0;
            const paid = parseFloat(r.amountPaid) || 0;
            const remaining = amount - paid;
            return (
              <div key={r._id} className="flex items-center justify-between py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{r.owedBy || 'Unknown'}</p>
                  {r.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>
                  )}
                </div>
                <span className="text-xs font-medium tabular-nums shrink-0 ml-2">
                  {formatCurrency(remaining, { isPrivacyMode })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
