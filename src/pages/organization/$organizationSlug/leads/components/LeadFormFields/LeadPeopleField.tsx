import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { ChevronDown, Search, X } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { LeadField } from './LeadFormFields.tsx';

/** Props of {@link LeadPeopleField}. */
export interface LeadPeopleFieldProps {
  ownerId: string | null;
  involvedIds: readonly string[];
  /** The active members (`useTeamDirectory`). */
  members: readonly DirectoryMember[];
  /** "Claim" (dark 20px pill): open to the team and not mine. */
  onClaim?: () => void;
  /** "Release": mine and held. */
  onRelease?: () => void;
  onAssign: (member: DirectoryMember) => void;
  onToggleInvolved: (member: DirectoryMember, involved: boolean) => void;
  /** Without Edit the people only show. */
  readOnly?: boolean;
}

/**
 * "Assigned & involved" (`leads.md:65`, H:1772–1791): a 36px button with the
 * owner's chip and the involved avatars, "Claim" / "Release" beside the label,
 * and "People on this lead" — search, "Assign" / "Assigned", the involved
 * toggle. Anyone who edits leads may assign anyone (the design's role-to-role
 * rules are not the API's, route map §4); it applies at once, never through the
 * draft.
 */
export function LeadPeopleField({
  ownerId,
  involvedIds,
  members,
  onClaim,
  onRelease,
  onAssign,
  onToggleInvolved,
  readOnly = false,
}: LeadPeopleFieldProps) {
  const { t } = useTranslation(LEADS_NS);
  const [query, setQuery] = useState('');
  const owner = members.find((member) => member.id === ownerId);
  const involved = involvedIds.flatMap(
    (id) => members.find((member) => member.id === id) ?? [],
  );
  const term = query.trim().toLowerCase();
  const rows = term
    ? members.filter((member) => member.name.toLowerCase().includes(term))
    : members;
  /** The Assign button's tooltip: whom it assigns, or that they are. */
  const assignWhy = (member: DirectoryMember) =>
    member.id === ownerId
      ? t(LEADS_KEYS.drawer.popover.currentlyAssigned)
      : t(LEADS_KEYS.drawer.popover.assignTo, { name: member.name });

  const action =
    onClaim || onRelease ? (
      <>
        {onClaim ? (
          <button
            type="button"
            data-slot="pill"
            onClick={onClaim}
            className="bg-foreground text-background hover:bg-foreground/85 text-micro h-5 rounded-full px-2 font-semibold"
          >
            {t(LEADS_KEYS.drawer.claim)}
          </button>
        ) : null}
        {onRelease ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-slot="pill"
                onClick={onRelease}
                className="bg-card text-foreground-soft hover:bg-muted text-micro h-5 rounded-full border px-2 font-medium"
              >
                {t(LEADS_KEYS.drawer.release)}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t(LEADS_KEYS.drawer.releaseHint)}</TooltipContent>
          </Tooltip>
        ) : null}
      </>
    ) : null;

  return (
    <LeadField label={t(LEADS_KEYS.drawer.people)} action={action}>
      <Popover onOpenChange={(open) => !open && setQuery('')}>
        <PopoverTrigger asChild disabled={readOnly}>
          <button
            type="button"
            aria-label={t(LEADS_KEYS.drawer.peopleAria)}
            data-testid={LEADS_TEST_IDS.drawerPeople}
            data-slot="input"
            className="bg-card hover:bg-canvas flex h-9 w-full items-center gap-2 overflow-hidden rounded-lg border ps-1.75 pe-3 text-start shadow-(--elevation-sm)"
          >
            {owner ? (
              <span
                data-slot="pill"
                className="bg-card inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5"
              >
                <PersonAvatar initials={owner.initials} tone={owner.tone} size="chip" />
                <span className="text-detail min-w-0 truncate font-medium">
                  {shortPersonName(owner.name)}
                </span>
              </span>
            ) : null}
            {involved.length > 0 ? (
              <span className="flex flex-none items-center gap-1">
                {involved.map((member) => (
                  <span
                    key={member.id}
                    data-slot="pill"
                    title={member.name}
                    className="bg-card inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-0.5"
                  >
                    <PersonAvatar
                      initials={member.initials}
                      tone={member.tone}
                      size="chip"
                    />
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {t(LEADS_KEYS.drawer.addInvolved)}
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground ms-auto size-4 flex-none"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          aria-label={t(LEADS_KEYS.drawer.popover.title)}
          className="flex max-h-[min(460px,var(--radix-popover-content-available-height))] min-h-40 w-[clamp(320px,var(--radix-popover-trigger-width),440px)] flex-col gap-1 overflow-auto rounded-xl p-2.5 shadow-(--elevation-lg)"
        >
          <div
            data-slot="surface"
            className="bg-popover sticky -top-1.5 z-1 -mx-1.5 -mt-1.5 mb-1 flex h-11 flex-none items-center gap-2 rounded-t-lg border-b px-3"
          >
            <Search
              aria-hidden="true"
              className="text-muted-foreground size-4 flex-none"
            />
            <input
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(LEADS_KEYS.drawer.popover.search)}
              aria-label={t(LEADS_KEYS.drawer.popover.search)}
              className="text-field h-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
          <span className="text-muted-foreground text-caption px-1.5 py-0.5 font-medium">
            {t(LEADS_KEYS.drawer.popover.assignedTo)}
          </span>
          {rows.map((member) => (
            <PersonRow
              key={member.id}
              member={member}
              own={member.id === ownerId}
              involved={involvedIds.includes(member.id)}
              why={assignWhy(member)}
              assignOff={member.id === ownerId || readOnly}
              readOnly={readOnly}
              onAssign={() => onAssign(member)}
              onToggleInvolved={(next) => onToggleInvolved(member, next)}
            />
          ))}
          {rows.length === 0 ? (
            <span className="text-muted-foreground text-detail px-2 py-2.5">
              {t(LEADS_KEYS.drawer.popover.noMatch)}
            </span>
          ) : null}
          <span className="text-muted-foreground text-micro mt-1 border-t px-1.5 pt-1.5 pb-0.5">
            {t(LEADS_KEYS.drawer.popover.note)}
          </span>
        </PopoverContent>
      </Popover>
    </LeadField>
  );
}

/** One row of "People on this lead" (H:1784–1788). */
function PersonRow({
  member,
  own,
  involved,
  why,
  assignOff,
  readOnly,
  onAssign,
  onToggleInvolved,
}: {
  member: DirectoryMember;
  own: boolean;
  involved: boolean;
  why: string;
  assignOff: boolean;
  readOnly: boolean;
  onAssign: () => void;
  onToggleInvolved: (involved: boolean) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  return (
    <div
      className={cn(
        'grid grid-cols-[1.875rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg p-1.5',
        own && 'bg-canvas',
      )}
    >
      <PersonAvatar
        initials={member.initials}
        tone={member.tone}
        size="roster"
        selected={own}
      />
      <span className="text-body min-w-0 truncate leading-tight font-medium">
        {member.name}
      </span>
      <Button
        type="button"
        variant={own ? 'default' : 'outline'}
        size="sm"
        title={why}
        aria-pressed={own}
        disabled={own ? undefined : assignOff}
        aria-disabled={own ? true : undefined}
        onClick={() => {
          if (!assignOff) onAssign();
        }}
        className={cn(
          'px-2 disabled:opacity-40',
          own ? 'border-primary border' : 'bg-card shadow-none',
        )}
      >
        {t(own ? LEADS_KEYS.drawer.popover.assigned : LEADS_KEYS.drawer.popover.assign)}
      </Button>
      <button
        type="button"
        title={t(LEADS_KEYS.drawer.popover.involved)}
        aria-label={t(LEADS_KEYS.drawer.popover.involved)}
        aria-pressed={involved}
        disabled={own || readOnly}
        onClick={() => onToggleInvolved(!involved)}
        data-slot="button"
        className="group/involved bg-card text-body aria-pressed:bg-muted flex size-8 items-center justify-center rounded-lg border disabled:opacity-35 aria-pressed:border-transparent"
      >
        {involved ? (
          <>
            <span aria-hidden="true" className="group-hover/involved:hidden">
              ✓
            </span>
            <X
              aria-hidden="true"
              className="text-destructive hidden size-3.5 group-hover/involved:block"
            />
          </>
        ) : (
          <span aria-hidden="true">+</span>
        )}
      </button>
    </div>
  );
}
