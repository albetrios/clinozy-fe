import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  LISTED_TASK_RULES,
  TASK_RULES,
  type TaskRuleId,
  type TaskRuleSettings,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import { PickerSheet } from '@/shared/components/Picker/index.ts';
import { Switch } from '@/shared/components/ui/switch.tsx';
import { Sparkles } from '@/shared/icons/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';

/**
 * The rule switch (`tasks.md:162`): 34 × 20, a 16px knob 2px in, `success`
 * on and `border-strong` off, 150ms — the shadcn switch, resized; its knob
 * stays the page colour in both modes, as the design's.
 */
const RULE_SWITCH =
  'h-5 w-8.5 p-px duration-150 data-[state=checked]:bg-success data-[state=unchecked]:bg-border-strong dark:data-[state=unchecked]:bg-border-strong [&>[data-slot=switch-thumb]]:bg-background';

/** Props for {@link TaskRulesPopover}. */
export interface TaskRulesPopoverProps {
  /** Every rule's org setting; while it loads every rule reads on. */
  settings: TaskRuleSettings | undefined;
  /** Owner and Admin change the rules; everyone else reads them (AMBER, Appendix F). */
  canEdit: boolean;
  onChange: (rule: TaskRuleId, patch: { on?: boolean; handled?: boolean }) => void;
}

/** One rule's line: the dot, its name and "<source> · <description>", the switch, and its hand-over pill. */
function RuleRow({
  rule,
  on,
  handled,
  canEdit,
  onChange,
}: {
  rule: TaskRuleId;
  on: boolean;
  handled: boolean;
  canEdit: boolean;
  onChange: TaskRulesPopoverProps['onChange'];
}) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const definition = TASK_RULES[rule];
  const keys = TASK_RULE_KEYS.rules[rule];
  const label = tRules(keys.label);
  const automation = keys.automation;
  return (
    <div
      data-testid={TASKS_TEST_IDS.rule(rule)}
      data-on={on}
      className="hover:bg-canvas flex flex-col gap-1.5 rounded-lg px-2 py-2.5 transition-colors duration-120"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 flex-none rounded-full',
            TONE_CLASSES[definition.tone].dot,
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="text-body leading-[1.3] font-medium">{label}</span>
          <span className="text-caption text-muted-foreground leading-[1.3]">
            {t(TASKS_KEYS.rulesPopover.line, {
              source: tRules(TASK_RULE_KEYS.groups[definition.group]),
              description: tRules(keys.description),
            })}
          </span>
        </span>
        <Switch
          checked={on}
          disabled={!canEdit}
          aria-label={label}
          data-testid={TASKS_TEST_IDS.ruleSwitch(rule)}
          onCheckedChange={(checked) => onChange(rule, { on: checked })}
          className={RULE_SWITCH}
        />
      </div>
      {automation ? (
        <div className="ms-4.5 flex items-center gap-2">
          <span className="text-caption text-muted-foreground-strong min-w-0 flex-1 leading-[normal] text-pretty">
            {tRules(automation)}
          </span>
          <button
            type="button"
            aria-pressed={handled}
            disabled={!canEdit}
            data-testid={TASKS_TEST_IDS.ruleHandle(rule)}
            onClick={() => onChange(rule, { handled: !handled })}
            data-slot="pill"
            className={cn(
              'border-border-strong text-caption h-6.5 flex-none rounded-full border px-2.5 font-medium whitespace-nowrap transition-colors duration-120 disabled:cursor-not-allowed disabled:opacity-50',
              handled
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground-soft hover:bg-muted',
            )}
          >
            {t(
              handled ? TASKS_KEYS.rulesPopover.handled : TASKS_KEYS.rulesPopover.handle,
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Rules" and the Task rules popover (KICKOFF §6.10 Rules popover;
 * `tasks.md:148–162`; H:2136–2137): a 36px outline button with `Sparkles`
 * opening, under it and aligned to its inline end, a 400px panel — "What
 * creates tasks", the thirteen rules each with its switch (off drops its tasks
 * from every view) and, where the product can do the work, "Let Clinozy
 * handle" ↔ "Clinozy handles it" (its rows then carry the pill). Below `md`
 * the 82% bottom sheet. Org settings: live for Owner and Admin, read-only with
 * a line saying so for everyone else. Esc closes it (§7.3).
 */
export function TaskRulesPopover({ settings, canEdit, onChange }: TaskRulesPopoverProps) {
  const { t } = useTranslation(TASKS_NS);
  const [open, setOpen] = useState(false);
  const label = t(TASKS_KEYS.rulesPopover.button);
  return (
    <PickerSheet
      open={open}
      onOpenChange={setOpen}
      sheet="filters"
      title={t(TASKS_KEYS.rulesPopover.label)}
      align="end"
      testId={TASKS_TEST_IDS.rules}
      panelClassName="w-100 max-w-[calc(100vw-2.5rem)] max-h-(--radix-popover-content-available-height) rounded-xl"
      trigger={
        <button
          type="button"
          data-testid={TASKS_TEST_IDS.rulesTrigger}
          className="text-body text-foreground hover:bg-muted bg-background border-border flex h-9 flex-none items-center gap-1.5 rounded-lg border ps-2.5 pe-3 leading-none font-medium whitespace-nowrap transition-colors duration-120"
        >
          <Sparkles aria-hidden="true" className="text-muted-foreground size-3.75" />
          {label}
        </button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none flex-col gap-0.5 border-b px-3.5 py-3">
          <span className="text-field leading-[normal] font-semibold">
            {t(TASKS_KEYS.rulesPopover.title)}
          </span>
          <span className="text-muted-foreground text-xs leading-[normal] text-pretty">
            {t(TASKS_KEYS.rulesPopover.description)}
          </span>
          {canEdit ? null : (
            <span className="text-caption text-muted-foreground-strong pt-1 leading-[normal]">
              {t(TASKS_KEYS.rulesPopover.readOnly)}
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-1.5">
          {LISTED_TASK_RULES.map((rule) => (
            <RuleRow
              key={rule}
              rule={rule}
              on={settings?.[rule]?.on ?? true}
              handled={settings?.[rule]?.handled ?? false}
              canEdit={canEdit}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </PickerSheet>
  );
}
