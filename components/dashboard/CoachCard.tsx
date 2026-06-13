"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState, useCallback, useRef } from "react";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Info, Lightbulb, Send, MessageCircle } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

type SignalType = "danger" | "warning" | "info" | "success";
type SignalCategory = "budget" | "spending" | "saving" | "recurring" | "general";

type Signal = {
  type: SignalType;
  category: SignalCategory;
  title: string;
  message: string;
  tip?: string;
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

function getSuggestedQuestion(signal: Signal): string {
  const t = signal.title;
  if (signal.category === "budget" || signal.category === "spending") {
    if (/exceeded|over/i.test(signal.message)) return `Tips hemat ${t}?`;
    if (/remaining|used with/i.test(signal.message)) return `Agar ${t} cukup sampai akhir bulan?`;
    if (/pace/i.test(signal.message)) return `Cara atur pace ${t}?`;
    if (/carryover/i.test(signal.message)) return `Atasi carryover ${t}?`;
    return `Tips ${t}?`;
  }
  if (signal.category === "saving") return `Cara kejar target ${t}?`;
  if (signal.category === "recurring") return `Kelola ${t}?`;
  return `Saran untuk ${t}?`;
}

type AskState = { question: string; answer?: string; isError?: boolean; loading: boolean };

type SignalCardProps = {
  signal: Signal;
  askState?: AskState;
  onToggleAsk: () => void;
  onQuestionChange: (q: string) => void;
  onAsk: () => void;
};

function SignalCard({ signal, askState, onToggleAsk, onQuestionChange, onAsk }: SignalCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = !!askState;
  const placeholder = getSuggestedQuestion(signal);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`rounded-lg border ${signalColors[signal.type]}`}>
      <div className="flex items-start gap-3 p-3">
        <SignalIcon type={signal.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {typeLabels[signal.type]} · {categoryEmoji[signal.category]} {signal.category}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">{signal.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{signal.message}</p>
          {signal.tip && (
            <p className="text-xs font-medium text-foreground mt-1.5 flex items-start gap-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <span>{signal.tip}</span>
            </p>
          )}
          {signal.actionLabel && signal.actionHref && (
            <a
              href={signal.actionHref}
              className="inline-block mt-1.5 text-xs font-medium text-primary hover:underline"
            >
              {signal.actionLabel} →
            </a>
          )}
        </div>
        <button
          onClick={onToggleAsk}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Tanya AI"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 border-t border-border/50 mx-3">
              <div className="flex items-center gap-2 mt-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={askState.question}
                  onChange={(e) => onQuestionChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !askState.loading) onAsk(); }}
                  placeholder={placeholder}
                  className="flex-1 text-xs bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60"
                />
                <button
                  onClick={onAsk}
                  disabled={askState.loading || !askState.question.trim()}
                  className="shrink-0 p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {askState.loading && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Memikirkan jawaban...</span>
                </div>
              )}

              {askState.answer && !askState.loading && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-2 mt-2 p-2.5 rounded-md border ${
                    askState.isError
                      ? "bg-amber-500/5 border-amber-500/15"
                      : "bg-purple-500/5 border-purple-500/15"
                  }`}
                >
                  {askState.isError ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                  )}
                  <p className="text-xs text-muted-foreground leading-relaxed">{askState.answer}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const askCoach = useAction(api.coach.askCoach);
  const [data, setData] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [askCards, setAskCards] = useState<Record<number, { question: string; answer?: string; isError?: boolean; loading: boolean }>>({});

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

  // Refresh is manual only — auto-refresh would burn through Gemini quota

  const toggleAsk = useCallback((i: number) => {
    setAskCards(prev => {
      if (prev[i]) {
        const { [i]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [i]: { question: "", loading: false } };
    });
  }, []);

  const ask = useCallback(async (i: number, signal: Signal) => {
    const q = askCards[i]?.question?.trim();
    if (!q) return;

    setAskCards(prev => ({ ...prev, [i]: { ...prev[i], loading: true } }));

    const result = await askCoach({ householdId, question: q }) as { answer?: string; error?: string } | null;

    if (result?.error) {
      setAskCards(prev => ({
        ...prev,
        [i]: { ...prev[i], loading: false, answer: result.error, isError: true },
      }));
    } else {
      setAskCards(prev => ({
        ...prev,
        [i]: { ...prev[i], loading: false, answer: result?.answer ?? "Maaf, gagal mendapatkan jawaban. Coba lagi nanti.", isError: false },
      }));
    }
  }, [askCards, askCoach, householdId]);

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
                      AI
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
                  <SignalCard
                    signal={signal}
                    askState={askCards[i]}
                    onToggleAsk={() => toggleAsk(i)}
                    onQuestionChange={(q) =>
                      setAskCards(prev => ({ ...prev, [i]: { ...prev[i], question: q } }))
                    }
                    onAsk={() => ask(i, signal)}
                  />
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
