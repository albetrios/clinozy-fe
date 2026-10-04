import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  LISTED_TASK_RULES,
  TASK_RULES,
  type TaskRuleId,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import {
  Picker,
  PICKER_KEYS,
  PICKER_NS,
  type PickerOption,
  PickerTriggerClear,
} from '@/shared/components/Picker/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';

/** Props for {@link TaskTypePicker}. */
export interface TaskTypePickerProps {
  /** The rules the list is filtered to; none is "All types". */
  value: readonly TaskRuleId[];
  onChange: (rules: TaskRuleId[]) => void;
}

/**
 * The type dropdown (KICKOFF §6.10 Dropdowns; `tasks.md:164–178`; H:2134): a
 * 36px trigger reading "All types", the one rule's name, or "<n> types" — its
 * border darkening while open or filtered, its chevron turning — over the
 * shared picker: the thirteen rules grouped by source (Leads · Appointments ·
 * Feedback · Treatments · Patients · Team), each in its tone, multi-select,
 * searchable, at least 280px; a bottom sheet on a phone. A × clears the pick.
 */
export function TaskTypePicker({ value, onChange }: TaskTypePickerProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const { t: tPicker } = useTranslation(PICKER_NS);
  const options: PickerOption[] = LISTED_TASK_RULES.map((rule) => {
    const group = tRules(TASK_RULE_KEYS.groups[TASK_RULES[rule].group]);
    return {
      key: rule,
      label: tRules(TASK_RULE_KEYS.rules[rule].label),
      sub: group,
      group,
      tone: TASK_RULES[rule].tone,
      leading: { kind: 'dot' },
    };
  });
  const [only] = value;
  let text = t(TASKS_KEYS.type.all);
  if (value.length === 1 && only) text = tRules(TASK_RULE_KEYS.rules[only].label);
  if (value.length > 1) text = t(TASKS_KEYS.type.count, { count: value.length });
  const filtered = value.length > 0;

  return (
    <div data-slot="task-type" className="relative flex flex-none">
      <Picker
        multiple
        value={value}
        onChange={(keys) => onChange(keys as TaskRuleId[])}
        options={options}
        label={t(TASKS_KEYS.type.label)}
        minWidth={280}
        testId={TASKS_TEST_IDS.type}
        renderTrigger={({ open }) => (
          <button
            type="button"
            data-testid={`${TASKS_TEST_IDS.type}-trigger`}
            className={cn(
              'text-body text-foreground hover:bg-muted bg-background flex h-9 flex-none items-center gap-1.5 rounded-lg border ps-3 pe-2.5 leading-none font-medium whitespace-nowrap transition-colors duration-120',
              open || filtered ? 'border-disabled' : 'border-border',
            )}
          >
            {text}
            {/* Room for the clear × the pick adds over the trigger's inline end. */}
            {filtered ? <span aria-hidden="true" className="w-5 flex-none" /> : null}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'text-muted-foreground size-3.5 flex-none transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </button>
        )}
      />
      {filtered ? (
        <PickerTriggerClear
          label={tPicker(PICKER_KEYS.clear)}
          onClear={() => onChange([])}
          testId={`${TASKS_TEST_IDS.type}-clear`}
        />
      ) : null}
    </div>
  );
}
