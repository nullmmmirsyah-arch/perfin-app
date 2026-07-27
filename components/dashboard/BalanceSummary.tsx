'use client'

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';

type CashAccount = {
  name: string;
  balance: number;
  allocations?: { name: string; amount: number }[];
  bankBalance?: number;
};

type SummaryData = {
  liquidCash: number;
  cashAccounts: CashAccount[];
  unassignedCash?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function BalanceSummary({ summary, isPrivacyMode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const accounts = summary?.cashAccounts || [];
  const totalBalance = summary?.liquidCash || 0;
  const hasNoAccounts = accounts.length === 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
          Total Balance
        </p>
        {hasNoAccounts ? (
          <p className="text-2xl font-bold text-muted-foreground">
            {formatCurrency(0, { isPrivacyMode })}
          </p>
        ) : (
          <p className="text-2xl font-bold">
            {formatCurrency(totalBalance, { isPrivacyMode })}
          </p>
        )}
      </div>

      {hasNoAccounts ? (
        <p className="text-xs text-muted-foreground">
          Add an account to track your balance.{' '}
          <Link href="/accounts" className="text-primary underline underline-offset-2 font-medium">
            Go to Accounts
          </Link>
        </p>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7 justify-start px-0 hover:bg-transparent"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            {accounts.length} account{accounts.length > 1 ? 's' : ''}
          </Button>

          {expanded && (
            <div className="space-y-2">
              {accounts.map((account, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs truncate">{account.name}</span>
                  <span className="text-xs font-medium tabular-nums">
                    {formatCurrency(account.balance, { isPrivacyMode })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
