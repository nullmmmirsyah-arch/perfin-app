"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "@/components/ui/icons";
import { cn, formatCurrency } from "@/lib/utils";
import { computeBudgetStatus, BUDGET_FEEDBACK_MESSAGES, BudgetStatus } from "@/lib/budget-feedback";

export type TransactionSuccessViewProps = {
  amount: number;
  categoryName: string;
  overallRemaining: number | null;
  categoryRemaining: number | null;
  categoryBudgetTotal: number | null;
  onDismiss: () => void;
};

export default function TransactionSuccessView({
  amount,
  categoryName,
  overallRemaining,
  categoryRemaining,
  categoryBudgetTotal,
  onDismiss,
}: TransactionSuccessViewProps) {
  const [countUpValue, setCountUpValue] = useState(0);
  const budgetStatus: BudgetStatus | null =
    categoryBudgetTotal != null && categoryRemaining != null
      ? computeBudgetStatus(categoryRemaining, categoryBudgetTotal)
      : null;

  useEffect(() => {
    if (overallRemaining == null) return;
    const startTime = performance.now();
    const duration = 500;
    const startValue = 0;
    const endValue = overallRemaining;

    let rafId: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCountUpValue(startValue + (endValue - startValue) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [overallRemaining]);

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-center justify-center min-h-[300px] px-6 py-12 text-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
        className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center mb-6"
      >
        <Check className="h-6 w-6 text-white" />
      </motion.div>

      <p className="text-lg font-semibold text-foreground mb-1">
        Expense recorded
      </p>

      <p className="text-sm text-muted-foreground mb-8">
        {formatCurrency(amount)} at {categoryName}
      </p>

      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Remaining Budget
        </p>
        <p className="text-4xl font-bold text-foreground tabular-nums">
          {overallRemaining != null
            ? formatCurrency(Math.round(countUpValue))
            : "—"}
        </p>
      </div>

      {categoryRemaining != null && (
        <p className="text-sm text-muted-foreground mb-4">
          {categoryName}: {formatCurrency(categoryRemaining)} left
        </p>
      )}

      {budgetStatus && (
        <p
          className={cn(
            "text-sm font-medium",
            budgetStatus === "healthy" && "text-green-600",
            budgetStatus === "moderate" && "text-yellow-600",
            budgetStatus === "low" && "text-orange-600",
            budgetStatus === "exceeded" && "text-red-600"
          )}
        >
          {BUDGET_FEEDBACK_MESSAGES[budgetStatus]}
        </p>
      )}
    </motion.div>
  );
}
