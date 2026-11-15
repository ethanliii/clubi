import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Event imports stop on their own while appConfig.ingestFrozen is true
// (`npx convex run ingest:setIngestFrozen '{"frozen": true}'`).
const crons = cronJobs();

crons.interval("luma import", { minutes: 30 }, internal.imports.luma.importLuma, {});

export default crons;
