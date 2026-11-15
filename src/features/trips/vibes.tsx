import { Chip, ChipRow } from "../../components";

export type Vibe = "chill" | "balanced" | "wild";

/** The three vibes the backend knows, with the labels UI-SPEC names. */
export const VIBES: { value: Vibe; label: string }[] = [
  { value: "chill", label: "Chill" },
  { value: "balanced", label: "Balanced" },
  { value: "wild", label: "Wild" },
];

/** "wild" → "Wild". Anything the backend sends that is not one of the three is shown as it came. */
export function vibeLabel(vibe: string | undefined): string {
  if (!vibe) return "";
  return VIBES.find((option) => option.value === vibe)?.label ?? vibe;
}

/** "Chill" / "Balanced" / "Wild". `value` is whatever is selected now (it may come from the backend). */
export function VibeChips({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (vibe: Vibe) => void;
}) {
  return (
    <ChipRow>
      {VIBES.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          accessibilityLabel={option.label}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ChipRow>
  );
}
