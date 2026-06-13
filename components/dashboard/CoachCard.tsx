"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Info, Lightbulb } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

type SignalType = "danger" | "warning" | "info" | "success";
type SignalCategory = "budget" | "spending" | "saving" | "recurring" | "general";

type Signal = {
  type: SignalType;
  category: SignalCategory;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

type InsightResponse = {
  signals: Signal[];
  geminiInsight: string | null;
  insightSource: "rule" | "gemini";
  needsRefresh: boolean;
  generatedAt: number;
};

function SignalIcon({ type }: { type: SignalType }) {
  switch (type) {
    case "danger": return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case "success": return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "info": return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    default: return null;
  }
}

const signalColors: Record<SignalType, string> = {
  danger: "bg-red-500/10 border-red-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  success: "bg-emerald-500/10 border-emerald-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
};

const typeLabels: Record<SignalType, string> = {
  danger: "Urgent",
  warning: "Warning",
  success: "Good",
  info: "Info",
};

const categoryEmoji: Record<SignalCategory, string> = {
  budget: "📊",
  spending: "💳",
  saving: "💰",
  recurring: "🔄",
  general: "💡",
};

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${signalColors[signal.type]}`}>
      <SignalIcon type={signal.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {typeLabels[signal.type]} · {categoryEmoji[signal.category]} {signal.category}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">{signal.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{signal.message}</p>
        {signal.actionLabel && signal.actionHref && (
          <a
            href={signal.actionHref}
            className="inline-block mt-1.5 text-xs font-medium text-primary hover:underline"
          >
            {signal.actionLabel} →
          </a>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-20 bg-muted rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
    </div>
  );
}

type CoachCardProps = {
  householdId: Id<"households">;
};

export function CoachCard({ householdId }: CoachCardProps) {
  const getInsight = useMutation(api.coach.getInsight);
  const refreshInsight = useAction(api.coach.refreshInsight);
  const [data, setData] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getInsight({ householdId });
      setData(result as InsightResponse);
    } catch (err) {
      console.error("getInsight failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getInsight, householdId]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshInsight({ householdId });
      await load();
    } catch (err) {
      console.error("refreshInsight failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshInsight, householdId, load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.needsRefresh && !isRefreshing) {
      refresh();
    }
  }, [data?.needsRefresh]);

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl border bg-card text-card-foreground shadow-sm"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Coach AI</h2>
          </div>
          <button
            onClick={refresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : data ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {data.geminiInsight && data.insightSource === "gemini" && (
              <motion.div
                variants={fadeInUp}
                className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20"
              >
                <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1 flex items-center gap-1.5">
                    <span>AI Insight</span>
                    <span className="text-[10px] font-medium text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                      Gemini
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{data.geminiInsight}</p>
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
              {data.signals.map((signal, i) => (
                <motion.div
                  key={`${signal.type}-${signal.category}-${i}`}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -10 }}
                  layout
                >
                  <SignalCard signal={signal} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Unable to load insights. Try refreshing.
          </p>
        )}
      </div>
    </motion.div>
  );
}
