import type { ReactNode } from "react";
import { Header, Text } from "../../components";

/**
 * The top of a pushed screen. Same as every other pushed screen: the shared `Header`, which is
 * Bryan's round back button on its own row (actions on the right) with the big heading below.
 */
export function ScreenTop({ title, right }: { title: string; /** Buttons on the back button's row. */ right?: ReactNode }) {
  return <Header title={title} right={right} />;
}

/** A section's title in Bryan's style: the small uppercase muted label. "Who's in (3)". */
export function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <Text variant="label" accessibilityRole="header">
      {count === undefined ? title : `${title} (${count})`}
    </Text>
  );
}
