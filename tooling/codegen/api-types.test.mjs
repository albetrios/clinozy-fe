import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

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
    assert.match(resolveSource(['--source', 'a/b.json'], {}), /a\/b\.json$/);
    assert.equal(
      resolveSource([], { CLINOZY_BE_DIR: '/srv/be' }),
      join('/srv/be', 'docs/openapi/openapi.json'),
    );
    assert.match(resolveSource([], {}), /clinozy-be\/docs\/openapi\/openapi\.json$/);
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
    assert.deepEqual(stripped, {
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
    assert.deepEqual(stripped, {
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

    assert.equal(shareErrorResponses(document), true);

    const responses = document.paths['/api/v1/app/things'].get.responses;
    assert.deepEqual(responses[400], { $ref: '#/components/responses/ApiError' });
    assert.deepEqual(responses[409], { $ref: '#/components/responses/ApiError' });
    assert.deepEqual(responses[200], { description: 'ok' });
    assert.deepEqual(
      Object.keys(document.components.schemas.ApiErrorBody.properties.error.properties),
      ['code', 'detail', 'reason'],
    );
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

    assert.equal(shareErrorResponses(document), false);
    assert.equal(document.components.responses, undefined);
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
    assert.equal(limit.required, false);
    assert.equal(branch.required, true);
    assert.equal(path.required, true);
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
    assert.deepEqual(schema.required, ['email']);
    assert.deepEqual(schema.properties.phones.items.required, ['phone']);
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

    assert.equal(JSON.stringify(raw), before);
    assert.equal(prepared.paths['/api/v1/app/things'].get.description, undefined);
    assert.equal(prepared.paths['/api/v1/app/things'].get.parameters[0].required, false);
    assert.ok(prepared.components.responses.ApiError);
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

    assert.match(text, /^\/\*\*\n \* clinozy-be's API \(OpenAPI 8\.0\.0\)/);
    assert.doesNotMatch(text, /auto-generated by openapi-typescript/);
    assert.doesNotMatch(text, /webhooks|\$defs/);
    for (const name of ['paths', 'components', 'operations']) {
      assert.match(
        text,
        new RegExp(`/\\*\\* [^\\n]+ \\*/\\nexport interface ${name} \\{`),
      );
    }
  });
});
