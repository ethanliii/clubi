import type { Filter } from "../../lib/api";

/** The seven map filters, in the order of UI-SPEC. The chip shows `label`; tests find "Filter: <label>". */
export const MAP_FILTERS: { filter: Filter; label: string }[] = [
  { filter: "tonight", label: "Tonight" },
  { filter: "bars", label: "Bars" },
  { filter: "food", label: "Food" },
  { filter: "events", label: "Events" },
  { filter: "popups", label: "Pop-ups" },
  { filter: "outdoors", label: "Outdoors" },
  { filter: "all", label: "All" },
];

export const DEFAULT_FILTER: Filter = "tonight";
