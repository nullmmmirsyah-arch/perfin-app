'use client'

import { RecurringList } from '@/components/recurring/RecurringList';
import { PageHeader } from '@/components/PageHeader';

export default function RecurringPage() {
  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <PageHeader title="Recurring Expenses" description="Manage your monthly bills and subscriptions." />
      <RecurringList />
    </div>
  );
}
