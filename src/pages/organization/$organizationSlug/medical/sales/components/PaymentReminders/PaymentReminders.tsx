import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import { firstNameOf } from '@/shared/components/ChatColumn/chat-composer.ts';
import { reachLinks, ReachRow } from '@/shared/components/PersonCard/index.ts';
import { PickerSheet } from '@/shared/components/Picker/index.ts';
import { RoomViewAction } from '@/shared/components/RoomToolbar/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useMessageTranslator } from '@/shared/hooks/useMessageTranslator/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { MessageSquare } from '@/shared/icons/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';
import { useSaleReminders } from '../../../shared/hooks/useMedicalLists/index.ts';
import type { SaleListParams, SaleReminder } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.reminders;
const TEST_ID = MEDICAL_DRAWER_TEST_IDS.reminders;

/** Props of {@link PaymentReminders}. */
export interface PaymentRemindersProps {
  /** The Sales list's search and Created: the reminders go to whom the list shows. */
  params: SaleListParams;
}

/**
 * One customer: their avatar and name, what they owe and on which sales, and
 * WhatsApp — the reminder typed — Call and Copy; with no phone on record,
 * Copy alone.
 */
function ReminderRow({ reminder, clinic }: { reminder: SaleReminder; clinic: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const tm = useMessageTranslator(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const { customer, due, saleSeqs } = reminder;
  const name = firstNameOf(customer.name) || customer.name;
  const amount = formatPaise(due);
  const message = tm(K.message, { name, clinic, amount });
  const [seq] = saleSeqs;
  const owed =
    saleSeqs.length === 1
      ? t(K.dueOne, { amount, seq })
      : t(K.dueMany, { amount, count: saleSeqs.length });
  const patient = customer.kind === 'patient';
  return (
    <li data-testid={`${TEST_ID}-row`}>
      <ReachRow
        channel="whatsapp"
        leading={
          <PersonAvatar
            initials={personInitials(customer.name)}
            tone={patient ? 'sage' : 'stone'}
            patient={patient}
            size="cell"
          />
        }
        value={customer.name}
        sub={customer.phone ? owed : [owed, t(K.noPhone)].join(' · ')}
        links={
          customer.phone
            ? reachLinks(
                { channel: 'whatsapp', phone: customer.phone },
                {
                  whatsApp: t(K.whatsApp, { name }),
                  call: t(K.call, { name }),
                  instagram: '',
                },
                message,
              )
            : []
        }
        copy={{
          text: message,
          message: t(K.copied, { name }),
          label: t(K.copy, { name }),
        }}
      />
    </li>
  );
}

/**
 * "Send payment reminders" (KICKOFF §6.7; `medical.md:17`; Q-M6): Sales'
 * view action with Status Unpaid — a 400px panel under the button (the 82%
 * bottom sheet on a phone) listing each customer the unpaid sales name, the
 * largest due first. Messaging is not built, so nothing is sent from here and
 * nothing claims it was (the prototype toasts "WhatsApp reminders sent for
 * unpaid sales", H:5441): WhatsApp opens the customer's chat with the
 * reminder typed, ready to send — in the message language (Q-X2) — Call
 * rings them, and Copy takes the reminder for any other channel. Hidden while
 * no one can be reminded.
 */
export function PaymentReminders({ params }: PaymentRemindersProps) {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tPanel } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const [open, setOpen] = useState(false);
  const reminders = useSaleReminders(params).data;
  if (!reminders || reminders.customers.length === 0) return null;
  const { customers, clinicName } = reminders;
  const label = t(MEDICAL_KEYS.viewActions.paymentReminders);
  const total = customers.reduce((sum, reminder) => sum + reminder.due, 0);
  return (
    <PickerSheet
      open={open}
      onOpenChange={setOpen}
      sheet="filters"
      title={tPanel(K.title)}
      align="end"
      testId={TEST_ID}
      panelClassName="w-100 max-w-[calc(100vw-2.5rem)] max-h-(--radix-popover-content-available-height) rounded-xl"
      trigger={
        <RoomViewAction
          actionId="reminders"
          tableId={MEDICAL_TABLE_IDS.sales}
          icon={MessageSquare}
          label={label}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none flex-col gap-0.5 border-b px-3.5 py-3">
          <span className="text-field leading-[normal] font-semibold">
            {tPanel(K.title)}
          </span>
          <span
            data-testid={`${TEST_ID}-summary`}
            className="text-muted-foreground text-xs leading-[normal]"
          >
            {tPanel(K.summary, { count: customers.length, amount: formatPaise(total) })}
          </span>
          <span className="text-caption text-muted-foreground-strong pt-1 leading-[normal] text-pretty">
            {tPanel(K.hint)}
          </span>
        </div>
        <TooltipProvider>
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-2">
            {customers.map((reminder) => (
              <ReminderRow
                key={`${reminder.customer.kind}-${reminder.customer.id}`}
                reminder={reminder}
                clinic={clinicName}
              />
            ))}
          </ul>
        </TooltipProvider>
      </div>
    </PickerSheet>
  );
}
