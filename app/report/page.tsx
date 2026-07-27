'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import { PageHeader } from '@/components/PageHeader';
import { BudgetReportFilters, BudgetReportSummary, BudgetReportTable, BudgetReportChart } from '@/components/report';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FileBarChart } from '@/components/ui/icons';

type ViewMode = 'table' | 'chart';

export default function ReportPage() {
  const { householdId } = useHousehold();
  
  const [categoryId, setCategoryId] = useState<Id<'categories'> | null>(null);
  const [months, setMonths] = useState(3);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [reportType, setReportType] = useState<'budget'>('budget');

  const budgetReport = useQuery(
    api.budgets.getBudgetReport,
    {
      householdId: householdId ?? undefined,
      months,
      categoryId: categoryId ?? undefined,
    }
  );

  const isLoading = budgetReport === undefined;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-20">
      <PageHeader
        title="Reports"
        description="Analyze your budget performance"
      />

      <div className="px-4 space-y-4">
        {/* Report Type Selector */}
        <Tabs value={reportType} onValueChange={(v) => setReportType(v as 'budget')}>
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="budget">Budget Report</TabsTrigger>
          </TabsList>
          
          <TabsContent value="budget" className="space-y-4 mt-4">
            {/* Filters */}
            <BudgetReportFilters
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              months={months}
              onMonthsChange={setMonths}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* Summary Cards */}
            <BudgetReportSummary 
              totals={budgetReport?.totals ?? null}
              isLoading={isLoading}
            />

            {/* View Toggle: Table or Chart */}
            {viewMode === 'table' ? (
              <BudgetReportTable 
                periods={budgetReport?.periods ?? []}
                isLoading={isLoading}
              />
            ) : (
              <BudgetReportChart 
                periods={budgetReport?.periods ?? []}
                isLoading={isLoading}
              />
            )}

            {/* Empty State */}
            {!isLoading && budgetReport?.periods.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No budget data yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create budgets to start tracking your spending
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
