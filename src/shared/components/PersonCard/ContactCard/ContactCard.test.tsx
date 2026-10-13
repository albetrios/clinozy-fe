import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  ContactCard,
  type ContactCardActions,
  ContactCardContent,
  type ContactCardData,
} from './ContactCard.tsx';

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/shared/notify/index.ts', () => ({ notify }));

/** A data token isolated in its own direction (FSI…PDI) inside a sentence. */
const iso = (text: string) => `\u2068${text}\u2069`;

/** Rhea Shah as the prototype seeds her (`CINFO`, H:3369; reviews H:3685). */
const RHEA: ContactCardData = {
  kind: 'patient',
  name: 'Rhea Shah',
  displayId: '#3508',
  since: '2026-06-28T06:30:00.000Z',
  tags: ['vip', 'laser', 'peel'],
  reach: [
    { channel: 'whatsapp', phone: '+919825044120' },
    { channel: 'phone', phone: '+919898012345' },
    { channel: 'instagram', handle: '@rhea.shah' },
  ],
  team: [
    { id: 'dr', name: 'Dr. Rakesh', initials: 'DR', tone: 'sky', role: 'Doctor' },
    { id: 'rs', name: 'Riya', tone: 'blush', role: 'Front desk' },
  ],
  about: {
    gender: 'female',
    age: 29,
    language: 'Gujarati',
    area: 'Vesu, Surat',
    household: 'Shah family · 2 contacts',
    source: 'Instagram',
    owedToThem: 120000,
    owedByThem: 50000,
    reviews: {
      count: 1,
      latestRating: 5,
      latestSource: 'Video',
      latestAt: '2026-06-20T06:30:00.000Z',
    },
    consent: { data: true, photos: true, marketing: false },
  },
};

function renderContent(data: ContactCardData, actions: ContactCardActions = {}) {
  const close = vi.fn();
  const utils = render(
    <TooltipProvider>
      <div role="dialog" aria-label="Contact">
        <ContactCardContent data={data} close={close} {...actions} />
      </div>
    </TooltipProvider>,
  );
  return { ...utils, close };
}

beforeEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-IN' });
});

afterEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-US' });
  vi.unstubAllGlobals();
});

describe('ContactCardContent — header', () => {
  it('tints a patient sage, shows the P badge, the id in the tone ink and the pills', () => {
    const { container } = renderContent(RHEA, { onOpenPatientFile: () => {} });
    const header = container.querySelector('.bg-tone-sage-tint');
    expect(header).not.toBeNull();
    expect(screen.getByTestId('patient-badge')).toBeInTheDocument();
    expect(screen.getByText('#3508')).toHaveClass(
      'text-tone-sage-foreground',
      'font-semibold',
    );
    expect(screen.getByText(`Since ${iso('28 Jun 2026')}`)).toBeInTheDocument();

    // "Patient" plus at most two tags.
    expect(screen.getByText('Patient').closest('[data-slot="pill"]')).toHaveClass(
      'bg-tone-sage',
    );
    expect(screen.getByText('vip').closest('[data-slot="pill"]')).toHaveClass(
      'bg-tone-lav',
    );
    expect(screen.getByText('laser')).toBeInTheDocument();
    expect(screen.queryByText('peel')).toBeNull();
  });

  it('links a patient name to the patient file', async () => {
    const user = userEvent.setup();
    const onOpenPatientFile = vi.fn();
    const { close } = renderContent(RHEA, { onOpenPatientFile });
    const name = screen.getByTestId('contact-card-open-file');
    expect(name).toHaveTextContent('Rhea Shah↗');
    await user.click(name);
    expect(close).toHaveBeenCalledOnce();
    expect(onOpenPatientFile).toHaveBeenCalledOnce();
  });

  it('reads "Lead since" for a lead, tinted lav, with no file link', () => {
    const { container } = renderContent(
      { kind: 'lead', name: 'Anaya Desai', since: '2026-06-16T06:30:00.000Z', reach: [] },
      { onOpenPatientFile: () => {} },
    );
    expect(container.querySelector('.bg-tone-lav-tint')).not.toBeNull();
    expect(screen.getByText(`Lead since ${iso('16 Jun 2026')}`)).toBeInTheDocument();
    expect(screen.getByText('Lead').closest('[data-slot="pill"]')).toHaveClass(
      'bg-tone-lav',
    );
    expect(screen.queryByTestId('contact-card-open-file')).toBeNull();
    expect(screen.queryByTestId('patient-badge')).toBeNull();
  });

  it('isolates the name and the id on a right-to-left page, in their order', () => {
    const { container } = render(
      <TooltipProvider>
        <div dir="rtl">
          <ContactCardContent data={{ ...RHEA, name: 'Riya S.' }} close={() => {}} />
        </div>
      </TooltipProvider>,
    );
    // ".Riya S" and a reordered id are what an unisolated right-to-left line draws.
    const name = screen.getByText('Riya S.');
    expect(name).toHaveAttribute('dir', 'auto');
    expect(name).toHaveClass('[text-align:match-parent]');
    expect(screen.getByText('#3508')).toHaveAttribute('dir', 'ltr');
    expect(container).toHaveTextContent(`Riya S.#3508Since ${iso('28 Jun 2026')}`);
  });

  it('draws a medical contact on the canvas in mint', () => {
    const { container } = renderContent({
      kind: 'contact',
      name: 'Rakesh MR',
      reach: [],
    });
    expect(container.querySelector('.bg-canvas')).not.toBeNull();
    expect(screen.getByText('Contact').closest('[data-slot="pill"]')).toHaveClass(
      'bg-tone-mint',
    );
  });

  it('offers Edit contact, and Change contact only inside forms', async () => {
    const user = userEvent.setup();
    const onEditContact = vi.fn();
    const onChangeContact = vi.fn();
    const { rerender } = renderContent(RHEA, { onEditContact });
    expect(screen.queryByTestId('contact-card-change')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit contact' }));
    expect(onEditContact).toHaveBeenCalledOnce();

    rerender(
      <TooltipProvider>
        <ContactCardContent
          data={RHEA}
          close={() => {}}
          onChangeContact={onChangeContact}
        />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Change contact' }));
    expect(onChangeContact).toHaveBeenCalledOnce();
  });
});

describe('ContactCardContent — reach', () => {
  it('draws one row per number or handle with its channel links', () => {
    renderContent(RHEA);
    const reach = screen.getByRole('group', { name: 'Reach' });

    expect(within(reach).getByText('+91 98250 44120')).toBeInTheDocument();
    expect(within(reach).getByText('WhatsApp · primary')).toBeInTheDocument();
    expect(within(reach).getByText('+91 98980 12345')).toBeInTheDocument();
    expect(within(reach).getByText('Phone · alternate')).toBeInTheDocument();
    expect(within(reach).getByText('@rhea.shah')).toBeInTheDocument();
    // Numbers and handles read in their own direction — left to right — aligned as the row.
    for (const value of ['+91 98250 44120', '+91 98980 12345', '@rhea.shah']) {
      expect(within(reach).getByText(value)).toHaveAttribute('dir', 'auto');
      expect(within(reach).getByText(value)).toHaveClass('[text-align:match-parent]');
    }
    expect(within(reach).getByText('WhatsApp · primary')).not.toHaveAttribute('dir');

    const [whatsApp] = within(reach).getAllByRole('link', { name: 'WhatsApp' });
    expect(whatsApp).toHaveAttribute('href', 'https://wa.me/919825044120');
    expect(whatsApp).toHaveAttribute('target', '_blank');
    expect(whatsApp).toHaveAttribute('rel', 'noopener noreferrer');
    const calls = within(reach).getAllByRole('link', { name: 'Call' });
    expect(calls.map((link) => link.getAttribute('href'))).toEqual([
      'tel:+919825044120',
      'tel:+919898012345',
    ]);
    expect(calls[0]).not.toHaveAttribute('target');
    expect(within(reach).getByRole('link', { name: 'Open Instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/rhea.shah',
    );
  });

  it('copies a number and says so', async () => {
    const user = userEvent.setup();
    renderContent(RHEA);
    const [copyFirst] = screen.getAllByRole('button', { name: 'Copy' });
    await user.click(copyFirst as HTMLElement);
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Copied \u2066+91 98250 44120\u2069'),
    );
    // The clipboard takes the bare number — the marks are for the toast only.
    expect(await navigator.clipboard.readText()).toBe('+91 98250 44120');
  });

  it('says so when the clipboard refuses', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    renderContent(RHEA);
    const [copyFirst] = screen.getAllByRole('button', { name: 'Copy' });
    await user.click(copyFirst as HTMLElement);
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Could not copy to clipboard'),
    );
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('says when nothing is saved yet', () => {
    renderContent({ kind: 'lead', name: 'Walk-in', reach: [] });
    expect(screen.getByText('No phone or handle saved yet')).toBeInTheDocument();
  });
});

describe('ContactCardContent — team and about', () => {
  it('lists the team in chips and offers the claim', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    renderContent(RHEA, { onClaim });
    const team = screen.getByRole('group', { name: 'Team' });
    expect(within(team).getByTitle(`${iso('Dr. Rakesh')} · Doctor`)).toBeInTheDocument();
    expect(within(team).getByText('Dr. Rakesh')).toHaveAttribute('dir', 'auto');
    expect(within(team).getByText('Front desk')).toBeInTheDocument();
    await user.click(within(team).getByRole('button', { name: 'Open · Claim' }));
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('writes the About rows in the design copy', () => {
    renderContent(RHEA);
    const about = screen.getByRole('group', { name: 'About' });
    for (const row of [
      'Female · 29 yrs',
      'Gujarati',
      'Vesu, Surat',
      'Shah family · 2 contacts',
      `Came via ${iso('Instagram')}`,
      `${iso('₹1,200')} to return to them · ${iso('₹500')} they owe the clinic`,
      `1 review · latest ${iso('5')}★ on ${iso('Video')} · ${iso('20 Jun')}`,
    ]) {
      expect(within(about).getByText(row)).toBeInTheDocument();
    }
  });

  it('reads the person’s own About rows in their direction; sentences keep the page’s', () => {
    renderContent(RHEA);
    const about = screen.getByRole('group', { name: 'About' });
    for (const own of ['Gujarati', 'Vesu, Surat', 'Shah family · 2 contacts']) {
      expect(within(about).getByText(own)).toHaveAttribute('dir', 'auto');
    }
    expect(within(about).getByText('Female · 29 yrs')).not.toHaveAttribute('dir');
    expect(within(about).getByText(`Came via ${iso('Instagram')}`)).not.toHaveAttribute(
      'dir',
    );
  });

  it('marks each consent given or not, for eyes and for screen readers', () => {
    renderContent(RHEA);
    expect(screen.getByTitle('Consent · Data')).toHaveClass('bg-tone-sage');
    expect(screen.getByTitle('Consent · Marketing')).toHaveClass('bg-muted');
    expect(screen.getByText('✕ Marketing')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Marketing: no consent')).toHaveClass('sr-only');
    expect(screen.getByText('Data: consent given')).toHaveClass('sr-only');
  });

  it('leaves out the sections it has nothing for', () => {
    renderContent({ kind: 'lead', name: 'Anaya Desai', reach: [] });
    expect(screen.queryByRole('group', { name: 'Team' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'About' })).toBeNull();
  });

  it('pluralises the review count', () => {
    renderContent({
      ...RHEA,
      about: { reviews: { ...RHEA.about!.reviews!, count: 3 } },
    });
    expect(
      screen.getByText(
        `3 reviews · latest ${iso('5')}★ on ${iso('Video')} · ${iso('20 Jun')}`,
      ),
    ).toBeInTheDocument();
  });
});

describe('ContactCardContent — footer', () => {
  it('offers + Lead, + Appointment and, for a non-patient, + Patient', async () => {
    const user = userEvent.setup();
    const onNewLead = vi.fn();
    const onNewAppointment = vi.fn();
    const onNewPatient = vi.fn();
    const { close } = renderContent(
      { kind: 'lead', name: 'Anaya Desai', reach: [] },
      { onNewLead, onNewAppointment, onNewPatient },
    );
    await user.click(screen.getByRole('button', { name: '+ Lead' }));
    await user.click(screen.getByRole('button', { name: '+ Appointment' }));
    await user.click(screen.getByRole('button', { name: '+ Patient' }));
    expect(onNewLead).toHaveBeenCalledOnce();
    expect(onNewAppointment).toHaveBeenCalledOnce();
    expect(onNewPatient).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('contact-card-new-lead').parentElement).toHaveClass(
      'grid-cols-3',
    );
  });

  it('never offers + Patient for a patient', () => {
    renderContent(RHEA, { onNewLead: () => {}, onNewPatient: () => {} });
    expect(screen.queryByRole('button', { name: '+ Patient' })).toBeNull();
    expect(screen.getByTestId('contact-card-new-lead').parentElement).toHaveClass(
      'grid-cols-1',
    );
  });

  it('hides the footer when the role can create nothing', () => {
    renderContent(RHEA);
    expect(screen.queryByRole('button', { name: '+ Lead' })).toBeNull();
  });
});

describe('ContactCard', () => {
  it('fetches the contact on hover and opens the named card', async () => {
    const user = userEvent.setup();
    const load = vi.fn(async () => RHEA);
    render(
      <ContactCard load={load} onNewLead={() => {}}>
        Rhea Shah
      </ContactCard>,
    );
    await user.hover(screen.getByRole('button', { name: 'Rhea Shah' }));
    const card = await screen.findByRole('dialog', { name: 'Contact' });
    expect(load).toHaveBeenCalledOnce();
    expect(card).toHaveAttribute('data-testid', 'contact-card');
    expect(within(card).getByText('Vesu, Surat')).toBeInTheDocument();
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <ContactCard
        data={RHEA}
        onOpenPatientFile={() => {}}
        onEditContact={() => {}}
        onClaim={() => {}}
        onNewLead={() => {}}
        onNewAppointment={() => {}}
      >
        Rhea Shah
      </ContactCard>,
    );
    await user.hover(screen.getByRole('button', { name: 'Rhea Shah' }));
    await screen.findByRole('dialog', { name: 'Contact' });
    expect(
      await axe(baseElement, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
