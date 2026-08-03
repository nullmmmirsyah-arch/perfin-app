"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { GuidanceCard } from "@/lib/contextual-guidance";
import {
  AlertTriangle,
  CheckCircle2,
  PiggyBank,
  Target,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Props = { card: GuidanceCard; onCta: () => void };

const SCENARIO_STYLE: Record<
  GuidanceCard["scenario"],
  { icon: typeof AlertTriangle; iconClass: string; ctaClass: string }
> = {
  budget_warning: {
    icon: AlertTriangle,
    iconClass: "bg-destructive/10 text-destructive",
    ctaClass: "",
  },
  goal_opportunity: {
    icon: Target,
    iconClass: "bg-primary/10 text-primary",
    ctaClass: "",
  },
  safe_to_save: {
    icon: PiggyBank,
    iconClass: "bg-success/10 text-success",
    ctaClass: "",
  },
  positive_reinforcement: {
    icon: CheckCircle2,
    iconClass: "bg-primary/10 text-primary",
    ctaClass: "",
  },
};

export default function ContextualGuidanceCard({ card, onCta }: Props) {
  const style = SCENARIO_STYLE[card.scenario];
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-8 w-full rounded-2xl border bg-card text-left shadow-sm motion-reduce:animate-none"
    >
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 shrink-0 rounded-full flex items-center justify-center", style.iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {card.description}
        </p>
        {card.usedPercentage != null && (
          <Progress
            value={card.usedPercentage}
            className="mt-3 h-1.5"
            indicatorColor={card.usedPercentage >= 90 ? "var(--color-destructive)" : "var(--color-orange-500)"}
          />
        )}
        <Button size="lg" className="mt-4 w-full rounded-full font-semibold" onClick={onCta}>
          {card.ctaLabel}
        </Button>
      </div>
    </motion.div>
  );
}