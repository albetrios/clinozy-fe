import { configureAxe } from 'vitest-axe';

/**
 * axe with WCAG 2.5.3 Label in Name alone (`label-content-name-mismatch`, on by default since
 * axe-core 4.14): a control named by an `aria-label` must say the words it shows. The canvas
 * stand-in in `setup.ts` is what lets the rule decide in jsdom — without one it reports
 * "incomplete", which `toHaveNoViolations()` lets through — so a test checks both lists:
 *
 * ```ts
 * const results = await axeLabelInName(container);
 * expect(results.violations).toEqual([]);
 * expect(results.incomplete).toEqual([]);
 * ```
 */
export const axeLabelInName = configureAxe({
  runOnly: { type: 'rule', values: ['label-content-name-mismatch'] },
});
