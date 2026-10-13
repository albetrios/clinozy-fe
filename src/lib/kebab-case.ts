/**
 * A camelCase name in kebab-case — `treatmentSuggestions` → `treatment-suggestions`.
 * For test ids and data attributes built from field names, which stay lower-case.
 */
export function kebabCase(name: string): string {
  return name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
