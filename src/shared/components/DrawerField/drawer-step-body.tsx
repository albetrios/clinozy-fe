import type { ReactNode } from 'react';

/**
 * A step card's fields (the drawer form's body): its groups 16px apart, and
 * every control inside disabled at once while the drawer is view only.
 */
export function DrawerStepBody({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      disabled={readOnly}
      className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
    >
      {children}
    </fieldset>
  );
}
