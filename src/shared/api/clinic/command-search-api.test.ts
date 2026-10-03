import { beforeEach, describe, expect, it } from 'vitest';

import {
  COMMAND_SEARCH_PER_TYPE,
  commandSearchQueryKeys,
  isCommandSearchQuery,
  matchesCommandSearch,
  searchClinicCommands,
} from './command-search-api.ts';
import { commandSearchResultSchema } from './command-search-contracts.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

const names = (hits: { name: string }[]) => hits.map((hit) => hit.name);

describe('matchesCommandSearch (H:4605–4607)', () => {
  const dharti = { names: ['Dharti Galani'], phone: '+918200603212', seq: 3508 };

  it.each([
    ['a part of the name, any case', 'GALA'],
    ['the display id', '#3508'],
    ['the id without its #', '3508'],
    ['a part of the id', '#35'],
    ['three digits of the phone', '032'],
    ['the phone as shown', '82006 03212'],
    ['the phone with its country code', '+91 82006 03212'],
    ['a number being typed after +91', '+91 8200'],
  ])('matches %s', (_label, query) => {
    expect(matchesCommandSearch(dharti, query)).toBe(true);
  });

  it.each([
    ['two digits of a phone', '12'],
    ['another name', 'rhea'],
    ['an empty query', '   '],
  ])('does not match %s', (_label, query) => {
    expect(matchesCommandSearch({ ...dharti, seq: 1 }, query)).toBe(false);
  });

  it('matches no phone a record does not have', () => {
    expect(matchesCommandSearch({ names: [], phone: null, seq: 787 }, '8200')).toBe(
      false,
    );
  });
});

describe('isCommandSearchQuery', () => {
  it('searches from two characters, ignoring spaces around them', () => {
    expect(isCommandSearchQuery('d')).toBe(false);
    expect(isCommandSearchQuery(' d ')).toBe(false);
    expect(isCommandSearchQuery('dh')).toBe(true);
  });
});

describe('commandSearchQueryKeys', () => {
  it('keys each query under the clinic search', () => {
    expect(commandSearchQueryKeys.search('dh')).toEqual([
      'clinic',
      'command-search',
      'dh',
    ]);
  });
});

describe('searchClinicCommands (S:1565)', () => {
  beforeEach(() => {
    resetClinicFixtures();
  });

  it('answers in the contract shape', async () => {
    const result = await searchClinicCommands('dh');
    expect(commandSearchResultSchema.safeParse(result).success).toBe(true);
  });

  it('searches nothing below two characters', async () => {
    expect(await searchClinicCommands('d')).toEqual({
      patients: [],
      leads: [],
      invoices: [],
    });
  });

  it('finds patients, leads and invoices by name, newest first', async () => {
    const result = await searchClinicCommands('dh');

    expect(names(result.patients)).toEqual([
      'Dharti Galani',
      'Drashtik Baldha',
      'Dhruv Patel',
    ]);
    expect(result.patients[0]).toMatchObject({ seq: 3508, phone: '+918200603212' });
    expect(result.leads).toEqual([
      expect.objectContaining({
        name: 'Dharti Galani',
        seq: 2352,
        status: 'clinic_visited',
        kind: 'enquiry',
      }),
    ]);
    expect(result.invoices.map((hit) => [hit.seq, hit.type, hit.personName])).toEqual(
      expect.arrayContaining([
        [787, 'clinic', 'Dharti Galani'],
        [786, 'consultation', 'Dharti Galani'],
        [781, 'clinic', 'Dhruv Patel'],
      ]),
    );
    const seqs = result.invoices.map((hit) => hit.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => b - a));
  });

  it('finds a patient by phone digits and by display id', async () => {
    expect(names((await searchClinicCommands('82006')).patients)).toEqual([
      'Dharti Galani',
    ]);
    expect(names((await searchClinicCommands('#3508')).patients)).toEqual([
      'Dharti Galani',
    ]);
  });

  it('never returns a contact thread as a lead (H:4606)', async () => {
    const result = await searchClinicCommands('neha');

    expect(names(result.patients)).toEqual(['Neha Gupta']);
    expect(result.leads).toEqual([]);
  });

  it('finds an invoice by its id and by the walk-in buyer of a sale', async () => {
    const byId = await searchClinicCommands('#787');
    expect(byId.invoices.map((hit) => hit.seq)).toEqual([787]);

    const walkIn = await searchClinicCommands('viral');
    expect(walkIn.invoices).toEqual([
      expect.objectContaining({ type: 'medical', personName: 'Viral Sheth' }),
    ]);
  });

  it('leaves out deleted records', async () => {
    const [dharti] = clinicFixtures.patients.snapshot((patient) => patient.seq === 3508);
    await clinicFixtures.patients.remove(dharti?.id ?? '', 'mistake', null);

    expect(names((await searchClinicCommands('dharti')).patients)).toEqual([]);
  });

  it('returns at most ten of each type', async () => {
    const result = await searchClinicCommands('a');
    expect(result.patients).toEqual([]);

    const wide = await searchClinicCommands('an');
    expect(wide.patients.length).toBeLessThanOrEqual(COMMAND_SEARCH_PER_TYPE);
    expect(wide.leads.length).toBeLessThanOrEqual(COMMAND_SEARCH_PER_TYPE);
    expect(wide.invoices.length).toBeLessThanOrEqual(COMMAND_SEARCH_PER_TYPE);
    expect(wide.patients).toHaveLength(COMMAND_SEARCH_PER_TYPE);
  });
});
