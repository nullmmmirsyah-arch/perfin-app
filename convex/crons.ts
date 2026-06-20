import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Automations: Process scheduled transactions.
 * Runs every hour to check for due schedules.
 */
crons.interval(
  "process-scheduled-transactions",
  { hours: 1 },
  internal.automations.processDueSchedules
);

export default crons;
