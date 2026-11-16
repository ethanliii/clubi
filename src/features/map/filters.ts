import type { IconName } from "../../components/Icon";
import type { Filter } from "../../lib/api";

/** The seven map filters, in the order of UI-SPEC. The chip shows `icon` and `label`; tests find "Filter: <label>". */
export const MAP_FILTERS: { filter: Filter; label: string; icon: IconName }[] = [
  { filter: "tonight", label: "Tonight", icon: "clock" },
  { filter: "bars", label: "Bars", icon: "cocktail" },
  { filter: "food", label: "Food", icon: "utensils" },
  { filter: "events", label: "Events", icon: "ticket" },
  { filter: "popups", label: "Pop-ups", icon: "spark" },
  { filter: "outdoors", label: "Outdoors", icon: "tree" },
  { filter: "all", label: "All", icon: "globe" },
];

export const DEFAULT_FILTER: Filter = "tonight";
