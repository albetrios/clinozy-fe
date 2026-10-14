import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  BranchPlace,
  BranchPlaceKind,
} from '@/shared/api/app/branch-places-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  type DataTableRowAction,
  DataTableRowActions,
} from '@/shared/components/DataTableRowActions/index.ts';
import { DrawerToggle } from '@/shared/components/DrawerField/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { PenLine, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import { useBranchPlaceWrites } from '../../hooks/useBranchPlaces/index.ts';
import {
  type BranchPlacesAccess,
  PLACE_ROW_CLASS,
  type PlaceDraftReport,
  reportRowWriteFailure,
} from './branch-places-form.ts';
import { PlaceNameRow, PlacesEmpty, PlacesSection } from './branch-places-parts.tsx';

const K = BRANCHES_KEYS.drawer.places;

/** Props of {@link BranchPlaceRows}. */
export interface BranchPlaceRowsProps {
  kind: BranchPlaceKind;
  branchId: string;
  places: readonly BranchPlace[];
  access: BranchPlacesAccess;
  onDraft: PlaceDraftReport;
  /** `<testId>` — the list's ids are `<testId>`, `-row`, `-active`, `-add` … */
  testId: string;
}

/** One room or machine: its name, its on / off switch and its actions. */
function PlaceRow({
  place,
  access,
  busy,
  onToggle,
  onRename,
  onRemove,
  testId,
}: {
  place: BranchPlace;
  access: BranchPlacesAccess;
  busy: boolean;
  onToggle: (active: boolean) => void;
  onRename: () => void;
  onRemove: () => void;
  testId: string;
}) {
  const { t } = useTranslation(BRANCHES_NS);
  const actions: DataTableRowAction[] = [
    ...(access.canEdit
      ? [{ id: 'rename', label: t(K.rename), icon: PenLine, onSelect: onRename }]
      : []),
    ...(access.canRemove
      ? [
          {
            id: 'remove',
            label: t(K.remove),
            icon: Trash,
            destructive: true,
            onSelect: onRemove,
          },
        ]
      : []),
  ];
  return (
    <li
      data-testid={`${testId}-row`}
      data-place-id={place.id}
      className={PLACE_ROW_CLASS}
    >
      <span
        dir="auto"
        className={cn(
          'text-body min-w-0 flex-1 truncate [text-align:match-parent] font-medium',
          !place.active && 'text-muted-foreground',
        )}
      >
        {place.name}
      </span>
      <DrawerToggle
        checked={place.active}
        onCheckedChange={onToggle}
        onLabel={t(K.toggle.on)}
        offLabel={t(K.toggle.off)}
        aria-label={t(K.toggle.label, { name: place.name })}
        // Without `branch:update` the switch still says whether it is in use.
        disabled={!access.canEdit || busy}
        data-testid={`${testId}-active`}
        className="shrink-0"
      />
      {actions.length > 0 ? (
        <DataTableRowActions
          actions={actions}
          testIdPrefix={testId}
          className="shrink-0"
        />
      ) : null}
    </li>
  );
}

/**
 * A branch's rooms or machines in "Places & days" (KICKOFF §6.6, D23): every one, switched-off
 * ones too, in the order they were added. Each row saves on its own — the switch at once (in
 * place, rolled back on a refusal), Rename in the row, Remove through the reason confirm with
 * Undo — and the add row under them adds one switched on. A control the member's codes do not
 * allow is not offered; the switch stays, disabled, to say whether the place is in use.
 */
export function BranchPlaceRows({
  kind,
  branchId,
  places,
  access,
  onDraft,
  testId,
}: BranchPlaceRowsProps) {
  const { t } = useTranslation(BRANCHES_NS);
  const writes = useBranchPlaceWrites({ kind, branchId });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BranchPlace | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

  const setRowBusy = (id: string, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const taken = (name: string) => t(K.duplicate[kind], { name });

  const toggle = async (place: BranchPlace, active: boolean) => {
    setRowBusy(place.id, true);
    try {
      await writes.change.mutateAsync({ place, change: { active } });
    } catch (error) {
      reportRowWriteFailure(error, {
        onTaken: () => notify.warning(taken(place.name)),
        onStale: writes.reload,
      });
    } finally {
      setRowBusy(place.id, false);
    }
  };

  return (
    <PlacesSection title={t(K.sections[kind])} hint={t(K.hints[kind])} testId={testId}>
      {places.length > 0 ? (
        <TooltipProvider>
          <ul className="flex min-w-0 flex-col">
            {places.map((place) =>
              renaming === place.id ? (
                <li key={place.id} data-testid={`${testId}-row`} data-place-id={place.id}>
                  <PlaceNameRow
                    mode="rename"
                    initial={place.name}
                    label={t(K.fields.name)}
                    draftKey={`${kind}-rename-${place.id}`}
                    onDraft={onDraft}
                    testId={`${testId}-rename`}
                    onCancel={() => setRenaming(null)}
                    onSubmit={async (name, form) => {
                      if (name === place.name) {
                        setRenaming(null);
                        return;
                      }
                      try {
                        await writes.change.mutateAsync({ place, change: { name } });
                      } catch (error) {
                        reportRowWriteFailure(error, {
                          onTaken: () =>
                            form.setError('name', {
                              type: 'server',
                              message: taken(name),
                            }),
                          fields: { name: 'name' },
                          setFieldError: (_field, message) =>
                            form.setError('name', { type: 'server', message }),
                          onStale: writes.reload,
                        });
                        throw error;
                      }
                      setRenaming(null);
                    }}
                  />
                </li>
              ) : (
                <PlaceRow
                  key={place.id}
                  place={place}
                  access={access}
                  busy={busy.has(place.id)}
                  onToggle={(active) => void toggle(place, active)}
                  onRename={() => setRenaming(place.id)}
                  onRemove={() => setRemoving(place)}
                  testId={testId}
                />
              ),
            )}
          </ul>
        </TooltipProvider>
      ) : (
        <PlacesEmpty testId={`${testId}-empty`}>{t(K.empty[kind])}</PlacesEmpty>
      )}
      {access.canAdd ? (
        <PlaceNameRow
          mode="add"
          initial=""
          label={t(K.newLabel[kind])}
          placeholder={t(K.placeholders[kind])}
          draftKey={`${kind}-add`}
          onDraft={onDraft}
          testId={`${testId}-add`}
          onSubmit={async (name, form) => {
            try {
              await writes.add.mutateAsync({ name });
            } catch (error) {
              reportRowWriteFailure(error, {
                onTaken: () =>
                  form.setError('name', { type: 'server', message: taken(name) }),
                fields: { name: 'name' },
                setFieldError: (_field, message) =>
                  form.setError('name', { type: 'server', message }),
              });
              throw error;
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={t(K.removeTitle[kind])}
        reason={{
          record: removing?.name,
          undo: removing
            ? {
                message: t(K.removed, { name: removing.name }),
                onUndo: () => writes.restore.mutate(removing),
              }
            : undefined,
        }}
        // Landed, the confirm closes itself and offers Undo; a refusal keeps it open.
        onConfirm={async ({ reason, note }) => {
          if (removing)
            await writes.remove.mutateAsync({ record: removing, reason, note });
        }}
      />
    </PlacesSection>
  );
}
