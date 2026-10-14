import { describe, expect, it } from 'vitest';

import type { RxCatalogMedicine } from '@/shared/api/app/prescriptions-contracts.ts';

import { allergyStems, rxAllergyMatches } from './rx-allergy.ts';
import { emptyRxLine, type RxFormLine } from './rx-form.ts';

function medicine(name: string, composition: string | null): RxCatalogMedicine {
  return {
    name,
    medicineId: `med_${name}`,
    composition,
    stock: 5,
    form: 'oral',
    last: null,
  };
}

const CATALOG = [
  medicine('Septran DS', 'Sulfamethoxazole 800 mg + Trimethoprim 160 mg'),
  medicine('Amoxyclav 625', 'Amoxicillin 500 mg + Clavulanic acid 125 mg'),
  medicine('Doxycycline 100', 'Doxycycline hyclate 100 mg'),
  medicine('Aceclofenac 100', 'Aceclofenac 100 mg'),
  medicine('Cetirizine 10', 'Cetirizine 10 mg'),
  medicine('Zifi 200', 'Cefixime 200 mg'),
];

const line = (medicineName: string, fields: Partial<RxFormLine> = {}): RxFormLine => ({
  ...emptyRxLine(),
  medicineName,
  medicineId: CATALOG.find((row) => row.name === medicineName)?.medicineId ?? null,
  ...fields,
});

describe('allergyStems — the words an allergy is read by', () => {
  it('drops the words every allergy is written with', () => {
    expect(allergyStems('Sulfa drugs')).toContain('sulfa');
    expect(allergyStems('Sulfa drugs')).not.toContain('drugs');
    expect(allergyStems('Allergic to nickel')).toEqual(['nickel']);
  });

  it('reads a family named by its class or by one member', () => {
    expect(allergyStems('Penicillin')).toEqual(
      expect.arrayContaining(['amoxicillin', 'amoxyclav', 'cloxacillin']),
    );
    expect(allergyStems('Amoxicillin')).toEqual(expect.arrayContaining(['ampicillin']));
    expect(allergyStems('NSAIDs')).toEqual(
      expect.arrayContaining(['ibuprofen', 'aceclofenac']),
    );
    expect(allergyStems('Cephalosporins')).toEqual(
      expect.arrayContaining(['cef', 'ceph']),
    );
  });

  it('reads nothing from words too short or generic', () => {
    expect(allergyStems('Drug')).toEqual([]);
    expect(allergyStems('egg')).toEqual([]);
  });
});

describe('rxAllergyMatches — the lines that match the patient’s allergies', () => {
  it('names a line by the store’s composition (Sulfa drugs → Septran DS)', () => {
    const lines = [line('Cetirizine 10'), line('Septran DS')];
    expect(rxAllergyMatches(lines, CATALOG, ['Sulfa drugs'])).toEqual([
      { index: 1, medicineName: 'Septran DS', allergies: ['Sulfa drugs'] },
    ]);
  });

  it('names a line by a family member in its composition', () => {
    const lines = [line('Amoxyclav 625'), line('Doxycycline 100'), line('Zifi 200')];
    const matches = rxAllergyMatches(lines, CATALOG, [
      'Penicillin',
      'Tetracyclines',
      'Cephalosporin',
    ]);
    expect(matches.map((match) => [match.medicineName, match.allergies])).toEqual([
      ['Amoxyclav 625', ['Penicillin']],
      ['Doxycycline 100', ['Tetracyclines']],
      ['Zifi 200', ['Cephalosporin']],
    ]);
  });

  it('reads a typed name the store lacks by its name alone, in any case', () => {
    const lines = [line('IBUPROFEN 400 tablet')];
    expect(rxAllergyMatches(lines, CATALOG, ['NSAID'])).toEqual([
      { index: 0, medicineName: 'IBUPROFEN 400 tablet', allergies: ['NSAID'] },
    ]);
  });

  it('lists every allergy one line matches', () => {
    const lines = [line('Aceclofenac 100')];
    expect(
      rxAllergyMatches(lines, CATALOG, ['NSAIDs', 'Aceclofenac'])[0]?.allergies,
    ).toEqual(['NSAIDs', 'Aceclofenac']);
  });

  it('matches nothing without allergies, for blank lines or unrelated ones', () => {
    const lines = [line(''), line('Cetirizine 10')];
    expect(rxAllergyMatches(lines, CATALOG, null)).toEqual([]);
    expect(rxAllergyMatches(lines, CATALOG, [])).toEqual([]);
    expect(rxAllergyMatches(lines, CATALOG, ['Nickel', 'Latex'])).toEqual([]);
  });
});
