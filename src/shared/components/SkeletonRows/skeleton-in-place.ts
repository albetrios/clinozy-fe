/**
 * The in-place skeleton (KICKOFF §3.5 Skeletons, §6.0 Table refresh; H:275–280):
 * on a subtree whose content belongs to the previous params while the next
 * loads, every text run becomes a flat `bg-muted-strong` bar, icons fade and
 * clicks are off — the content stays where it is. A table's rows and the
 * calendars' blocks wear it.
 */
export const SKELETON_IN_PLACE =
  'pointer-events-none [&_:is(span,p,a,button,time):not(:has(*)):not(:empty)]:rounded-md [&_:is(span,p,a,button,time):not(:has(*)):not(:empty)]:bg-muted-strong [&_:is(span,p,a,button,time):not(:has(*)):not(:empty)]:text-transparent [&_svg]:opacity-0';
