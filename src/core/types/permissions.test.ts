import { organizationPermissionSchema } from './permissions.ts';

describe('organizationPermissionSchema', () => {
  it('parses a known permission code', () => {
    expect(organizationPermissionSchema.parse('membership:read')).toBe('membership:read');
  });

  it('rejects an unknown permission code', () => {
    expect(() => organizationPermissionSchema.parse('not:a-permission')).toThrow();
  });
});
