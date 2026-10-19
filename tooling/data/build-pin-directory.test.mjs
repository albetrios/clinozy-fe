import { expect, it } from 'vitest';

import {
  areaName,
  buildPinDirectory,
  columnIndexes,
  formatPart,
  parseArguments,
  parseCsv,
  titleCase,
} from './build-pin-directory.mjs';

const HEADER =
  '"CircleName","RegionName","DivisionName","OfficeName","Pincode","OfficeType","Delivery","District","StateName","Latitude","Longitude"';

/** A CSV in the data.gov.in "till last month" layout from `[office, pin, type, district, state]` rows. */
function csv(rows) {
  const lines = rows.map(
    ([office, pin, type, district, state]) =>
      `"Gujarat Circle","Vadodara Region","Surat Division","${office}","${pin}","${type}","Delivery","${district}","${state}","21.19","72.79"`,
  );
  return [HEADER, ...lines].join('\r\n');
}

it('parseCsv reads quoted fields, escaped quotes, commas, line breaks and a BOM', () => {
  const text = '﻿name,note\r\n"Adajan BO","a ""quoted"", note"\n"Two\nlines",plain\n\n';
  expect(parseCsv(text)).toStrictEqual([
    ['name', 'note'],
    ['Adajan BO', 'a "quoted", note'],
    ['Two\nlines', 'plain'],
  ]);
});

it('parseCsv keeps a last row with no line break after it', () => {
  expect(parseCsv('a,b\n1,2')).toStrictEqual([
    ['a', 'b'],
    ['1', '2'],
  ]);
});

it('columnIndexes reads either directory layout and names a missing column', () => {
  expect(columnIndexes(parseCsv(HEADER)[0])).toStrictEqual({
    pin: 4,
    office: 3,
    officeType: 5,
    district: 7,
    state: 8,
  });
  expect(
    columnIndexes(['officename', 'pincode', 'officeType', 'Districtname', 'statename']),
  ).toStrictEqual({ pin: 1, office: 0, officeType: 2, district: 3, state: 4 });
  expect(() => columnIndexes(['officename', 'pincode'])).toThrow(/officetype/);
});

it('areaName drops the office type and what follows it', () => {
  expect(areaName('Adajan BO')).toBe('Adajan');
  expect(areaName('Mahatma Gandhi Road S.O')).toBe('Mahatma Gandhi Road');
  expect(areaName('Sansad Marg HO')).toBe('Sansad Marg');
  expect(areaName('Bengaluru G.P.O.')).toBe('Bengaluru');
  expect(areaName('Mumbai GPO')).toBe('Mumbai');
  expect(areaName('Town Hall SO Mumbai')).toBe('Town Hall');
  expect(areaName('Amba B.O (Alauli S.O)')).toBe('Amba');
  expect(areaName('Lakhipur S.O (Goalpara)')).toBe('Lakhipur');
  expect(areaName('Bilwas B.o')).toBe('Bilwas');
  expect(areaName('Aghara So BO')).toBe('Aghara');
  expect(areaName('Abhiya bazarBO')).toBe('Abhiya Bazar');
  expect(areaName('Thygarayanagar South NDS.O')).toBe('Thygarayanagar South');
});

it('areaName keeps a place written without a type, and tidies brackets and spaces', () => {
  expect(areaName('Navyug College')).toBe('Navyug College');
  expect(areaName('Narayana(Nellore) B.O')).toBe('Narayana (Nellore)');
  expect(areaName('Virol [Simarda BO')).toBe('Virol');
  expect(areaName('Jogia  B.O')).toBe('Jogia');
  expect(areaName('Sohna')).toBe('Sohna');
  expect(areaName('SOUTH CITY BO')).toBe('South City');
});

it('areaName cases a capitals name and leaves a mixed-case one as written', () => {
  expect(areaName('PALVANCHA B.O')).toBe('Palvancha');
  expect(areaName('MPT SO')).toBe('MPT');
  expect(areaName('HighCourt S.O')).toBe('HighCourt');
  expect(areaName('Dr. Ambedkar Veedhi S.O')).toBe('Dr. Ambedkar Veedhi');
  expect(areaName('Nawada bazar BO')).toBe('Nawada Bazar');
  expect(areaName('P and T Colony S.O')).toBe('P and T Colony');
});

it('areaName leaves out offices that are not places', () => {
  expect(areaName('TEST OFFICE')).toBe(null);
  expect(areaName('CAT EXTENSION COUNTER')).toBe(null);
  expect(areaName('RML EXTN COUNTER NDHO')).toBe(null);
  expect(areaName('Nodal Delivery Centre, Jalandhar')).toBe(null);
  expect(areaName('NDC Jodhpur')).toBe(null);
  expect(areaName('  ')).toBe(null);
});

it('titleCase handles connectors, initials, apostrophes and acronyms', () => {
  expect(titleCase('BENGALURU URBAN')).toBe('Bengaluru Urban');
  expect(titleCase('JAMMU AND KASHMIR')).toBe('Jammu and Kashmir');
  expect(titleCase('THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU')).toBe(
    'The Dadra and Nagar Haveli and Daman and Diu',
  );
  expect(titleCase('Y.S.R.')).toBe('Y.S.R.');
  expect(titleCase('KAIMUR (BHABUA)')).toBe('Kaimur (Bhabua)');
  expect(titleCase('JANJGIR-CHAMPA')).toBe('Janjgir-Champa');
  expect(titleCase("KING'S ROAD")).toBe("King's Road");
  expect(titleCase('RLY COLONY')).toBe('RLY Colony');
});

it('buildPinDirectory groups by prefix, sorts PINs and areas, and de-duplicates areas', () => {
  const parts = buildPinDirectory(
    parseCsv(
      csv([
        ['Palanpur BO', '395009', 'BO', 'SURAT', 'GUJARAT'],
        ['Adajan BO', '395009', 'BO', 'SURAT', 'GUJARAT'],
        ['ADAJAN B.O', '395009', 'BO', 'SURAT', 'GUJARAT'],
        ['Navyug College SO', '395009', 'PO', 'SURAT', 'GUJARAT'],
        ['Sansad Marg HO', '110001', 'HO', 'NEW DELHI', 'DELHI'],
        ['Fateganj SO', '390002', 'PO', 'VADODARA', 'GUJARAT'],
        ['Not a PIN BO', '39500', 'BO', 'SURAT', 'GUJARAT'],
      ]),
    ),
  );
  expect([...parts.keys()]).toStrictEqual(['11', '39']);
  expect(Object.keys(parts.get('39'))).toStrictEqual(['390002', '395009']);
  expect(parts.get('39')['395009']).toStrictEqual([
    'Surat',
    'Gujarat',
    ['Adajan', 'Navyug College', 'Palanpur'],
  ]);
  expect(parts.get('11')['110001']).toStrictEqual([
    'New Delhi',
    'Delhi',
    ['Sansad Marg'],
  ]);
});

it('buildPinDirectory takes the district most offices carry, a tie going to the head office', () => {
  const parts = buildPinDirectory(
    parseCsv(
      csv([
        ['Kamareddy SO', '503145', 'PO', 'KAMAREDDY', 'TELANGANA'],
        ['Alpha BO', '503145', 'BO', 'KAMAREDDY', 'TELANGANA'],
        ['Beta BO', '503145', 'BO', 'VIZIANAGARAM', 'ANDHRA PRADESH'],
        ['Banka BO', '813105', 'BO', 'BANKA', 'BIHAR'],
        ['Bhagalpur HO', '813105', 'HO', 'BHAGALPUR', 'BIHAR'],
      ]),
    ),
  );
  expect(parts.get('50')['503145'].slice(0, 2)).toStrictEqual(['Kamareddy', 'Telangana']);
  expect(parts.get('81')['813105'].slice(0, 2)).toStrictEqual(['Bhagalpur', 'Bihar']);
});

it('buildPinDirectory keeps a PIN whose offices are none of them places, with no areas', () => {
  const parts = buildPinDirectory(
    parseCsv(csv([['NDC Jodhpur', '342001', 'PO', 'JODHPUR', 'RAJASTHAN']])),
  );
  expect(parts.get('34')['342001']).toStrictEqual(['Jodhpur', 'Rajasthan', []]);
});

it('formatPart writes the same bytes for the same part', async () => {
  const part = { 395009: ['Surat', 'Gujarat', ['Adajan', 'Navyug College']] };
  const first = await formatPart(part, 'pin-39.json');
  expect(first).toBe(await formatPart(part, 'pin-39.json'));
  expect(JSON.parse(first)).toStrictEqual(part);
  expect(first.endsWith('\n')).toBeTruthy();
});

it('parseArguments reads the CSV path and --out, and refuses anything else', () => {
  expect(parseArguments(['raw.csv']).csvPath).toMatch(/raw\.csv$/);
  expect(parseArguments(['raw.csv', '--out', 'parts']).outDirectory).toMatch(/parts$/);
  expect(parseArguments(['--out=parts', 'raw.csv']).outDirectory).toMatch(/parts$/);
  expect(() => parseArguments([])).toThrow(/pass the CSV path/);
  expect(() => parseArguments(['raw.csv', '--force'])).toThrow(/unexpected argument/);
  expect(() => parseArguments(['raw.csv', '--out'])).toThrow(/needs a directory/);
});
