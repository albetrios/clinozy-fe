import { useTranslation } from 'react-i18next';

import type {
  TaskRuleId,
  TaskRuleSettings,
  TaskScope,
  TaskTab,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { RoomToolbar, RoomViewTabs } from '@/shared/components/RoomToolbar/index.ts';

import {
  TASKS_KEYS,
  TASKS_NS,
  TASKS_TABLE_ID,
  TASKS_TEST_IDS,
} from '../../tasks.constants.ts';
import { TASK_SCOPE_VALUES, TASK_VIEWS } from '../../tasks.search.ts';
import { TaskRulesPopover } from '../TaskRulesPopover/index.ts';
import { TaskTypePicker } from '../TaskTypePicker/index.ts';

/** Props for {@link TasksToolbar}. */
export interface TasksToolbarProps {
  view: TaskTab;
  onViewChange: (view: TaskTab) => void;
  /** The rules the list is filtered to (the URL's `type`). */
  types: readonly TaskRuleId[];
  onTypesChange: (types: TaskRuleId[]) => void;
  scope: TaskScope;
  onScopeChange: (scope: TaskScope) => void;
  ruleSettings: TaskRuleSettings | undefined;
  /** Owner and Admin switch the rules; everyone else reads them. */
  canEditRules: boolean;
  onRuleChange: (rule: TaskRuleId, patch: { on?: boolean; handled?: boolean }) => void;
  /** "New task" — absent without Create (the button and the phone pill hide). */
  onNewTask?: () => void;
}

/**
 * The Tasks toolbar (KICKOFF §6.10 Toolbar; `tasks.md:17`; H:2129–2139) on the
 * shared room toolbar: h1 "Tasks" · "To do · Snoozed · Done" · the search
 * ("Search tasks or people", 220px open, no key hint) · the type dropdown ·
 * "Mine · Everyone" · "Rules" · "New task" (a plan addition, Q-T4). Both
 * tablists are the rooms' segmented tracks — the prototype's global tab rule
 * repaints its inline outline look (H:228–231). On a phone (`layout="tasks"`):
 * the search alone, the views with "All types" at the inline end, then Mine ·
 * Everyone and Rules; "New task" floats.
 */
export function TasksToolbar({
  view,
  onViewChange,
  types,
  onTypesChange,
  scope,
  onScopeChange,
  ruleSettings,
  canEditRules,
  onRuleChange,
  onNewTask,
}: TasksToolbarProps) {
  const { t } = useTranslation(TASKS_NS);
  return (
    <RoomToolbar
      title={t(TASKS_KEYS.manifest.title)}
      tableId={TASKS_TABLE_ID}
      layout="tasks"
      tabs={
        <RoomViewTabs
          label={t(TASKS_KEYS.views.label)}
          tabs={TASK_VIEWS.map((id) => ({ id, label: t(TASKS_KEYS.views[id]) }))}
          value={view}
          onValueChange={(id) => onViewChange(id as TaskTab)}
          testIdPrefix={TASKS_TABLE_ID}
        />
      }
      search={{
        placeholder: t(TASKS_KEYS.search.placeholder),
        label: t(TASKS_KEYS.search.label),
        width: 'wide',
        keyHint: false,
      }}
      filtersSlot={<TaskTypePicker value={types} onChange={onTypesChange} />}
      actions={
        <>
          <div className="flex min-w-0 flex-none">
            <RoomViewTabs
              label={t(TASKS_KEYS.scope.label)}
              tabs={TASK_SCOPE_VALUES.map((id) => ({
                id,
                label: t(TASKS_KEYS.scope[id]),
              }))}
              value={scope}
              onValueChange={(id) => onScopeChange(id as TaskScope)}
              testIdPrefix={TASKS_TEST_IDS.scope}
            />
          </div>
          <TaskRulesPopover
            settings={ruleSettings}
            canEdit={canEditRules}
            onChange={onRuleChange}
          />
        </>
      }
      primary={
        onNewTask
          ? {
              action: {
                id: 'new',
                label: t(TASKS_KEYS.primary.newTask),
                onSelect: onNewTask,
              },
            }
          : undefined
      }
    />
  );
}
