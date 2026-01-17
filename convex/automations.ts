import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { AUTOMATION_FREQUENCIES } from "./lib/constants";
import { parseAmount } from "./lib/finance";
import { ensureHouseholdAccess } from "./lib/auth";

/**
 * Calculate the next execution time based on frequency.
 */
function calculateNextRun(frequency: string, currentRun: number): number {
  const date = new Date(currentRun);
  switch (frequency) {
    case AUTOMATION_FREQUENCIES.DAILY:
      date.setDate(date.getDate() + 1);
      break;
    case AUTOMATION_FREQUENCIES.WEEKLY:
      date.setDate(date.getDate() + 7);
      break;
    case AUTOMATION_FREQUENCIES.MONTHLY:
      date.setMonth(date.getMonth() + 1);
      break;
    case AUTOMATION_FREQUENCIES.YEARLY:
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date.getTime();
}

/**
 * Get the automation schedule for a specific goal.
 */
export const getScheduleByGoal = query({
  args: {
    linkedEntityId: v.id("categories"),
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { linkedEntityId, householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    if (householdId) {
      await ensureHouseholdAccess(ctx, householdId, identity.subject);
    }

    return await ctx.db
      .query("scheduledTransactions")
      .withIndex("by_linkedEntityId", (q) => q.eq("linkedEntityId", linkedEntityId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();
  },
});

/**
 * Create or update an automation schedule.
 */
export const upsertSchedule = mutation({
  args: {
    id: v.optional(v.id("scheduledTransactions")),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    amount: v.string(),
    fromAccountId: v.id("accounts"),
    toAccountId: v.optional(v.id("accounts")),
    linkedEntityId: v.optional(v.id("categories")),
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("yearly")
    ),
    nextRunAt: v.number(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (args.householdId) {
      await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    const { id, ...data } = args;

    // 1. Try to find existing schedule by ID (Explicit Update)
    let targetId = id;

    // 2. If no ID provided, check if one exists for this Linked Entity (Smart Upsert)
    // This prevents double-scheduling for the same goal.
    if (!targetId && data.linkedEntityId) {
        const existingByGoal = await ctx.db
            .query("scheduledTransactions")
            .withIndex("by_linkedEntityId", q => q.eq("linkedEntityId", data.linkedEntityId!))
            .filter(q => q.eq(q.field("userId"), identity.subject))
            .first();
        
        if (existingByGoal) {
            targetId = existingByGoal._id;
        }
    }

    if (targetId) {
      const existing = await ctx.db.get(targetId);
      if (!existing || existing.userId !== identity.subject) {
        throw new Error("Schedule not found or unauthorized");
      }
      await ctx.db.patch(targetId, data);
      return targetId;
    } else {
      return await ctx.db.insert("scheduledTransactions", {
        ...data,
        userId: identity.subject,
      });
    }
  },
});

/**
 * Toggle schedule status.
 */
export const toggleSchedule = mutation({
  args: {
    id: v.id("scheduledTransactions"),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, { id, isEnabled }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Schedule not found or unauthorized");
    }

    await ctx.db.patch(id, { isEnabled });
  },
});

/**
 * CORE LOGIC: Process all schedules that are due.
 * This is called by the Cron job.
 */
export const processDueSchedules = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Fetch all due schedules
    const dueSchedules = await ctx.db
      .query("scheduledTransactions")
      .withIndex("by_nextRun", (q) => q.eq("isEnabled", true).lte("nextRunAt", now))
      .collect();

    console.log(`Processing ${dueSchedules.length} due schedules`);

    for (const schedule of dueSchedules) {
      try {
        const fromAccount = await ctx.db.get(schedule.fromAccountId);
        if (!fromAccount) throw new Error("Source account missing");

        const amount = parseAmount(schedule.amount);
        const balance = parseAmount(fromAccount.balance);

        // 2. Safety Check: Balance
        if (balance < amount) {
          await ctx.db.patch(schedule._id, {
            lastRunStatus: "failed",
            failureReason: "Insufficient funds in source account",
            nextRunAt: calculateNextRun(schedule.frequency, schedule.nextRunAt),
          });

          // Optional: Create notification
          await ctx.db.insert("notifications", {
            userId: schedule.userId,
            householdId: schedule.householdId,
            type: "system",
            title: "Auto-Save Failed",
            message: `Could not process "${schedule.name}" due to insufficient funds in ${fromAccount.name}.`,
            isRead: false,
            createdAt: Date.now(),
          });
          continue;
        }

        // 3. Execute Transaction
        // We call the public mutation via internal.transactions.create
        // BUT wait, internal mutations can call public mutations but it's cleaner to 
        // have an internal helper if we want to bypass Auth for automated tasks.
        // Actually, internal mutations are privileged. 
        // We will call the logic directly or reuse the create mutation if we can bypass auth.
        // Since we are in internalMutation, we can't easily "mock" user identity for transactions.create.
        
        // BETTER: We'll implement a minimal transaction logic here or move transaction core to internal.
        // For now, let's implement the core move here to ensure it works.
        
        const toAccount = schedule.toAccountId ? await ctx.db.get(schedule.toAccountId) : null;
        
        // Update Balances
        await ctx.db.patch(schedule.fromAccountId, {
            balance: (balance - amount).toString()
        });
        
        if (schedule.toAccountId && toAccount) {
            const destBalance = parseAmount(toAccount.balance);
            await ctx.db.patch(schedule.toAccountId, {
                balance: (destBalance + amount).toString()
            });
        }

        // Record Transaction
        await ctx.db.insert("transactions", {
          userId: schedule.userId,
          householdId: schedule.householdId,
          type: "transfer", // Auto-save is a transfer
          amount: schedule.amount,
          date: new Date().toISOString(),
          description: `${schedule.name} (Auto-Save)`,
          accountId: schedule.fromAccountId,
          toAccountId: schedule.toAccountId,
          categoryId: schedule.linkedEntityId,
        });

        // 4. Update Schedule for next run
        await ctx.db.patch(schedule._id, {
          lastRunStatus: "success",
          failureReason: undefined,
          nextRunAt: calculateNextRun(schedule.frequency, schedule.nextRunAt),
        });

        console.log(`Successfully processed schedule: ${schedule.name}`);

      } catch (error) {
        console.error(`Failed to process schedule ${schedule._id}:`, error);
        await ctx.db.patch(schedule._id, {
          lastRunStatus: "failed",
          failureReason: error instanceof Error ? error.message : "Unknown error",
          nextRunAt: calculateNextRun(schedule.frequency, schedule.nextRunAt),
        });
      }
    }
  },
});
