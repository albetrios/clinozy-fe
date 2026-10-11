import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  TASK_TYPE_VALUES,
  TASK_TYPES,
  type TaskType,
} from '@/shared/api/app/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/app/task-rules.constants.ts';
import {
  Picker,
  PICKER_KEYS,
  PICKER_NS,
  type PickerOption,
  PickerTriggerClear,
} from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { ChevronDown } from '@/shared/icons/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';

/** Props for {@link TaskTypePicker}. */
export interface TaskTypePickerProps {
  /** The types the list is filtered to; none is "All types". */
  value: readonly TaskType[];
  onChange: (types: TaskType[]) => void;
}

/**
 * The type dropdown (KICKOFF §6.10 Dropdowns; `tasks.md:164–178`; H:2134): a
 * 36px trigger reading "All types", the one rule's name, or "<n> types" — its
 * border darkening while open or filtered, its chevron turning — over the
 * shared picker: the API's rules and "Follow-ups you set" grouped by source
 * (Leads · Appointments · Feedback · Treatments · Patients · Team, then
 * Payments and Medical), each in its tone, multi-select, searchable, at least
 * 280px; a bottom sheet on a phone. A × clears the pick. The server matches a
 * task of any type picked — "Follow-ups you set" with rules too (D81 T6).
 */
export function TaskTypePicker({ value, onChange }: TaskTypePickerProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const { t: tPicker } = useTranslation(PICKER_NS);
  const options: PickerOption[] = TASK_TYPE_VALUES.map((type) => {
    const group = tRules(TASK_RULE_KEYS.groups[TASK_TYPES[type].group]);
    return {
      key: type,
      label: tRules(TASK_RULE_KEYS.rules[type].label),
      sub: group,
      group,
      tone: TASK_TYPES[type].tone,
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
        onChange={(keys) => onChange(keys as TaskType[])}
        options={options}
        label={t(TASKS_KEYS.type.label)}
        minWidth={280}
        testId={TASKS_TEST_IDS.type}
        renderTrigger={({ open }) => (
          <Button
            type="button"
            variant="outline"
            data-testid={`${TASKS_TEST_IDS.type}-trigger`}
            className={cn(
              'text-foreground hover:bg-muted gap-1.5 ps-3 pe-2.5 leading-none shadow-none duration-120',
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
          </Button>
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
