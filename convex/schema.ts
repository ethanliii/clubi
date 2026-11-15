import { defineSchema } from "convex/server";
import { catalogTables } from "./tables/catalog";
import { peopleTables } from "./tables/people";
import { socialTables } from "./tables/social";

export default defineSchema({
  ...peopleTables,
  ...catalogTables,
  ...socialTables,
});
