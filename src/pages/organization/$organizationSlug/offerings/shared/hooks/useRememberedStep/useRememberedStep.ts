import { useState } from 'react';

/** The step a record's drawer had open last, and whose ('new' for a new record). */
export interface StepMemory<S extends string = string> {
  key: string;
  step: S;
}

/** What a drawer's session remembers its steps with: the room's memory and how to update it. */
export interface RememberedStepOptions<S extends string> {
  /** The last step open, kept by the drawer across openings (component state). */
  memory: StepMemory<S> | null;
  onRemember: (memory: StepMemory<S>) => void;
  /** This opening's record: its id, or 'new'. */
  key: string;
  /** The steps this opening shows, in order — a remembered step it lacks is not reopened. */
  steps: readonly S[];
}

/**
 * The open step of an Offerings drawer (`offerings.md:242, 249`): step 1,
 * except that reopening the same record — or another new one — returns to the
 * step that was open last, if this opening still has it. Every step change is
 * remembered for the next opening; collapsing every card is not.
 */
export function useRememberedStep<S extends string>({
  memory,
  onRemember,
  key,
  steps,
}: RememberedStepOptions<S>): readonly [string, (stepId: string) => void] {
  const [openStep, setOpenStep] = useState<string>(() => {
    const remembered = memory?.key === key ? memory.step : undefined;
    return remembered !== undefined && steps.includes(remembered)
      ? remembered
      : (steps[0] ?? '');
  });
  const selectStep = (stepId: string) => {
    setOpenStep(stepId);
    const step = steps.find((candidate) => candidate === stepId);
    if (step !== undefined) onRemember({ key, step });
  };
  return [openStep, selectStep] as const;
}
