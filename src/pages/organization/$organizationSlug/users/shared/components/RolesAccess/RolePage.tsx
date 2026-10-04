import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { ClinicRoleView } from '@/shared/api/clinic/access-contracts.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonAvatar } from '@/shared/components/Cells/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { ChevronDown, ChevronLeft, Eye, Shield } from '@/shared/icons/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { RoleAbilities } from './RoleAbilities.tsx';
import { RoleMatrix } from './RoleMatrix.tsx';
import { rolePurposeKey } from './roles-access.ts';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/** The 11px uppercase heading every role section opens with (H:1128). */
function SectionTitle({ children }: { children: string }) {
  return (
    <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
      {children}
    </span>
  );
}

/** What the page's head row and sections are handed. */
export interface RolePageProps {
  role: ClinicRoleView;
  /** The role's name (a preset's clinic name, a custom role's own). */
  label: string;
  /** Every other role, for "Copy access from". */
  others: readonly { role: ClinicRoleView; label: string }[];
  /** Who holds the role, in the Team's order. */
  holders: readonly TeamMember[];
  /** A holder's other roles, " + "-joined ("Admin"). */
  alsoOf: (member: TeamMember) => string;
  writes: RoleAccessWrites;
  /** A custom role the viewer may edit: its name is a box. */
  renamable: boolean;
  onRename: (name: string) => void;
  /** Shown for a custom role nobody holds (the Settings capability, relocated). */
  onDelete?: () => void;
  onOpenMember: (member: TeamMember) => void;
  onPreview: () => void;
  /** On a phone the page starts with "Back to roles". */
  onBack?: () => void;
}

/**
 * The custom role's name box (H:1125): 30px, 16px/600, at most 24
 * characters; the name commits on Enter or leaving the box, Escape puts it back.
 */
function RoleNameBox({
  name,
  label,
  onRename,
}: {
  name: string;
  label: string;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const [was, setWas] = useState(name);
  if (name !== was) {
    setWas(name);
    setDraft(name);
  }
  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') setDraft(name);
  };
  return (
    <input
      value={draft}
      maxLength={24}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      data-testid="users-role-name"
      className="bg-background focus-visible:border-ring -ms-2 h-7.5 max-w-70 rounded-md border px-2 text-base font-semibold outline-none"
    />
  );
}

/**
 * One role's page (`users.md:55–77`; H:1123–1144): the head row — a 40px tile
 * in the role's tone, the name (a box for a custom role), its purpose, "Copy
 * access from" (editable roles) and "Preview as <role>" (never Admin) — then
 * "People with this role", the matrix, the eleven special permissions and the
 * note. On a phone it starts with "Back to roles" and the head row wraps.
 */
export function RolePage(props: RolePageProps) {
  const { t } = useTranslation(USERS_NS);
  const { role, label, writes } = props;
  const tone = TONE_CLASSES[role.tone];
  const editable = writes.lock === null;
  let note: string = USERS_KEYS.roles.notes.live;
  if (writes.lock === 'admin') note = USERS_KEYS.roles.notes.admin;
  else if (writes.lock === 'noPerms') note = USERS_KEYS.roles.notes.readOnly;

  return (
    <div data-testid="users-role-page" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-(--table-pad-x) py-4">
        {props.onBack ? (
          <Button
            type="button"
            variant="outline"
            aria-label={t(USERS_KEYS.roles.back)}
            title={t(USERS_KEYS.roles.back)}
            onClick={props.onBack}
            data-testid="users-roles-back"
            className="text-foreground-soft size-10 flex-none rounded-xl p-0"
          >
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 flex-none items-center justify-center rounded-xl',
            tone.surface,
          )}
        >
          <Shield className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          {props.renamable ? (
            <RoleNameBox
              name={label}
              label={t(USERS_KEYS.roles.nameLabel)}
              onRename={props.onRename}
            />
          ) : (
            <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
              {label}
            </h2>
          )}
          <span className="text-detail text-muted-foreground-strong leading-[1.45] text-pretty">
            {t(rolePurposeKey(role, true))}
          </span>
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          {props.onDelete ? (
            <Button
              type="button"
              variant="outline"
              onClick={props.onDelete}
              data-testid="users-role-delete"
              className="text-destructive text-body h-9 rounded-lg px-3"
            >
              {t(USERS_KEYS.roles.deleteRole.action)}
            </Button>
          ) : null}
          {editable ? (
            <Picker
              menu
              label={t(USERS_KEYS.roles.copyFrom)}
              value={null}
              options={props.others.map((other) => ({
                key: other.role.key,
                label: other.label,
                sub: t(rolePurposeKey(other.role)),
                tone: other.role.tone,
                leading: { kind: 'dot' },
              }))}
              onChange={(key) => {
                const source = props.others.find((other) => other.role.key === key);
                if (source) writes.copyFrom(source.role, source.label, label);
              }}
              minWidth={240}
              testId="users-role-copy"
              renderTrigger={({ open }) => (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="users-role-copy"
                  className="text-body h-9 gap-1.5 rounded-lg ps-3 pe-2.5 font-medium"
                >
                  {t(USERS_KEYS.roles.copyFrom)}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'text-muted-foreground size-3.5 transition-transform duration-150',
                      open && 'rotate-180',
                    )}
                  />
                </Button>
              )}
            />
          ) : null}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={props.onPreview}
                  disabled={role.locked}
                  data-testid="users-role-preview"
                  className="text-body h-9 gap-1.5 rounded-lg ps-3 pe-3.5 font-medium disabled:opacity-50"
                >
                  <Eye aria-hidden="true" className="size-3.5" />
                  {t(USERS_KEYS.roles.preview, { role: label })}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t(USERS_KEYS.roles.previewHint)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-(--table-pad-x) pt-4 pb-6">
        <section className="flex flex-col gap-2">
          <SectionTitle>{t(USERS_KEYS.roles.people)}</SectionTitle>
          {props.holders.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {props.holders.map((member) => {
                const also = props.alsoOf(member);
                return (
                  <button
                    key={member.membershipId}
                    type="button"
                    title={t(USERS_KEYS.roles.openPerson, { name: member.name })}
                    onClick={() => props.onOpenMember(member)}
                    data-testid="users-role-person"
                    data-slot="pill"
                    className="bg-background hover:bg-muted text-detail inline-flex h-7 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 font-medium whitespace-nowrap transition-colors"
                  >
                    <PersonAvatar
                      size="chip"
                      initials={member.initials}
                      tone={member.tone}
                    />
                    {member.name}
                    {also ? (
                      <span className="text-muted-foreground font-normal">
                        {t(USERS_KEYS.roles.also, { roles: also })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-detail text-muted-foreground">
              {t(USERS_KEYS.roles.nobody)}
            </span>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>{t(USERS_KEYS.roles.matrix.title)}</SectionTitle>
          <RoleMatrix role={role} label={label} writes={writes} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>{t(USERS_KEYS.roles.abilities.title)}</SectionTitle>
          <RoleAbilities role={role} writes={writes} />
        </section>

        <span className="text-muted-foreground text-xs leading-normal text-pretty">
          {t(note)}
        </span>
      </div>
    </div>
  );
}
