/**
 * React keys for values that may repeat — two bill lines of one name, two
 * members with one short name, one placeholder twice in a message: the value,
 * then "·2", "·3" for its repeats, so a list keeps stable keys without its
 * indices.
 */
export function occurrenceKeys(values: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const count = (seen.get(value) ?? 0) + 1;
    seen.set(value, count);
    return count === 1 ? value : `${value}·${count}`;
  });
}
