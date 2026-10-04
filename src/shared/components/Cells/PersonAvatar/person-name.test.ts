import { describe, expect, it } from 'vitest';

import { personFullName, personInitials, shortPersonName } from './person-name.ts';

describe('personFullName', () => {
  it('writes the name in full, without a missing last name', () => {
    expect(personFullName({ firstName: 'Dr. Drashti', lastName: 'Desai' })).toBe(
      'Dr. Drashti Desai',
    );
    expect(personFullName({ firstName: 'Riya', lastName: 'Shah' })).toBe('Riya Shah');
    expect(personFullName({ firstName: 'Meera', lastName: '' })).toBe('Meera');
    expect(personFullName({ firstName: 'Asha', lastName: null })).toBe('Asha');
    expect(personFullName({ firstName: 'Kiran' })).toBe('Kiran');
  });

  it('feeds the short name and the initials', () => {
    const name = personFullName({ firstName: 'Dr. Drashti', lastName: 'Desai' });
    expect(shortPersonName(name)).toBe('Dr. Drashti');
    expect(personInitials(personFullName({ firstName: 'Riya', lastName: 'Shah' }))).toBe(
      'RS',
    );
  });
});
