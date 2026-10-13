import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
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
import { RoleMatrix } from './RoleMatrix.tsx';
import { rolePurposeKey } from './roles-access.ts';
import { RoleSpecials } from './RoleSpecials.tsx';
import { RoleWorkspace } from './RoleWorkspace.tsx';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/** The page's closing note when its boxes are locked, by why. */
const LOCK_NOTES = {
  admin: USERS_KEYS.roles.notes.admin,
  noPerms: USERS_KEYS.roles.notes.readOnly,
  beyond: USERS_KEYS.roles.notes.beyond,
} as const;

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
  role: RoleSummary;
  /** The role's name (a preset's clinic name, a custom role's own). */
  label: string;
  /** Every other role, for "Copy access from". */
  others: readonly { role: RoleSummary; label: string }[];
  /** Who holds the role, in the Team's order. */
  holders: readonly TeamMember[];
  /** A holder's other roles, " + "-joined ("Admin"). */
  alsoOf: (member: TeamMember) => string;
  /** The role's writes — and its codes, read before the page shows. */
  writes: RoleAccessWrites & { codes: readonly string[] };
  /** A custom role the viewer may edit: its name and its description are boxes. */
  renamable: boolean;
  onRename: (name: string) => void;
  /** A custom role's own description — its purpose line — or null for the default. */
  description: string | null;
  onDescribe: (description: string) => void;
  /** Shown for a custom role nobody holds (the Settings capability, relocated). */
  onDelete?: () => void;
  onOpenMember: (member: TeamMember) => void;
  onPreview: () => void;
  /** On a phone the page starts with "Back to roles". */
  onBack?: () => void;
}

/**
 * A custom role's inline box — its name (H:1125: 30px, 16px/600, at most 24
 * characters) or its description: the text commits on Enter or leaving the
 * box, Escape puts it back. An empty name puts the old one back; an empty
 * description commits, and the page reads it as the default.
 */
function RoleTextBox({
  value,
  label,
  maxLength,
  placeholder,
  allowEmpty = false,
  onCommit,
  testId,
  className,
}: {
  value: string;
  label: string;
  maxLength: number;
  placeholder?: string;
  allowEmpty?: boolean;
  onCommit: (value: string) => void;
  testId: string;
  className: string;
}) {
  const [draft, setDraft] = useState(value);
  const [was, setWas] = useState(value);
  if (value !== was) {
    setWas(value);
    setDraft(value);
  }
  const commit = () => {
    const next = draft.trim();
    if ((next || allowEmpty) && next !== value) onCommit(next);
    else setDraft(value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') setDraft(value);
  };
  return (
    <input
      value={draft}
      maxLength={maxLength}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      data-testid={testId}
      className={cn(
        'bg-background focus-visible:border-ring placeholder:text-muted-foreground -ms-2 rounded-md border px-2 outline-none',
        className,
      )}
    />
  );
}

/**
 * One role's page (`users.md:55–77`; H:1123–1144): the head row — a 40px tile
 * in the role's tone, the name and its purpose (a custom role's own
 * description; both boxes when it is editable), "Copy access from" (editable
 * roles) and "Preview as <role>" (never Owner or Admin) — then "People with this role",
 * the matrix, the special permissions, the workspace permissions (Settings'
 * role dialog, relocated — D17) and the note — every one of them the role's
 * clinozy-be codes.
 * On a phone it starts with "Back to roles" and the head row wraps.
 */
export function RolePage(props: RolePageProps) {
  const { t } = useTranslation(USERS_NS);
  const { role, label, writes } = props;
  const tone = TONE_CLASSES[role.tone];
  const editable = writes.lock === null;
  const note = writes.lock ? LOCK_NOTES[writes.lock] : USERS_KEYS.roles.notes.live;

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
            <>
              <RoleTextBox
                value={label}
                label={t(USERS_KEYS.roles.nameLabel)}
                maxLength={24}
                onCommit={props.onRename}
                testId="users-role-name"
                className="h-7.5 max-w-70 text-base font-semibold"
              />
              <RoleTextBox
                value={props.description ?? ''}
                label={t(USERS_KEYS.roles.descriptionLabel)}
                placeholder={t(rolePurposeKey(role, true))}
                maxLength={160}
                allowEmpty
                onCommit={props.onDescribe}
                testId="users-role-description"
                className="text-detail text-muted-foreground-strong h-7 w-full max-w-120 leading-[1.45]"
              />
            </>
          ) : (
            <>
              <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                {label}
              </h2>
              <span className="text-detail text-muted-foreground-strong leading-[1.45] text-pretty">
                {props.description ?? t(rolePurposeKey(role, true))}
              </span>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
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
                key: other.role.id,
                label: other.label,
                sub: t(rolePurposeKey(other.role)),
                tone: other.role.tone,
                leading: { kind: 'dot' },
              }))}
              onChange={(key) => {
                const source = props.others.find((other) => other.role.id === key);
                if (source) void writes.copyFrom(source.role, source.label, label);
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
                  disabled={role.isLocked}
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
          <RoleMatrix label={label} codes={writes.codes} writes={writes} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>{t(USERS_KEYS.roles.specials.title)}</SectionTitle>
          <RoleSpecials tone={role.tone} codes={writes.codes} writes={writes} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>{t(USERS_KEYS.roles.workspace.title)}</SectionTitle>
          <span className="text-caption text-muted-foreground text-pretty">
            {t(USERS_KEYS.roles.workspace.hint)}
          </span>
          <RoleWorkspace tone={role.tone} codes={writes.codes} writes={writes} />
        </section>

        <span className="text-muted-foreground text-xs leading-normal text-pretty">
          {t(note)}
        </span>
      </div>
    </div>
  );
}
