import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { checkHouseholdAccess, ensureHouseholdAccess, ensureAdminAccess } from "./lib/auth";
import { ACCOUNT_TYPES, CATEGORY_TYPES, TRANSACTION_TYPES, GOAL_STATUS, GOAL_TYPES } from "./lib/constants";

export const get = query({
  args: { 
    householdId: v.optional(v.id("households")),
    showArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { householdId, showArchived }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let accounts;
    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) return [];
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    return accounts.filter(a => {
  if (a.visibility === "private" && a.userId !== identity.subject) return false;
  if (!showArchived && a.isArchived) return false;
  return true;
});
  },
});

export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    balance: v.string(),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    goalType: v.optional(v.string()),
    monthlyBudget: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
        await ensureAdminAccess(ctx, args.householdId, identity.subject);
    }

    let linkedCategoryId: Id<"categories"> | undefined;

    // Auto-create linked category for Savings/Assets
    if (args.type === ACCOUNT_TYPES.SAVING || args.type === ACCOUNT_TYPES.ASSET) {
        // If ASSET, force goalType to INVESTMENT. Otherwise use provided or default to PURCHASE.
        // Actually, let's trust frontend to send correct type, but for ASSET we enforce logic.
        let finalGoalType = args.goalType;
        if (args.type === ACCOUNT_TYPES.ASSET) {
            finalGoalType = GOAL_TYPES.INVESTMENT;
        }

        linkedCategoryId = await ctx.db.insert("categories", {
            userId: identity.subject,
            householdId: args.householdId,
            name: args.name,
            type: CATEGORY_TYPES.SAVING,
            targetAmount: args.targetAmount,
            targetDate: args.targetDate,
            goalType: finalGoalType as any, // Cast to avoid strict typing issues with string vs union in mutation args
        });

        // AUTO-CREATE BUDGET if monthlyBudget provided
        if (args.monthlyBudget) {
            const now = new Date();
            // Check existing budget first (Paranoid Check)
            const existingBudget = await ctx.db.query("budgets")
                .withIndex(args.householdId ? "by_householdId_category_year_month" : "by_user_category_year_month", q => {
                    let builder = q.eq(args.householdId ? "householdId" : "userId", args.householdId || identity.subject)
                                   .eq("categoryId", linkedCategoryId!)
                                   .eq("year", now.getFullYear())
                                   .eq("month", now.getMonth());
                    return builder;
                }).first();

            if (existingBudget) {
                await ctx.db.patch(existingBudget._id, { amount: args.monthlyBudget });
            } else {
                await ctx.db.insert("budgets", {
                    userId: identity.subject,
                    householdId: args.householdId,
                    categoryId: linkedCategoryId,
                    amount: args.monthlyBudget,
                    year: now.getFullYear(),
                    month: now.getMonth(),
                });
            }
        }
    }

    const initialBalance = parseFloat(args.balance.replace(/,/g, ''));
    const isAsset = args.type === ACCOUNT_TYPES.ASSET;

    const accountId = await ctx.db.insert("accounts", {
      householdId: args.householdId,
      name: args.name,
      balance: args.balance,
      type: args.type,
      initialQuantity: args.initialQuantity,
      unit: args.unit,
      userId: identity.subject,
      linkedCategoryId,
      // Initialize Asset metrics for accurate profit tracking
      quantity: isAsset ? parseFloat(args.initialQuantity || '0') : undefined,
      totalCostBasis: isAsset ? initialBalance : undefined,
    });

    // Create Initial Balance Transaction if balance > 0 and NOT an asset 
    // (Assets handle their own initial value via cost basis above)
    if (initialBalance > 0 && !isAsset) {
        // 1. Find or Create "Initial Balance" Category
        let categoryId;
        const existingCategory = await ctx.db
            .query("categories")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .filter(q => q.eq(q.field("name"), "Initial Balance"))
            .first();
        
        if (existingCategory) {
            categoryId = existingCategory._id;
        } else {
            categoryId = await ctx.db.insert("categories", {
                userId: identity.subject,
                householdId: args.householdId,
                name: "Initial Balance",
                type: CATEGORY_TYPES.INCOME
            });
        }

        // 2. Create Transaction
        await ctx.db.insert("transactions", {
            userId: identity.subject,
            householdId: args.householdId,
            accountId,
            categoryId,
            type: TRANSACTION_TYPES.INCOME,
            amount: args.balance,
            date: new Date().toISOString(),
            description: "Initial Balance",
        });
    }

    return { accountId, linkedCategoryId };
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    goalType: v.optional(v.string()),
    monthlyBudget: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("shared"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, targetAmount, targetDate, goalType, monthlyBudget, visibility, ...rest } = args;
    const account = await ctx.db.get(id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    if (args.visibility !== undefined && account.householdId) {
      await ensureAdminAccess(ctx, account.householdId, identity.subject);
    }

    // Safety Guard: Prevent Type Swap if Transactions Exist
    if (args.type && args.type !== account.type) {
        const hasTx = await ctx.db.query("transactions")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .filter(q => q.or(q.eq(q.field("accountId"), id), q.eq(q.field("toAccountId"), id)))
            .first();
        
        if (hasTx) {
            throw new Error("Cannot change Account Type because this account already has transactions. Please archive this account and create a new one instead.");
        }
    }

    if (args.name && account.linkedCategoryId) {
        await ctx.db.patch(account.linkedCategoryId, { 
            name: args.name,
            targetAmount: targetAmount ?? undefined, // Only update if provided
            targetDate: targetDate ?? undefined,
            goalType: goalType as any ?? undefined
        });
    } else if (account.linkedCategoryId && (targetAmount !== undefined || targetDate !== undefined || goalType !== undefined)) {
         await ctx.db.patch(account.linkedCategoryId, { 
            targetAmount: targetAmount ?? undefined,
            targetDate: targetDate ?? undefined,
            goalType: goalType as any ?? undefined
        });
    }

    // Handle Budget Update
    if (monthlyBudget !== undefined && account.linkedCategoryId) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        let existingBudget;
        if (account.householdId) {
            existingBudget = await ctx.db.query("budgets")
                .withIndex("by_householdId_category_year_month", q => 
                    q.eq("householdId", account.householdId!)
                     .eq("categoryId", account.linkedCategoryId!)
                     .eq("year", year)
                     .eq("month", month)
                ).first();
        } else {
            existingBudget = await ctx.db.query("budgets")
                .withIndex("by_user_category_year_month", q => 
                    q.eq("userId", identity.subject)
                     .eq("categoryId", account.linkedCategoryId!)
                     .eq("year", year)
                     .eq("month", month)
                ).first();
        }

        if (existingBudget) {
            await ctx.db.patch(existingBudget._id, { amount: monthlyBudget });
        } else if (monthlyBudget) {
            await ctx.db.insert("budgets", {
                userId: identity.subject,
                householdId: account.householdId,
                categoryId: account.linkedCategoryId,
                amount: monthlyBudget,
                year,
                month,
            });
        }
    }

    // If type changed to SAVING/ASSET and no category linked yet, create it
    let newLinkedCategoryId = account.linkedCategoryId;
    const newType = args.type || account.type;
    if (!newLinkedCategoryId && (newType === ACCOUNT_TYPES.SAVING || newType === ACCOUNT_TYPES.ASSET)) {
        let finalGoalType = goalType;
        if (newType === ACCOUNT_TYPES.ASSET) {
            finalGoalType = GOAL_TYPES.INVESTMENT;
        }

        newLinkedCategoryId = await ctx.db.insert("categories", {
            userId: identity.subject,
            householdId: account.householdId,
            name: args.name || account.name,
            type: CATEGORY_TYPES.SAVING,
            targetAmount: targetAmount,
            targetDate: targetDate,
            goalType: finalGoalType as any,
        });

        // Also create budget here if provided
        if (monthlyBudget) {
            const now = new Date();
            // Check existing budget (Just in case, though unlikely for new category)
             const existingBudget = await ctx.db.query("budgets")
                .withIndex(account.householdId ? "by_householdId_category_year_month" : "by_user_category_year_month", q => {
                    let builder = q.eq(account.householdId ? "householdId" : "userId", account.householdId || identity.subject)
                                   .eq("categoryId", newLinkedCategoryId!)
                                   .eq("year", now.getFullYear())
                                   .eq("month", now.getMonth());
                    return builder;
                }).first();
            
            if (existingBudget) {
                 await ctx.db.patch(existingBudget._id, { amount: monthlyBudget });
            } else {
                await ctx.db.insert("budgets", {
                    userId: identity.subject,
                    householdId: account.householdId,
                    categoryId: newLinkedCategoryId,
                    amount: monthlyBudget,
                    year: now.getFullYear(),
                    month: now.getMonth(),
                });
            }
        }
    }

    await ctx.db.patch(id, { ...rest, linkedCategoryId: newLinkedCategoryId, visibility: visibility ?? undefined });
  },
});

export const deleteAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const account = await ctx.db.get(args.id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // 1. Check for Transactions linked to this Account
    const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", q => q.eq("userId", identity.subject))
        .collect(); // Global fetch is safe for personal/household scope check later, or filter by index better.
        // Actually, let's just check if ANY transaction uses this accountId.
    
    const accountHasTx = transactions.some(t => t.accountId === args.id || t.toAccountId === args.id);
    
    if (accountHasTx) {
        throw new Error("Cannot delete account with existing transactions. Please Archive it instead.");
    }

    // 2. Handle Linked Category
    if (account.linkedCategoryId) {
        // Check if category has ANY transactions (even from other accounts)
        const categoryHasTx = transactions.some(t => 
            t.categoryId === account.linkedCategoryId || 
            (t.isSplit && t.splits?.some(s => s.categoryId === account.linkedCategoryId))
        );

        if (!categoryHasTx) {
            // 2.1. CLEANUP BUDGETS (Critical for Unassigned Cash)
            // We must delete any budgets assigned to this category so funds return to the pool.
            let budgetsToDelete;
            if (account.householdId) {
                const allBudgets = await ctx.db.query("budgets")
                    .withIndex("by_householdId_year_month", q => q.eq("householdId", account.householdId!))
                    .collect();
                budgetsToDelete = allBudgets.filter(b => b.categoryId === account.linkedCategoryId);
            } else {
                // Fetch all budgets for this user (Safe scan for personal scope)
                const allBudgets = await ctx.db.query("budgets")
                    .withIndex("by_userId_year_month", q => q.eq("userId", identity.subject))
                    .collect();
                budgetsToDelete = allBudgets.filter(b => b.categoryId === account.linkedCategoryId);
            }

            for (const budget of budgetsToDelete) {
                await ctx.db.delete(budget._id);
            }

            // 2.2. Delete category
            await ctx.db.delete(account.linkedCategoryId);
        } else {
            // Category is used elsewhere, just unlink it? 
            // Or actually, if it's a Saving Goal paired to this account, it shouldn't have txs from elsewhere usually.
            // But if it does, we preserve the category but it becomes an orphan (which is better than deleting data).
        }
    }

    await ctx.db.delete(args.id);
  },
});

export const archiveAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const account = await ctx.db.get(args.id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // Check Balance
    const balance = parseFloat(account.balance.replace(/,/g, '') || '0');
    if (Math.abs(balance) > 0) {
        throw new Error("Cannot archive account with non-zero balance. Please transfer funds first.");
    }

    await ctx.db.patch(args.id, { isArchived: true });

    if (account.linkedCategoryId) {
        await ctx.db.patch(account.linkedCategoryId, { isArchived: true, status: GOAL_STATUS.ARCHIVED });
    }
  },
});

export const getLiquidAccountComposition = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        if (!await checkHouseholdAccess(ctx, account.householdId, identity.subject)) {
             throw new Error("Unauthorized");
        }
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // Only applicable for Liquid Accounts
    if (account.type && account.type !== ACCOUNT_TYPES.CASH) {
        return [];
    }

    // 1. Fetch outgoing transfers (Money leaving this account)
    const outgoing = await ctx.db
        .query("transactions")
        .withIndex("by_accountId", q => q.eq("accountId", args.accountId))
        .filter(q => q.eq(q.field("type"), TRANSACTION_TYPES.TRANSFER))
        .collect();

    // 2. Fetch incoming transfers (Money returning to this account)
    const incoming = await ctx.db
        .query("transactions")
        .withIndex("by_toAccountId", q => q.eq("toAccountId", args.accountId))
        .filter(q => q.eq(q.field("type"), TRANSACTION_TYPES.TRANSFER))
        .collect();

    // 3. Map to track net contribution per counterparty
    // Key: Counterparty Account ID -> Value: Net Amount (Outgoing - Incoming)
    const contributionMap = new Map<string, number>();
    const counterpartyIds = new Set<Id<"accounts">>();

    outgoing.forEach(t => {
        if (t.toAccountId) {
            const amount = parseFloat(t.amount.replace(/,/g, '') || '0');
            contributionMap.set(t.toAccountId, (contributionMap.get(t.toAccountId) || 0) + amount);
            counterpartyIds.add(t.toAccountId);
        }
    });

    incoming.forEach(t => {
        const amount = parseFloat(t.amount.replace(/,/g, '') || '0');
        contributionMap.set(t.accountId, (contributionMap.get(t.accountId) || 0) - amount);
        counterpartyIds.add(t.accountId);
    });

    if (counterpartyIds.size === 0) return [];

    // 4. Fetch counterparty details to check their type
    const accounts = await Promise.all(
        Array.from(counterpartyIds).map(id => ctx.db.get(id))
    );

    // 5. Filter only Special Accounts (Saving/Asset) and format result
    const composition = accounts
        .filter(acc => acc && (acc.type === ACCOUNT_TYPES.SAVING || acc.type === ACCOUNT_TYPES.ASSET))
        .map(acc => ({
            id: acc!._id,
            name: acc!.name,
            amount: contributionMap.get(acc!._id) || 0,
            type: acc!.type
        }))
        .filter(item => item.amount > 0); // Only show positive contribution (Net saved from this source)

    return composition;
  }
});
