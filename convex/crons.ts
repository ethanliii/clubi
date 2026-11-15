import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Every import stops on its own while appConfig.ingestFrozen is true
// (`npx convex run ingest:setIngestFrozen '{"frozen": true}'`), and an import
// whose key is not set (TICKETMASTER_KEY, GOOGLE_MAPS_KEY) skips and says so.
const crons = cronJobs();

crons.interval("luma import", { minutes: 30 }, internal.imports.luma.importLuma, {});
crons.interval("partiful import", { minutes: 30 }, internal.imports.partiful.importPartiful, {});
crons.interval("eventbrite import", { minutes: 60 }, internal.imports.eventbrite.importEventbrite, {});
crons.interval("ticketmaster import", { hours: 2 }, internal.imports.ticketmaster.importTicketmaster, {});
crons.interval("google places enrichment", { hours: 6 }, internal.imports.google.enrichPlaces, {});
crons.interval("event tonight notifications", { minutes: 30 }, internal.notificationsCron.eventTonight, {});
// People who started liking or following a performer after the performer's event was imported.
crons.interval("artist alert catch-up", { hours: 24 }, internal.performers.alertRecentFans, {});

export default crons;
