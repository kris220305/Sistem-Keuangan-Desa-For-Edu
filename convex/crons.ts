import { anyApi, cronJobs } from "convex/server";

const crons = cronJobs();

crons.daily(
  "cleanup sessions >7d",
  { hourUTC: 2, minuteUTC: 0 },
  anyApi.sessions.cleanupOldSessions,
  { secret: process.env.CRON_SECRET || "" } as any,
);

export default crons;

