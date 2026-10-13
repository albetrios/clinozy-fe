import assert from 'node:assert/strict';
import test from 'node:test';

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

test('parseCsv reads quoted fields, escaped quotes, commas, line breaks and a BOM', () => {
  const text = '﻿name,note\r\n"Adajan BO","a ""quoted"", note"\n"Two\nlines",plain\n\n';
  assert.deepEqual(parseCsv(text), [
    ['name', 'note'],
    ['Adajan BO', 'a "quoted", note'],
    ['Two\nlines', 'plain'],
  ]);
});

test('parseCsv keeps a last row with no line break after it', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('columnIndexes reads either directory layout and names a missing column', () => {
  assert.deepEqual(columnIndexes(parseCsv(HEADER)[0]), {
    pin: 4,
    office: 3,
    officeType: 5,
    district: 7,
    state: 8,
  });
  assert.deepEqual(
    columnIndexes(['officename', 'pincode', 'officeType', 'Districtname', 'statename']),
    { pin: 1, office: 0, officeType: 2, district: 3, state: 4 },
  );
  assert.throws(() => columnIndexes(['officename', 'pincode']), /officetype/);
});

test('areaName drops the office type and what follows it', () => {
  assert.equal(areaName('Adajan BO'), 'Adajan');
  assert.equal(areaName('Mahatma Gandhi Road S.O'), 'Mahatma Gandhi Road');
  assert.equal(areaName('Sansad Marg HO'), 'Sansad Marg');
  assert.equal(areaName('Bengaluru G.P.O.'), 'Bengaluru');
  assert.equal(areaName('Mumbai GPO'), 'Mumbai');
  assert.equal(areaName('Town Hall SO Mumbai'), 'Town Hall');
  assert.equal(areaName('Amba B.O (Alauli S.O)'), 'Amba');
  assert.equal(areaName('Lakhipur S.O (Goalpara)'), 'Lakhipur');
  assert.equal(areaName('Bilwas B.o'), 'Bilwas');
  assert.equal(areaName('Aghara So BO'), 'Aghara');
  assert.equal(areaName('Abhiya bazarBO'), 'Abhiya Bazar');
  assert.equal(areaName('Thygarayanagar South NDS.O'), 'Thygarayanagar South');
});

test('areaName keeps a place written without a type, and tidies brackets and spaces', () => {
  assert.equal(areaName('Navyug College'), 'Navyug College');
  assert.equal(areaName('Narayana(Nellore) B.O'), 'Narayana (Nellore)');
  assert.equal(areaName('Virol [Simarda BO'), 'Virol');
  assert.equal(areaName('Jogia  B.O'), 'Jogia');
  assert.equal(areaName('Sohna'), 'Sohna');
  assert.equal(areaName('SOUTH CITY BO'), 'South City');
});

test('areaName cases a capitals name and leaves a mixed-case one as written', () => {
  assert.equal(areaName('PALVANCHA B.O'), 'Palvancha');
  assert.equal(areaName('MPT SO'), 'MPT');
  assert.equal(areaName('HighCourt S.O'), 'HighCourt');
  assert.equal(areaName('Dr. Ambedkar Veedhi S.O'), 'Dr. Ambedkar Veedhi');
  assert.equal(areaName('Nawada bazar BO'), 'Nawada Bazar');
  assert.equal(areaName('P and T Colony S.O'), 'P and T Colony');
});

test('areaName leaves out offices that are not places', () => {
  assert.equal(areaName('TEST OFFICE'), null);
  assert.equal(areaName('CAT EXTENSION COUNTER'), null);
  assert.equal(areaName('RML EXTN COUNTER NDHO'), null);
  assert.equal(areaName('Nodal Delivery Centre, Jalandhar'), null);
  assert.equal(areaName('NDC Jodhpur'), null);
  assert.equal(areaName('  '), null);
});

test('titleCase handles connectors, initials, apostrophes and acronyms', () => {
  assert.equal(titleCase('BENGALURU URBAN'), 'Bengaluru Urban');
  assert.equal(titleCase('JAMMU AND KASHMIR'), 'Jammu and Kashmir');
  assert.equal(
    titleCase('THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU'),
    'The Dadra and Nagar Haveli and Daman and Diu',
  );
  assert.equal(titleCase('Y.S.R.'), 'Y.S.R.');
  assert.equal(titleCase('KAIMUR (BHABUA)'), 'Kaimur (Bhabua)');
  assert.equal(titleCase('JANJGIR-CHAMPA'), 'Janjgir-Champa');
  assert.equal(titleCase("KING'S ROAD"), "King's Road");
  assert.equal(titleCase('RLY COLONY'), 'RLY Colony');
});

test('buildPinDirectory groups by prefix, sorts PINs and areas, and de-duplicates areas', () => {
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
  assert.deepEqual([...parts.keys()], ['11', '39']);
  assert.deepEqual(Object.keys(parts.get('39')), ['390002', '395009']);
  assert.deepEqual(parts.get('39')['395009'], [
    'Surat',
    'Gujarat',
    ['Adajan', 'Navyug College', 'Palanpur'],
  ]);
  assert.deepEqual(parts.get('11')['110001'], ['New Delhi', 'Delhi', ['Sansad Marg']]);
});

test('buildPinDirectory takes the district most offices carry, a tie going to the head office', () => {
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
  assert.deepEqual(parts.get('50')['503145'].slice(0, 2), ['Kamareddy', 'Telangana']);
  assert.deepEqual(parts.get('81')['813105'].slice(0, 2), ['Bhagalpur', 'Bihar']);
});

test('buildPinDirectory keeps a PIN whose offices are none of them places, with no areas', () => {
  const parts = buildPinDirectory(
    parseCsv(csv([['NDC Jodhpur', '342001', 'PO', 'JODHPUR', 'RAJASTHAN']])),
  );
  assert.deepEqual(parts.get('34')['342001'], ['Jodhpur', 'Rajasthan', []]);
});

test('formatPart writes the same bytes for the same part', async () => {
  const part = { 395009: ['Surat', 'Gujarat', ['Adajan', 'Navyug College']] };
  const first = await formatPart(part, 'pin-39.json');
  assert.equal(first, await formatPart(part, 'pin-39.json'));
  assert.deepEqual(JSON.parse(first), part);
  assert.ok(first.endsWith('\n'));
});

test('parseArguments reads the CSV path and --out, and refuses anything else', () => {
  assert.match(parseArguments(['raw.csv']).csvPath, /raw\.csv$/);
  assert.match(parseArguments(['raw.csv', '--out', 'parts']).outDirectory, /parts$/);
  assert.match(parseArguments(['--out=parts', 'raw.csv']).outDirectory, /parts$/);
  assert.throws(() => parseArguments([]), /pass the CSV path/);
  assert.throws(() => parseArguments(['raw.csv', '--force']), /unexpected argument/);
  assert.throws(() => parseArguments(['raw.csv', '--out']), /needs a directory/);
});
