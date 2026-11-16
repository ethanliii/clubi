/**
 * How a place or event name is shown on the map screens. Imported event titles arrive as the
 * organiser typed them ("PAULIE MAC'S PARTICLES — 49ERS vs. COWBOYS WATCH PARTY!"): shouted names
 * are set in title case, and where room is short (a pin, a list row) only the first part is kept.
 */
const SMALL = new Set(["vs", "vs.", "and", "of", "at", "the", "in", "on", "for", "a", "an", "to"]);

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && SMALL.has(word)) return word;
      // "49ers" stays as it is: only a word that starts with a letter gets a capital.
      return word.replace(/^([^a-z0-9]*)([a-z])/, (_all, lead: string, letter: string) => lead + letter.toUpperCase());
    })
    .join(" ");
}

export function displayName(name: string, short = false): string {
  let text = name.replace(/\s*\(demo pop-up\)\s*$/i, "").trim();
  const letters = text.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (letters.length >= 6 && upper / letters.length > 0.6) text = titleCase(text);
  if (short) {
    const cut = text.search(/\s(\||—|–)\s/);
    if (cut > 3) text = text.slice(0, cut);
    text = text.replace(/!+$/, "");
  }
  return text.trim() || name;
}
