import { validateLoginSearch } from './login.search.ts';

describe('validateLoginSearch', () => {
  it('passes through a string redirect', () => {
    expect(validateLoginSearch({ redirect: '/organization/acme/dashboard' })).toEqual({
      redirect: '/organization/acme/dashboard',
    });
  });

  it('drops non-string redirect values', () => {
    expect(validateLoginSearch({ redirect: 42 })).toEqual({ redirect: undefined });
    expect(validateLoginSearch({})).toEqual({ redirect: undefined });
  });
});
