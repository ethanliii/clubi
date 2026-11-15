import { defineSchema } from "convex/server";
import { catalogTables } from "./tables/catalog";
import { entitiesTables } from "./tables/entities";
import { insightsTables } from "./tables/insights";
import { peopleTables } from "./tables/people";
import { socialTables } from "./tables/social";
import { tripsTables } from "./tables/trips";
import { uiTables } from "./tables/ui";

// One table file per owner (docs/SESSIONS.md). This file only combines them.
export default defineSchema({
  ...peopleTables,
  ...catalogTables,
  ...socialTables,
  ...insightsTables,
  ...tripsTables,
  ...entitiesTables,
  ...uiTables,
});
