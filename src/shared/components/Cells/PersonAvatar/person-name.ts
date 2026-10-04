/** A person record's full name, first and last as stored ("Dr. Drashti Desai", "Riya Shah"). */
export function personFullName(person: {
  firstName: string;
  lastName?: string | null;
}): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

/** Up to two initials from a display name — the first letter of the first two words. */
export function personInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

/**
 * The design's short name for a people cell: "Riya Shah" → "Riya S.", a
 * doctor keeps the name after the title — "Dr. Drashti Desai" → "Dr. Drashti"
 * (H:3747).
 */
export function shortPersonName(name: string): string {
  const words = name
    .trim()
    .replace(/^Dr\.\s*/, 'Dr. ')
    .split(/\s+/)
    .filter(Boolean);
  const [first = '', second] = words;
  if (first === 'Dr.' || !second) return words.slice(0, 2).join(' ');
  return `${first} ${Array.from(second)[0]}.`;
}
