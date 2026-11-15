import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, IconButton, Text } from "../../components";
import { colors, fontWeight, radius, spacing } from "../../theme";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Which = "start" | "end";
export type DateRange = { start?: number; end?: number };

/** A calendar day as ms at local noon, so it stays the same day for friends a few time zones away. */
const noonOf = (year: number, month: number, day: number) => new Date(year, month, day, 12, 0, 0, 0).getTime();

/** A number that orders calendar days: 2026-11-20 → 20261120. */
const dayKey = (ms: number) => {
  const date = new Date(ms);
  return date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();
};

/** "Nov 20, 2026" */
const dayLabel = (ms: number) => {
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
};

/**
 * "Dates": a start and an end, each optional, picked from a small month calendar.
 * Plain views only, so it is the same on iOS, Android and web.
 */
export function DateRangeField({
  value,
  onChange,
  allowClear = true,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Show "Clear dates". Off when editing a saved trip: the backend can change a date but not remove one. */
  allowClear?: boolean;
}) {
  const [today] = useState(() => Date.now());
  const [open, setOpen] = useState<Which | null>(null);
  const [view, setView] = useState(() => {
    const date = new Date(value.start ?? value.end ?? today);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  const show = (which: Which) => {
    if (open === which) {
      setOpen(null);
      return;
    }
    const date = new Date(value[which] ?? value.start ?? value.end ?? today);
    setView({ year: date.getFullYear(), month: date.getMonth() });
    setOpen(which);
  };

  const pick = (ms: number) => {
    if (open === "start") {
      // Keep the range valid: an end before the new start moves up to it.
      const end = value.end !== undefined && dayKey(value.end) < dayKey(ms) ? ms : value.end;
      onChange({ start: ms, end });
      setOpen(value.end === undefined ? "end" : null);
    } else {
      onChange({ start: value.start, end: ms });
      setOpen(null);
    }
  };

  const shiftMonth = (by: 1 | -1) => {
    const date = new Date(view.year, view.month + by, 1);
    setView({ year: date.getFullYear(), month: date.getMonth() });
  };

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  const todayKey = dayKey(today);
  const startKey = value.start === undefined ? null : dayKey(value.start);
  const endKey = value.end === undefined ? null : dayKey(value.end);

  return (
    <View style={styles.wrap}>
      <Text variant="label">Dates</Text>
      <View style={styles.fields}>
        {(["start", "end"] as const).map((which) => {
          const ms = value[which];
          const title = which === "start" ? "Start" : "End";
          return (
            <Pressable
              key={which}
              accessibilityRole="button"
              accessibilityLabel={which === "start" ? "Start date" : "End date"}
              accessibilityState={{ expanded: open === which }}
              onPress={() => show(which)}
              style={({ pressed }) => [styles.field, open === which && styles.fieldOpen, pressed && styles.pressed]}
            >
              <Text variant="caption" muted>
                {title}
              </Text>
              <Text style={ms === undefined ? styles.placeholder : styles.value}>
                {ms === undefined ? "Add a date" : dayLabel(ms)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {open ? (
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <IconButton icon="back" accessibilityLabel="Previous month" size={36} onPress={() => shiftMonth(-1)} />
            <Text style={styles.month}>{`${MONTHS[view.month]} ${view.year}`}</Text>
            <IconButton icon="chevron" accessibilityLabel="Next month" size={36} onPress={() => shiftMonth(1)} />
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((weekday) => (
              <Text key={weekday} variant="caption" muted center style={styles.cell}>
                {weekday.slice(0, 2)}
              </Text>
            ))}
          </View>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.week}>
              {week.map((day, dayIndex) => {
                if (day === null) return <View key={dayIndex} style={styles.cell} />;
                const ms = noonOf(view.year, view.month, day);
                const key = dayKey(ms);
                // No trips in the past, and no end before the start.
                const disabled = key < todayKey || (open === "end" && startKey !== null && key < startKey);
                const isEdge = key === startKey || key === endKey;
                const inRange = startKey !== null && endKey !== null && key > startKey && key < endKey;
                return (
                  <Pressable
                    key={dayIndex}
                    accessibilityRole="button"
                    accessibilityLabel={dayLabel(ms)}
                    accessibilityState={{ selected: isEdge, disabled }}
                    disabled={disabled}
                    onPress={() => pick(ms)}
                    style={({ pressed }) => [
                      styles.cell,
                      styles.day,
                      inRange && styles.dayInRange,
                      isEdge && styles.daySelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        key === todayKey && styles.dayToday,
                        disabled && styles.dayDisabled,
                        isEdge && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      {allowClear && (value.start !== undefined || value.end !== undefined) ? (
        <Button
          title="Clear dates"
          accessibilityLabel="Clear dates"
          variant="link"
          style={styles.clear}
          onPress={() => {
            onChange({});
            setOpen(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  fields: { flexDirection: "row", gap: spacing.sm },
  field: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  fieldOpen: { borderColor: colors.accent },
  placeholder: { color: colors.muted },
  value: { fontWeight: fontWeight.semibold },
  pressed: { opacity: 0.6 },
  calendar: {
    padding: spacing.sm,
    gap: 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  month: { fontWeight: fontWeight.semibold },
  week: { flexDirection: "row" },
  cell: { flex: 1 },
  day: { height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  dayInRange: { backgroundColor: colors.accentSoft },
  daySelected: { backgroundColor: colors.accent },
  dayText: { fontVariant: ["tabular-nums"] },
  dayToday: { fontWeight: fontWeight.bold, color: colors.accent },
  dayDisabled: { color: colors.low },
  dayTextSelected: { color: colors.white, fontWeight: fontWeight.bold },
  clear: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
});
