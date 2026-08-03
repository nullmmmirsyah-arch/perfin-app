"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Check } from "@/components/ui/icons";
import { cn, formatCurrency, parseAmount } from "@/lib/utils";
import { computeBudgetStatus, BUDGET_FEEDBACK_MESSAGES, BudgetStatus } from "@/lib/budget-feedback";
import { calculateAllowance } from "@/lib/allowance-calculator";
import { getFiscalMonthRange } from "@/lib/finance-utils";
import { getGuidance, GuidanceCard } from "@/lib/contextual-guidance";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useHousehold } from "@/components/HouseholdProvider";
import { GoalActionDrawer } from "@/components/goals/GoalActionDrawer";
import ContextualGuidanceCard from "@/components/ContextualGuidanceCard";

export type TransactionSuccessViewProps = {
  amount: number;
  categoryName: string;
  overallRemaining: number | null;
  categoryRemaining: number | null;
  categoryBudgetTotal: number | null;
  onDismiss: () => void;
  affectedCategoryId: string;
  householdId: string | null;
  month: number;
  year: number;
  displayName: string;
};

export default function TransactionSuccessView({
  amount,
  categoryName,
  overallRemaining,
  categoryRemaining,
  categoryBudgetTotal,
  onDismiss,
  affectedCategoryId,
  householdId,
  month,
  year,
  displayName,
}: TransactionSuccessViewProps) {
  const [countUpValue, setCountUpValue] = useState(0);
  const [openAction, setOpenAction] = useState<GuidanceCard | null>(null);
  const router = useRouter();
  const { households } = useHousehold();

  const queryHouseholdId = householdId as Id<"households"> | undefined;
  const activeHousehold = households?.find((h) => h._id === householdId);
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;

  const budgetData = useQuery(api.budgets.getBudgetStatus, {
    householdId: queryHouseholdId,
    month,
    year,
  });
  const savingGoals = useQuery(api.categories.get, {
    householdId: queryHouseholdId,
    type: "saving",
    showArchived: false,
  });
  const accounts = useQuery(api.accounts.get, {
    householdId: queryHouseholdId,
    showArchived: false,
  });

  const guidance: GuidanceCard | null = useMemo(() => {
    if (!budgetData?.data) return null;
    const item = budgetData.data.find((d) => d.category._id === affectedCategoryId);
    if (!item) return null;

    const effectiveLimit = item.budget
      ? parseAmount(item.budget.amount) +
        parseAmount(item.budget.carryoverAmount ?? "0") -
        parseAmount(item.budget.sweptAmount ?? "0")
      : 0;

    let weeklyRemaining: number | null = null;
    if (item.allowanceType === "weekly") {
      const { start, end } = getFiscalMonthRange(year, month, budgetStartDay);
      const allowance = calculateAllowance({
        allowanceType: "weekly",
        weeklyResetDay: item.weeklyResetDay ?? 1,
        budgetAmount: effectiveLimit,
        spent: item.spent || 0,
        weeklySpent: item.weeklySpent || 0,
        fiscalPeriodStart: start,
        fiscalPeriodEnd: end,
        now: new Date(),
      });
      weeklyRemaining = allowance.weeklyRemaining ?? null;
    }

    const goals = (savingGoals ?? [])
      .filter((g) => g.status !== "achieved" && !g.isArchived)
      .map((g) => {
        const targetAmount = parseAmount(g.targetAmount);
        const progress = targetAmount > 0 ? (g.currentAmount ?? 0) / targetAmount : 0;
        const limit = g.currentBudget ? parseAmount(g.currentBudget.amount) : 0;
        const linkedAccountId = accounts?.find((a) => a.linkedCategoryId === g._id)?._id;
        return {
          categoryId: String(g._id),
          categoryName: g.name,
          currentAmount: g.currentAmount ?? 0,
          targetAmount,
          progress,
          monthlyLimit: limit,
          monthlyContribution: g.thisMonthContribution ?? 0,
          linkedAccountId: String(linkedAccountId ?? ""),
        };
      });

    return getGuidance({
      affectedCategory: {
        categoryName: item.category.name,
        hasBudget: effectiveLimit > 0,
        budgetLimit: effectiveLimit > 0 ? effectiveLimit : null,
        spent: item.spent || 0,
        isWeekly: item.allowanceType === "weekly",
        weeklySpent: item.weeklySpent ?? null,
        weeklyRemaining,
      },
      goals,
      displayName,
    });
  }, [budgetData, savingGoals, accounts, affectedCategoryId, displayName, month, year, budgetStartDay]);

  const handleCta = useCallback(
    (card: GuidanceCard) => {
      if (card.action === "view-budget") {
        router.push("/budgets");
        onDismiss();
      } else if (card.action === "quick-save") {
        if (!card.goalAccountId) {
          router.push("/goals");
          return;
        }
        setOpenAction(card);
      } else {
        onDismiss();
      }
    },
    [router, onDismiss]
  );

  const actionGoalName = useMemo(() => {
    const goal = (savingGoals ?? []).find((g) => String(g._id) === openAction?.goalCategoryId);
    return goal?.name ?? "";
  }, [savingGoals, openAction?.goalCategoryId]);
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
    if (guidance) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss, guidance]);

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

      {guidance && <ContextualGuidanceCard card={guidance} onCta={() => handleCta(guidance)} />}

      {openAction && openAction.goalAccountId && (
        <GoalActionDrawer
          open={!!openAction}
          onOpenChange={(open) => {
            if (!open) setOpenAction(null);
          }}
          goalName={actionGoalName}
          goalAccountId={openAction.goalAccountId as Id<"accounts">}
          goalCategoryId={openAction.goalCategoryId as Id<"categories">}
          actionType="deposit"
        />
      )}
    </motion.div>
  );
}
