import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  TASK_BY_HAND,
  TASK_TYPE_VALUES,
  TASK_TYPES,
  type TaskRuleSettingChange,
  type TaskRuleSettings,
  type TaskType,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import { PickerSheet } from '@/shared/components/Picker/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
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

/** The rows the panel stands in for while the settings load. */
const SKELETON_RULES = 6;

/** Props for {@link TaskRulesPopover}. */
export interface TaskRulesPopoverProps {
  /** Every rule's setting (`GET /app/task-rule-settings`) — undefined while it loads. */
  settings: TaskRuleSettings | undefined;
  /** The settings read failed with nothing to show: the panel says so, with Retry. */
  failed: boolean;
  onRetry: () => void;
  /** The switches and "Let Clinozy handle" save (`organization:update`); without it they read only. */
  canEdit: boolean;
  /** Save one rule's change (`PUT /app/task-rule-settings`). */
  onChange: (change: TaskRuleSettingChange) => void;
}

/** One type's line as the panel shows it. */
interface RuleRowProps {
  type: TaskType;
  settings: TaskRuleSettings;
  canEdit: boolean;
  onChange: TaskRulesPopoverProps['onChange'];
}

/** "Let Clinozy handle" ↔ "Clinozy handles it" under a rule the server can do (`can_be_automatic`). */
function HandOverLine({
  text,
  handled,
  canEdit,
  testId,
  onToggle,
}: {
  text: string;
  handled: boolean;
  canEdit: boolean;
  testId: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation(TASKS_NS);
  return (
    <div className="ms-4.5 flex items-center gap-2">
      <span className="text-caption text-muted-foreground-strong min-w-0 flex-1 leading-[normal] text-pretty">
        {text}
      </span>
      <button
        type="button"
        aria-pressed={handled}
        disabled={!canEdit}
        data-testid={testId}
        onClick={onToggle}
        data-slot="pill"
        className={cn(
          'border-border-strong text-caption h-6.5 flex-none rounded-full border px-2.5 font-medium whitespace-nowrap transition-colors duration-120 disabled:cursor-not-allowed disabled:opacity-50',
          handled
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-foreground-soft hover:bg-muted',
        )}
      >
        {t(handled ? TASKS_KEYS.rulesPopover.handled : TASKS_KEYS.rulesPopover.handle)}
      </button>
    </div>
  );
}

/**
 * One type's line: the dot, its name and "<source> · <description>", the
 * switch, and — for a rule the server can do — its hand-over pill. "Follow-ups
 * you set" has no rule behind it: no switch (route map §2 #22).
 */
function RuleRow({ type, settings, canEdit, onChange }: RuleRowProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const definition = TASK_TYPES[type];
  const keys = TASK_RULE_KEYS.rules[type];
  const label = tRules(keys.label);
  const ruleKey = type === TASK_BY_HAND ? null : type;
  const setting = ruleKey ? settings[ruleKey] : undefined;
  // A rule the server did not answer for reads as its default: on, by hand.
  const on = setting?.isOn ?? true;
  const handled = setting?.isAutomatic ?? false;
  const automation = setting?.canBeAutomatic ? keys.automation : null;
  return (
    <div
      data-testid={TASKS_TEST_IDS.rule(type)}
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
        {ruleKey ? (
          <Switch
            checked={on}
            disabled={!canEdit}
            aria-label={label}
            data-testid={TASKS_TEST_IDS.ruleSwitch(type)}
            onCheckedChange={(checked) => onChange({ ruleKey, isOn: checked })}
            className={RULE_SWITCH}
          />
        ) : null}
      </div>
      {ruleKey && automation ? (
        <HandOverLine
          text={tRules(automation)}
          handled={handled}
          canEdit={canEdit}
          testId={TASKS_TEST_IDS.ruleHandle(type)}
          onToggle={() => onChange({ ruleKey, isAutomatic: !handled })}
        />
      ) : null}
    </div>
  );
}

/** The panel's list: bars while the settings load, the error with Retry, else every type. */
function RuleList({
  settings,
  failed,
  onRetry,
  canEdit,
  onChange,
}: TaskRulesPopoverProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  if (failed) {
    return (
      <RetryError
        message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
        onRetry={onRetry}
      />
    );
  }
  if (!settings) {
    return (
      <SkeletonRows
        rows={SKELETON_RULES}
        label={t(TASKS_KEYS.rulesPopover.label)}
        rowClassName="h-14 px-2"
      />
    );
  }
  return (
    <>
      {TASK_TYPE_VALUES.map((type) => (
        <RuleRow
          key={type}
          type={type}
          settings={settings}
          canEdit={canEdit}
          onChange={onChange}
        />
      ))}
    </>
  );
}

/**
 * "Rules" and the Task rules popover (KICKOFF §6.10 Rules popover;
 * `tasks.md:148–162`; H:2136–2137): a 36px outline button with `Sparkles`
 * opening, under it and aligned to its inline end, a 400px panel — "What
 * creates tasks", each of the API's rules with its switch (off drops its tasks
 * from every view) and, where the server can do the work (`can_be_automatic`:
 * Confirm visits, Collect feedback, Payment due, Regulars gone quiet), "Let
 * Clinozy handle" ↔ "Clinozy handles it" (its rows then carry the pill);
 * "Follow-ups you set" closes the list without a switch. Below `md` the 82%
 * bottom sheet. The organization's settings: saved for a member holding
 * `organization:update`, read-only with a line saying so for everyone else. Esc
 * closes it (§7.3).
 */
export function TaskRulesPopover(props: TaskRulesPopoverProps) {
  const { canEdit } = props;
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
        <Button
          type="button"
          variant="outline"
          data-testid={TASKS_TEST_IDS.rulesTrigger}
          className="text-foreground hover:bg-muted gap-1.5 ps-2.5 pe-3 leading-none shadow-none duration-120"
        >
          <Sparkles aria-hidden="true" className="text-muted-foreground size-3.75" />
          {label}
        </Button>
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
          <RuleList {...props} />
        </div>
      </div>
    </PickerSheet>
  );
}
