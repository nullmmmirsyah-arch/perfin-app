import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

async function ensureHouseholdAccess(ctx: QueryCtx, householdId: Id<"households">, userId: string) {
    const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
            q.eq("householdId", householdId).eq("userId", userId)
        )
        .first();
    return !!member;
}

export const get = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return [];
        return await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        return await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", identity.subject)).collect();
    }
  },
});

export const getBudgetStatus = query({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.optional(v.number()), // 0-11
    year: v.optional(v.number()),
  },
  handler: async (ctx, { householdId, month, year }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) {
            return {
                data: [],
                unassignedCash: 0,
                hasLeftoverBudget: false,
                breakdown: {
                    thisMonthIncome: 0,
                    thisMonthBudgeted: 0,
                    pastSurplus: 0,
                    totalIncome: 0,
                    totalBudgeted: 0
                }
            };
        }
    }

    const now = new Date();
    const currentYear = year ?? now.getFullYear();
    const currentMonth = month ?? now.getMonth();
    
    // 1. Get all categories
    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // 2. Get budgets for THIS SPECIFIC PERIOD
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", currentMonth)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", currentYear).eq("month", currentMonth)
        ).collect();
    }

    // 3. Calculate date range for the month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // 4. Get transactions for the month
    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const transactionsInMonth = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfMonth && tDate <= endOfMonth;
    });

    // 4b. Get Previous Month Data
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    const prevTransactionsInMonth = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfPrevMonth && tDate <= endOfPrevMonth;
    });

    const prevSpendingByCategory: Record<string, number> = {};
    prevTransactionsInMonth.forEach((t: Doc<"transactions">) => {
      // Allow Expense, Saving, OR Transfer (if category is present)
      if (t.type !== 'expense' && t.type !== 'saving' && t.type !== 'transfer') return;
      if (t.type === 'transfer' && !t.categoryId) return;

       if (t.isSplit && t.splits) {
        t.splits.forEach((split) => {
          if (split.categoryId && split.amount) {
            const amount = parseFloat(split.amount.replace(/,/g, ''));
            if (!isNaN(amount)) {
              prevSpendingByCategory[split.categoryId] = (prevSpendingByCategory[split.categoryId] || 0) + amount;
            }
          }
        });
      } else if (t.categoryId && t.amount) {
        const amount = parseFloat(t.amount.replace(/,/g, ''));
        if (!isNaN(amount)) {
          prevSpendingByCategory[t.categoryId] = (prevSpendingByCategory[t.categoryId] || 0) + amount;
        }
      }
    });


    // 5. Aggregate spending by category (Monthly Contribution)
    // Needs to handle Net Flow for Saving Categories (Add Inflow, Subtract Outflow)
    const spendingByCategory: Record<string, number> = {};
    
    // Helper to reuse account logic
    // Ensure accountTypeMap is populated correctly (already done above but might need reordering if variable scope issue)
    // Actually, 'accountTypeMap' is declared AFTER this block currently. I need to ensure it's available.
    // I will use the 'allAccounts' fetched above (in step 6a preparation) if available, or move it up.
    // Step 6a logic is below step 5. I should move Account fetching BEFORE step 5.

    // Move Account Fetching UP (Before Step 5)
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountTypeMap = new Map(allAccounts.map(a => [a._id, a.type || 'CASH']));
    const getAccountType = (id: string) => accountTypeMap.get(id as Id<"accounts">) || 'CASH';
    const isSpecial = (type: string) => type === 'ASSET' || type === 'SAVING';

    transactionsInMonth.forEach((t: Doc<"transactions">) => {
        const val = Math.abs(parseFloat(t.amount.replace(/,/g, '') || '0'));

        // Case 1: Standard Expense / Saving (Always Add)
        if ((t.type === 'expense' || t.type === 'saving') && t.categoryId) {
             if (t.isSplit && t.splits) {
                 t.splits.forEach((s) => {
                     if (s.categoryId) {
                         spendingByCategory[s.categoryId] = (spendingByCategory[s.categoryId] || 0) + Math.abs(parseFloat(s.amount.replace(/,/g, '') || '0'));
                     }
                 });
             } else {
                 spendingByCategory[t.categoryId] = (spendingByCategory[t.categoryId] || 0) + val;
             }
        }

        // Case 2: Transfer Logic (Net Flow for Monthly Contribution)
        if (t.type === 'transfer' && t.categoryId && t.accountId && t.toAccountId) {
            const sourceType = getAccountType(t.accountId);
            const destType = getAccountType(t.toAccountId);
            const sourceIsSpecial = isSpecial(sourceType);
            const destIsSpecial = isSpecial(destType);

            // Inflow: Liquid -> Special (Nabung) -> Count as "Spent" towards budget
            if (!sourceIsSpecial && destIsSpecial) {
                spendingByCategory[t.categoryId] = (spendingByCategory[t.categoryId] || 0) + val;
            }
            
            // Outflow: Special -> Liquid (Tarik) -> Reduce "Spent" (Negative Contribution)
            if (sourceIsSpecial && !destIsSpecial) {
                spendingByCategory[t.categoryId] = (spendingByCategory[t.categoryId] || 0) - val;
            }
        }
    });

    // 6. Combine data
    const budgetMap = new Map(budgets.map(b => [b.categoryId, b]));

    // B. Total Income (All Time) - Fetched early to be used in calculations below
    let allTransactions: Doc<"transactions">[];
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // 6a. Calculate All-Time Spending for Saving Categories (Accumulated)
    const accumulatedMap = new Map<string, number>();
    
    // accountTypeMap and helpers are already defined above (Step 5)

    allTransactions.forEach((t: Doc<"transactions">) => {
        const val = Math.abs(parseFloat(t.amount.replace(/,/g, '') || '0'));

        // Case 1: Standard Accumulation (Expense / Saving type)
        // These always ADD to the goal accumulation
        if ((t.type === 'expense' || t.type === 'saving') && t.categoryId) {
             if (t.isSplit && t.splits) {
                 t.splits.forEach((s) => {
                     if (s.categoryId) {
                         accumulatedMap.set(s.categoryId, (accumulatedMap.get(s.categoryId) || 0) + Math.abs(parseFloat(s.amount.replace(/,/g, '') || '0')));
                     }
                 });
             } else {
                 accumulatedMap.set(t.categoryId, (accumulatedMap.get(t.categoryId) || 0) + val);
             }
        }
        
        // Case 2: Transfer Logic (Net Flow for Goals)
        if (t.type === 'transfer' && t.categoryId && t.accountId && t.toAccountId) {
            const sourceType = getAccountType(t.accountId);
            const destType = getAccountType(t.toAccountId);

            const sourceIsSpecial = isSpecial(sourceType); // e.g. Gold
            const destIsSpecial = isSpecial(destType);     // e.g. Cash (False)

            // Scenario A: Nabung (Cash -> Goal Account)
            // Liquid -> Special. Effect: Progress UP.
            if (!sourceIsSpecial && destIsSpecial) {
                accumulatedMap.set(t.categoryId, (accumulatedMap.get(t.categoryId) || 0) + val);
            }
            
            // Scenario B: Tarik Tabungan / Jual Aset (Goal Account -> Cash)
            // Special -> Liquid. Effect: Progress DOWN.
            if (sourceIsSpecial && !destIsSpecial) {
                accumulatedMap.set(t.categoryId, (accumulatedMap.get(t.categoryId) || 0) - val);
            }
            
            // Scenario C: Moving between Goals (Goal A -> Goal B)
            // Special -> Special. Effect: Neutral? 
            // If they track category, it implies moving funds for THAT category.
            // But usually this means re-allocating. 
            // If I move Gold -> Silver for "Retirement", progress is same.
            // If I move Gold (House) -> Silver (Car)... Transaction only has 1 category.
            // This is complex. For now, assume neutral if both are Special.
        }
    });

    const data = categories
        .filter(c => (c.type === 'expense' || c.type === 'saving') && c.status !== 'achieved' && c.status !== 'archived' && !c.isArchived)
        .map((category) => {
            const budget = budgetMap.get(category._id);
            const spent = spendingByCategory[category._id] || 0;
            const accumulated = accumulatedMap.get(category._id) || 0;
            
            return {
                category,
                budget,
                spent,
                accumulated,
            };
    });

    // 7. Calculate Unassigned Cash (Total Income - Total Budgeted)
    // This strictly ensures that every budgeted dollar is backed by an income dollar.
    
    // A. Total Budgeted (All Time)
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }
    const totalBudgetedAllTime = allBudgets.reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);

    // Need Account Types to distinguish Transfer Source/Dest
    // Helper to check if account is Liquid (Cash) or Non-Liquid (Asset/Saving)
    // Assumption: 'CASH' (or undefined) is Liquid. 'ASSET' and 'SAVING' are Non-Liquid (Vaults).
    const isLiquid = (id: string) => {
        const type = accountTypeMap.get(id as Id<"accounts">);
        return type !== 'ASSET' && type !== 'SAVING';
    };

    const totalIncomeAllTime = allTransactions
        .reduce((acc, t) => {
            const amount = parseFloat(t.amount.replace(/,/g, '') || '0');

            if (t.type === 'income') {
                if (t.isSplit && t.splits) {
                     return acc + t.splits.reduce((sAcc, s) => sAcc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
                }
                return acc + amount;
            }
            
            // Handle Transfers: Non-Liquid -> Liquid = Income (New Available Cash)
            if (t.type === 'transfer' && t.toAccountId && t.accountId) {
                const sourceIsLiquid = isLiquid(t.accountId);
                const destIsLiquid = isLiquid(t.toAccountId);
                
                // Case: Withdrawing from Asset/Saving to Cash
                if (!sourceIsLiquid && destIsLiquid) {
                    return acc + amount;
                }
                
                // Case: Deposit from Cash to Asset/Saving
                // This is NOT income (it's spending), so we ignore it here.
                // It is handled in spendingByCategory if category is set.
            }

            return acc;
        }, 0);

    const unassignedCash = totalIncomeAllTime - totalBudgetedAllTime;

    // Breakdown for UI
    const startOfSelectedMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfSelectedMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

    const thisMonthIncome = allTransactions
        .filter(t => t.type === 'income' && t.date >= startOfSelectedMonth && t.date <= endOfSelectedMonth)
        .reduce((acc, t) => {
            if (t.isSplit && t.splits) {
                 return acc + t.splits.reduce((sAcc, s) => sAcc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
            }
            return acc + parseFloat(t.amount.replace(/,/g, '') || '0');
        }, 0);

    const thisMonthBudgeted = budgets.reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);
    
    // Past Surplus calculation
    const pastIncome = allTransactions
        .filter(t => t.type === 'income' && t.date < startOfSelectedMonth)
        .reduce((acc, t) => {
            if (t.isSplit && t.splits) {
                 return acc + t.splits.reduce((sAcc, s) => sAcc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
            }
            return acc + parseFloat(t.amount.replace(/,/g, '') || '0');
        }, 0);
    
    const pastBudgeted = allBudgets
        .filter(b => {
            if (b.year < currentYear) return true;
            if (b.year === currentYear && b.month < currentMonth) return true;
            return false;
        })
        .reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);

    const pastSurplus = pastIncome - pastBudgeted;

    const breakdown = {
        thisMonthIncome,
        thisMonthBudgeted,
        pastSurplus,
        totalIncome: totalIncomeAllTime,
        totalBudgeted: totalBudgetedAllTime
    };

    // 8. Check for Leftover Budget in Previous Month (For Sweep Feature)
    let hasLeftoverBudget = false;
    let prevMonthForSweep = currentMonth - 1;
    if (prevMonthForSweep < 0) { prevMonthForSweep = 11; }
    
    // We reuse the logic: Get Prev Month Budgets & Spending
    // Optimization: We already fetched prevBudgets and calculated prevSpendingByCategory above (Step 4b)
    // BUT Step 4b logic was filtered by month selection.
    // If selected month IS NOT current month, we might need specific check. 
    // Actually, let's just use the logic if the user is viewing Current Month.
    
    // For simplicity/robustness, let's quickly re-check specifically for "Last Month relative to Real Time"
    // Only strictly needed if we want to show the button.
    const realNow = new Date();
    const realPrevMonth = realNow.getMonth() - 1 < 0 ? 11 : realNow.getMonth() - 1;
    const realPrevYear = realNow.getMonth() - 1 < 0 ? realNow.getFullYear() - 1 : realNow.getFullYear();
    
    let sweepBudgetsQuery;
    if (householdId) {
        sweepBudgetsQuery = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", realPrevYear).eq("month", realPrevMonth)).collect();
    } else {
        sweepBudgetsQuery = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", realPrevYear).eq("month", realPrevMonth)).collect();
    }

    if (sweepBudgetsQuery.length > 0) {
         // Calculate spending for that specific real previous month
         const startOfRealPrev = new Date(realPrevYear, realPrevMonth, 1);
         const endOfRealPrev = new Date(realPrevYear, realPrevMonth + 1, 0, 23, 59, 59, 999);
         
         // Reuse allTransactions (already fetched globally in step 7B)
         const sweepSpendingMap: Record<string, number> = {};
         allTransactions.forEach(t => {
            const tDate = new Date(t.date);
            if ((t.type === 'expense' || t.type === 'saving') && tDate >= startOfRealPrev && tDate <= endOfRealPrev) {
               if (t.isSplit && t.splits) {
                    t.splits.forEach(s => {
                        if(s.categoryId) sweepSpendingMap[s.categoryId] = (sweepSpendingMap[s.categoryId] || 0) + parseFloat(s.amount.replace(/,/g, '') || '0');
                    });
               } else if (t.categoryId) {
                    sweepSpendingMap[t.categoryId] = (sweepSpendingMap[t.categoryId] || 0) + parseFloat(t.amount.replace(/,/g, '') || '0');
               }
            }
         });

         for (const b of sweepBudgetsQuery) {
             const spent = sweepSpendingMap[b.categoryId] || 0;
             const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
             if (allocated > spent) {
                 hasLeftoverBudget = true;
                 break;
             }
         }
    }

    return { data, unassignedCash, hasLeftoverBudget, breakdown };
  },
});

export const getBudgetAssistance = query({
  args: {
    householdId: v.optional(v.id("households")),
    categoryId: v.id("categories"),
    targetMonth: v.number(),
    targetYear: v.number(),
  },
  handler: async (ctx, { householdId, categoryId, targetMonth, targetYear }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // Calculate Unassigned Cash (Total Income - Total Budgeted)
    // A. Total Budgeted (All Time)
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }
    const totalBudgetedAllTime = allBudgets.reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);

    // B. Total Income (All Time)
    let allTransactionsQuery;
    if (householdId) {
        allTransactionsQuery = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactionsQuery = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // Need Account Types
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountTypeMap = new Map(allAccounts.map(a => [a._id, a.type || 'CASH']));
    
    const isLiquid = (id: string) => {
        const type = accountTypeMap.get(id as Id<"accounts">);
        return type !== 'ASSET' && type !== 'SAVING';
    };

    const totalIncomeAllTime = allTransactionsQuery
        .reduce((acc, t) => {
            const amount = parseFloat(t.amount.replace(/,/g, '') || '0');

            if (t.type === 'income') {
                if (t.isSplit && t.splits) {
                     return acc + t.splits.reduce((sAcc, s) => sAcc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
                }
                return acc + amount;
            }

             if (t.type === 'transfer' && t.toAccountId && t.accountId) {
                const sourceIsLiquid = isLiquid(t.accountId);
                const destIsLiquid = isLiquid(t.toAccountId);
                if (!sourceIsLiquid && destIsLiquid) {
                    return acc + amount;
                }
            }
            return acc;
        }, 0);

    const unassignedCash = totalIncomeAllTime - totalBudgetedAllTime;

    // 1. Previous Month's Budget
    let prevMonth = targetMonth - 1;
    let prevYear = targetYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    let prevBudget;
    if (householdId) {
        prevBudget = await ctx.db.query("budgets")
            .withIndex("by_householdId_category_year_month", q => q.eq("householdId", householdId).eq("categoryId", categoryId).eq("year", prevYear).eq("month", prevMonth))
            .first();
    } else {
        prevBudget = await ctx.db
            .query("budgets")
            .withIndex("by_user_category_year_month", (q) => 
                q.eq("userId", userId)
                .eq("categoryId", categoryId)
                .eq("year", prevYear)
                .eq("month", prevMonth)
            )
            .first();
    }

    // 2. Previous Month's Spending
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    let prevMonthSpent = 0;
    
    const addAmount = (t: Doc<"transactions">, amountStr: string, catId: string) => {
       if (catId === categoryId) {
         const val = parseFloat(amountStr.replace(/,/g, ''));
         if (!isNaN(val)) prevMonthSpent += val;
       }
    };

    allTransactions.forEach(t => {
       const tDate = new Date(t.date);
       if ((t.type === 'expense' || t.type === 'saving') && tDate >= startOfPrevMonth && tDate <= endOfPrevMonth) {
          if (t.isSplit && t.splits) {
            t.splits.forEach(s => addAmount(t, s.amount, s.categoryId));
          } else if (t.categoryId) {
             addAmount(t, t.amount, t.categoryId);
          }
       }
    });

    // 3. Average Spending (Last 3 months with data)
    let totalSpent3Months = 0;
    let monthsWithData = 0;

    for (let i = 1; i <= 3; i++) {
        let m = targetMonth - i;
        let y = targetYear;
        while (m < 0) { m += 12; y--; }
        
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        
        let monthSum = 0;
        let hasData = false;

        allTransactions.forEach(t => {
          const tDate = new Date(t.date);
          if ((t.type === 'expense' || t.type === 'saving') && tDate >= start && tDate <= end) {
              if (t.isSplit && t.splits) {
                t.splits.forEach(s => {
                    if(s.categoryId === categoryId) {
                        monthSum += parseFloat(s.amount.replace(/,/g, '') || '0');
                        hasData = true;
                    }
                });
              } else if (t.categoryId === categoryId) {
                 monthSum += parseFloat(t.amount.replace(/,/g, '') || '0');
                 hasData = true;
              }
          }
        });

        if (hasData) {
            totalSpent3Months += monthSum;
            monthsWithData++;
        }
    }

    const averageSpent = monthsWithData > 0 ? totalSpent3Months / monthsWithData : 0;

    return {
      lastMonthBudget: prevBudget?.amount,
      lastMonthSpent: prevMonthSpent,
      averageSpent: averageSpent,
      unassignedCash,
    };
  }
});

export const upsertBudget = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    categoryId: v.id("categories"),
    amount: v.string(),
    year: v.number(),
    month: v.number(),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, { householdId, targetAmount, targetDate, ...args }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // 0. Update Category Target (if provided)
    // This allows updating goal details directly from the budget drawer
    if (targetAmount !== undefined || targetDate !== undefined) {
        const category = await ctx.db.get(args.categoryId);
        if (category) {
            await ctx.db.patch(args.categoryId, {
                targetAmount: targetAmount ?? category.targetAmount,
                targetDate: targetDate ?? category.targetDate,
            });
        }
    }

    // 1. Calculate Total Income (All Time)
    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // Need Account Types
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountTypeMap = new Map(allAccounts.map(a => [a._id, a.type || 'CASH']));
    
    const isLiquid = (id: string) => {
        const type = accountTypeMap.get(id as Id<"accounts">);
        return type !== 'ASSET' && type !== 'SAVING';
    };

    const totalIncome = allTransactions
        .reduce((acc, t) => {
             const amount = parseFloat(t.amount.replace(/,/g, '') || '0');
             if (t.type === 'income') {
                 if (t.isSplit && t.splits) {
                     return acc + t.splits.reduce((sAcc, s) => sAcc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
                }
                return acc + amount;
             }
             if (t.type === 'transfer' && t.toAccountId && t.accountId) {
                const sourceIsLiquid = isLiquid(t.accountId);
                const destIsLiquid = isLiquid(t.toAccountId);
                if (!sourceIsLiquid && destIsLiquid) {
                    return acc + amount;
                }
            }
            return acc;
        }, 0);

    // 2. Calculate Total Budgeted Amount (All Time)
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }
    
    // Sum of all OTHER budgets (excluding the one we are editing/adding for this specific slot)
    const currentBudgetId = await (async () => {
        if (householdId) {
             const b = await ctx.db.query("budgets").withIndex("by_householdId_category_year_month", q => q.eq("householdId", householdId).eq("categoryId", args.categoryId).eq("year", args.year).eq("month", args.month)).first();
             return b?._id;
        } else {
             const b = await ctx.db.query("budgets").withIndex("by_user_category_year_month", q => q.eq("userId", userId).eq("categoryId", args.categoryId).eq("year", args.year).eq("month", args.month)).first();
             return b?._id;
        }
    })();

    const otherBudgetsTotal = allBudgets
        .filter(b => b._id !== currentBudgetId)
        .reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);
    
    const newBudgetAmount = parseFloat(args.amount.replace(/,/g, '') || '0');
    
    const unassignedBeforeThis = totalIncome - otherBudgetsTotal;

    if (newBudgetAmount > unassignedBeforeThis) {
        throw new Error(`Insufficient funds. Available: ${unassignedBeforeThis.toLocaleString()}, Required: ${newBudgetAmount.toLocaleString()}.`);
    }

    let existingBudget;
    if (householdId) {
        existingBudget = await ctx.db.query("budgets").withIndex("by_householdId_category_year_month", q => q.eq("householdId", householdId).eq("categoryId", args.categoryId).eq("year", args.year).eq("month", args.month)).first();
    } else {
        existingBudget = await ctx.db.query("budgets").withIndex("by_user_category_year_month", (q) => 
            q.eq("userId", identity.subject)
             .eq("categoryId", args.categoryId)
             .eq("year", args.year)
             .eq("month", args.month)
        ).first();
    }

    if (existingBudget) {
      await ctx.db.patch(existingBudget._id, { amount: args.amount });
    } else {
      await ctx.db.insert("budgets", {
        userId: identity.subject,
        householdId,
        categoryId: args.categoryId,
        amount: args.amount,
        year: args.year,
        month: args.month,
      });
    }
  },
});

export const deleteBudget = mutation({
  args: {
    id: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const budget = await ctx.db.get(args.id);
    if (!budget) throw new Error("Budget not found");

    if (budget.householdId) {
        if (!await ensureHouseholdAccess(ctx, budget.householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
        if (budget.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

export const sweepBudgets = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, { householdId, month, year }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (householdId) {
       if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // 1. Get Budgets for the target month
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", identity.subject).eq("year", year).eq("month", month)).collect();
    }

    // 2. Calculate Spending for each budget
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const spendingByCategory: Record<string, number> = {};
    
    transactions.forEach(t => {
       const tDate = new Date(t.date);
       if ((t.type === 'expense' || t.type === 'saving') && tDate >= startOfMonth && tDate <= endOfMonth) {
          if (t.isSplit && t.splits) {
             t.splits.forEach(s => {
                 const amt = parseFloat(s.amount.replace(/,/g, '') || '0');
                 if (s.categoryId) spendingByCategory[s.categoryId] = (spendingByCategory[s.categoryId] || 0) + amt;
             });
          } else if (t.categoryId) {
             const amt = parseFloat(t.amount.replace(/,/g, '') || '0');
             spendingByCategory[t.categoryId] = (spendingByCategory[t.categoryId] || 0) + amt;
          }
       }
    });

    // 3. Update budgets where Allocated > Spent
    let sweptCount = 0;
    for (const budget of budgets) {
        const spent = spendingByCategory[budget.categoryId] || 0;
        const allocated = parseFloat(budget.amount.replace(/,/g, '') || '0');
        
        if (allocated > spent) {
            // "Sweep": Set budget equal to exactly what was spent.
            // This frees up the difference (Allocated - Spent) back to global pool.
            // If nothing was spent, budget becomes 0.
            await ctx.db.patch(budget._id, { amount: spent.toString() });
            sweptCount++;
        }
    }

    return sweptCount;
  }
});
