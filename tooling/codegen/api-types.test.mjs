import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import {
  prepareDocument,
  relaxDefaultedQueryParameters,
  renderModule,
  resolveSource,
  shareErrorResponses,
  stripProse,
} from './api-types.mjs';

const ERROR_BODY = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, detail: { type: 'string' } },
    },
  },
};

function documentWith(operations) {
  return {
    openapi: '3.0.0',
    info: { title: 't', version: '8.0.0' },
    paths: { '/api/v1/app/things': operations },
    components: { schemas: {} },
  };
}

describe('api-types: resolveSource', () => {
  it('takes --source, else $CLINOZY_BE_DIR, else the sibling checkout', () => {
    expect(resolveSource(['--source', 'a/b.json'], {})).toMatch(/a\/b\.json$/);
    expect(resolveSource([], { CLINOZY_BE_DIR: '/srv/be' })).toBe(
      join('/srv/be', 'docs/openapi/openapi.json'),
    );
    expect(resolveSource([], {})).toMatch(/clinozy-be\/docs\/openapi\/openapi\.json$/);
  });
});

describe('api-types: stripProse', () => {
  it('drops description, example and examples at every depth and keeps the shape', () => {
    const stripped = stripProse({
      description: 'd',
      properties: {
        id: { type: 'string', example: 'x', description: 'the id' },
        tags: { type: 'array', items: { type: 'string', examples: ['a'] } },
      },
    });
    expect(stripped).toStrictEqual({
      properties: {
        id: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    });
  });

  it('keeps a field named description or example — a properties map holds names', () => {
    const stripped = stripProse({
      type: 'object',
      properties: {
        description: { type: 'string', description: 'what the offering is' },
        example: { type: 'object', properties: { description: { type: 'string' } } },
      },
    });
    expect(stripped).toStrictEqual({
      type: 'object',
      properties: {
        description: { type: 'string' },
        example: { type: 'object', properties: { description: { type: 'string' } } },
      },
    });
  });
});

describe('api-types: shareErrorResponses', () => {
  it('points every error response at one shared component and adds the reason (M5)', () => {
    const document = documentWith({
      get: {
        responses: {
          200: { description: 'ok' },
          400: { content: { 'application/json': { schema: ERROR_BODY } } },
          409: { content: { 'application/json': { schema: ERROR_BODY } } },
        },
      },
    });

    expect(shareErrorResponses(document)).toBe(true);

    const responses = document.paths['/api/v1/app/things'].get.responses;
    expect(responses[400]).toStrictEqual({ $ref: '#/components/responses/ApiError' });
    expect(responses[409]).toStrictEqual({ $ref: '#/components/responses/ApiError' });
    expect(responses[200]).toStrictEqual({ description: 'ok' });
    expect(
      Object.keys(document.components.schemas.ApiErrorBody.properties.error.properties),
    ).toStrictEqual(['code', 'detail', 'reason']);
  });

  it('leaves the document as it was when the error bodies differ', () => {
    const other = { type: 'object', properties: { message: { type: 'string' } } };
    const document = documentWith({
      get: {
        responses: {
          400: { content: { 'application/json': { schema: ERROR_BODY } } },
          404: { content: { 'application/json': { schema: other } } },
        },
      },
    });

    expect(shareErrorResponses(document)).toBe(false);
    expect(document.components.responses).toBe(undefined);
  });
});

describe('api-types: relaxDefaultedQueryParameters', () => {
  it('makes a defaulted query parameter optional (M6) and leaves the others', () => {
    const document = documentWith({
      get: {
        parameters: [
          {
            in: 'query',
            name: 'limit',
            required: true,
            schema: { type: 'integer', default: 25 },
          },
          { in: 'query', name: 'branch_id', required: true, schema: { type: 'string' } },
          {
            in: 'path',
            name: 'thing_id',
            required: true,
            schema: { type: 'string', default: 'x' },
          },
        ],
      },
    });

    relaxDefaultedQueryParameters(document);

    const [limit, branch, path] = document.paths['/api/v1/app/things'].get.parameters;
    expect(limit.required).toBe(false);
    expect(branch.required).toBe(true);
    expect(path.required).toBe(true);
  });
});

describe('api-types: defaulted body fields (M6)', () => {
  it('drops a defaulted field from a body’s required list, at any depth', () => {
    const document = documentWith({
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'expires_in_days'],
                properties: {
                  email: { type: 'string' },
                  expires_in_days: { type: 'integer', default: 7 },
                  phones: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['phone', 'is_primary'],
                      properties: {
                        phone: { type: 'string' },
                        is_primary: { type: 'boolean', default: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    relaxDefaultedQueryParameters(document);

    const schema =
      document.paths['/api/v1/app/things'].post.requestBody.content['application/json']
        .schema;
    expect(schema.required).toStrictEqual(['email']);
    expect(schema.properties.phones.items.required).toStrictEqual(['phone']);
  });
});

describe('api-types: prepareDocument and renderModule', () => {
  it('reduces and corrects the document without changing the input', () => {
    const raw = documentWith({
      get: {
        description: 'lists things',
        parameters: [
          {
            in: 'query',
            name: 'limit',
            required: true,
            schema: { type: 'integer', default: 25 },
          },
        ],
        responses: { 400: { content: { 'application/json': { schema: ERROR_BODY } } } },
      },
    });
    const before = JSON.stringify(raw);

    const prepared = prepareDocument(raw);

    expect(JSON.stringify(raw)).toBe(before);
    expect(prepared.paths['/api/v1/app/things'].get.description).toBe(undefined);
    expect(prepared.paths['/api/v1/app/things'].get.parameters[0].required).toBe(false);
    expect(prepared.components.responses.ApiError).toBeTruthy();
  });

  it('heads the module, drops the empty roots and documents the others', () => {
    const generated = [
      '/**',
      ' * This file was auto-generated by openapi-typescript.',
      ' * Do not make direct changes to the file.',
      ' */',
      '',
      'export interface paths {',
      '}',
      'export type webhooks = Record<string, never>;',
      'export interface components {',
      '}',
      'export type $defs = Record<string, never>;',
      'export interface operations {',
      '}',
      '',
    ].join('\n');

    const text = renderModule(generated, { info: { version: '8.0.0' } });

    expect(text).toMatch(/^\/\*\*\n \* clinozy-be's API \(OpenAPI 8\.0\.0\)/);
    expect(text).not.toMatch(/auto-generated by openapi-typescript/);
    expect(text).not.toMatch(/webhooks|\$defs/);
    for (const name of ['paths', 'components', 'operations']) {
      expect(text).toMatch(
        new RegExp(`/\\*\\* [^\\n]+ \\*/\\nexport interface ${name} \\{`),
      );
    }
  });
});
