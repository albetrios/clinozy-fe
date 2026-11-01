import { describe, expect, it } from 'vitest';

import {
  patientChangeOf,
  patientCreateBodyOf,
} from '@/shared/api/app/patients-contracts.ts';
import { TEST_BRANCH_ID } from '@/tests/utils/appointment-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';

import {
  emptyPatientForm,
  isInvalidPatientAge,
  patientFormOf,
  patientInputOf,
} from './patient-form.ts';

const context = { defaultBranchId: TEST_BRANCH_ID };

/**
 * A person registered by age (feat-approximate-age FE1, FE2, F-1 – F-3): the drawer's Age mode
 * saves `age` and never a birth date with it, an approximate person reopens in Age mode, and an
 * edit leaves an unchanged approximate birth alone so it never drifts with the day of the edit.
 */
describe('the patient form — age instead of a birth date', () => {
  it('saves a typed age as `age` only, and a picked date as `date_of_birth` only', () => {
    const byAge = patientInputOf(
      {
        ...emptyPatientForm({ name: 'Asha Patel', phone: '9825000001' }),
        birthMode: 'age',
        age: '34',
      },
      context,
    );
    expect(byAge).toMatchObject({ age: 34, dateOfBirth: null });
    const created = patientCreateBodyOf(byAge, 'new');
    expect(created).toMatchObject({ contact: { age: 34 } });
    expect(created).not.toHaveProperty('contact.date_of_birth');

    const byDate = patientInputOf(
      {
        ...emptyPatientForm({ name: 'Bina Shah', phone: '9825000002' }),
        dateOfBirth: '1986-05-01',
        age: '40',
      },
      context,
    );
    expect(byDate).toMatchObject({ age: null, dateOfBirth: '1986-05-01' });
    const body = patientCreateBodyOf(byDate, 'new');
    expect(body).toMatchObject({ contact: { date_of_birth: '1986-05-01' } });
    expect(body).not.toHaveProperty('contact.age');
  });

  it('clears the birth when the Age mode is left empty', () => {
    const input = patientInputOf(
      { ...emptyPatientForm(), birthMode: 'age', age: ' ' },
      context,
    );
    expect(input).toMatchObject({ age: null, dateOfBirth: null });
  });

  it('refuses an age that is not a whole number from 0 to 120 — only in Age mode', () => {
    for (const age of ['0', '34', '120', '']) {
      expect(isInvalidPatientAge({ birthMode: 'age', age }), age).toBe(false);
    }
    for (const age of ['121', '3.5', '-1', 'abc']) {
      expect(isInvalidPatientAge({ birthMode: 'age', age }), age).toBe(true);
    }
    expect(isInvalidPatientAge({ birthMode: 'date', age: 'abc' })).toBe(false);
  });

  it('reopens an approximate person in Age mode with their age, a real date in Birth date mode', () => {
    const approximate = patientRecord({
      dateOfBirth: '1992-10-31',
      dateOfBirthIsApproximate: true,
      age: 34,
    });
    expect(patientFormOf(approximate)).toMatchObject({
      birthMode: 'age',
      age: '34',
      dateOfBirth: null,
    });
    expect(patientFormOf(patientRecord())).toMatchObject({
      birthMode: 'date',
      dateOfBirth: '1995-10-27',
      age: '',
    });
  });

  it('leaves an unchanged approximate birth out of an edit, and sends a changed one', () => {
    const record = patientRecord({
      dateOfBirth: '1992-10-31',
      dateOfBirthIsApproximate: true,
      age: 34,
    });
    const renamed = patientChangeOf(
      record,
      patientInputOf({ ...patientFormOf(record), firstName: 'Ashaben' }, context),
    );
    expect(renamed.person).toMatchObject({ first_name: 'Ashaben' });
    expect(renamed.person).not.toHaveProperty('age');
    expect(renamed.person).not.toHaveProperty('date_of_birth');

    const older = patientChangeOf(
      record,
      patientInputOf({ ...patientFormOf(record), age: '35' }, context),
    );
    expect(older.person).toMatchObject({ age: 35 });
    expect(older.person).not.toHaveProperty('date_of_birth');

    // Picking the same date makes it a real one
    const real = patientChangeOf(
      record,
      patientInputOf(
        { ...patientFormOf(record), birthMode: 'date', dateOfBirth: '1992-10-31' },
        context,
      ),
    );
    expect(real.person).toMatchObject({ date_of_birth: '1992-10-31' });
    expect(real.person).not.toHaveProperty('age');
  });
});
