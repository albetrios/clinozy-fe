#!/usr/bin/env node
/**
 * Generates `src/core/http/openapi-types.d.ts` — clinozy-be's API as TypeScript types — from the
 * OpenAPI document clinozy-be builds from its routes (`pnpm docs:generate` there writes
 * `docs/openapi/openapi.json`, gitignored; a running backend also serves it at
 * `/reference/openapi.json`). The types are the wire truth: `src/core/http/api.ts` checks every
 * path, path parameter, query and body against them, and each room's Zod wire schema is checked
 * against the response types (`wireSchema`).
 *
 * The document is 7.7 MB because every description, example and error body is inlined; types
 * need none of that. Before generating, the document is reduced — the output keeps every path,
 * parameter, body and response shape:
 *
 *   - `description`, `example` and `examples` are dropped (prose, not types);
 *   - the error responses, identical across all operations, become one shared
 *     `components.responses.ApiError`.
 *
 * Then two corrections, each one of the mismatches reported to clinozy-be
 * (iterations/launch-2026-09-30-jxmr/plans/api-integration.md §9) and removable once the
 * document is fixed:
 *
 *   - M5 — the error body gains `reason`: the server sends it on a 409 (and on several 400s,
 *     403s and 422s) and the document leaves it out;
 *   - M6 — a query parameter with a `default` is optional: the document marks `limit` and the
 *     `include_*` flags required while the server applies their defaults.
 *
 * The answers the document leaves untyped (M3: slots, daily counts, messaging status, offering
 * ideas) stay untyped here; their rooms' wire schemas carry the live shape.
 *
 *   pnpm api:types          write the module
 *   pnpm api:types:check    exit 1 when the module drifted from the document
 *
 * Source: `--source <file>` or `$CLINOZY_BE_DIR/docs/openapi/openapi.json` (default
 * `../clinozy-be`). Like `contracts:drift`, the check needs the sibling checkout: without the
 * document it prints a notice and exits 0 (CI runners have no clinozy-be).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const API_TYPES_TARGET = 'src/core/http/openapi-types.d.ts';

const PROSE_KEYS = new Set(['description', 'example', 'examples']);
const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

/** The document's path, from `--source` or the sibling clinozy-be checkout. */
export function resolveSource(argv, env) {
  const flag = argv.indexOf('--source');
  if (flag !== -1 && argv[flag + 1]) return resolve(argv[flag + 1]);
  const backendDir = env.CLINOZY_BE_DIR ?? resolve(ROOT, '../clinozy-be');
  return join(backendDir, 'docs/openapi/openapi.json');
}

/** A deep copy of `node` without its prose keys. */
export function stripProse(node) {
  if (Array.isArray(node)) return node.map(stripProse);
  if (node === null || typeof node !== 'object') return node;
  const copy = {};
  for (const [key, value] of Object.entries(node)) {
    if (!PROSE_KEYS.has(key)) copy[key] = stripProse(value);
  }
  return copy;
}

function* operationsOf(document) {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) yield pathItem[method];
    }
  }
}

/**
 * Points every error response (status ≥ 400) at one shared `components.responses.ApiError`
 * when they all carry the same body — they do — and adds the body's `reason` (M5). Returns
 * false, leaving the document as it was, when the bodies differ.
 */
export function shareErrorResponses(document) {
  let shared;
  for (const operation of operationsOf(document)) {
    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      if (Number(status) < 400) continue;
      const body = JSON.stringify(response.content?.['application/json']?.schema ?? null);
      if (shared === undefined) shared = body;
      else if (shared !== body) return false;
    }
  }
  if (shared === undefined || shared === 'null') return false;
  const errorBody = JSON.parse(shared);
  const errorObject = errorBody.properties?.error;
  if (errorObject?.properties && !errorObject.properties.reason) {
    errorObject.properties = { ...errorObject.properties, reason: { type: 'string' } };
  }
  for (const operation of operationsOf(document)) {
    for (const status of Object.keys(operation.responses ?? {})) {
      if (Number(status) >= 400) {
        operation.responses[status] = { $ref: '#/components/responses/ApiError' };
      }
    }
  }
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ApiErrorBody: errorBody },
    responses: {
      ...document.components?.responses,
      ApiError: {
        description: 'The error envelope',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiErrorBody' } },
        },
      },
    },
  };
  return true;
}

/** M6: a query parameter the server defaults is not required of the caller. */
export function relaxDefaultedQueryParameters(document) {
  for (const operation of operationsOf(document)) {
    for (const parameter of operation.parameters ?? []) {
      if (
        parameter.in === 'query' &&
        parameter.required &&
        parameter.schema?.default !== undefined
      ) {
        parameter.required = false;
      }
    }
  }
}

/** The reduced, corrected document the types are generated from. */
export function prepareDocument(raw) {
  const document = stripProse(raw);
  shareErrorResponses(document);
  relaxDefaultedQueryParameters(document);
  return document;
}

const ROOT_DOCS = {
  paths:
    "Every route, keyed by its full path (`/api/v1/...`), with each method's operation.",
  components: 'The shared shapes: the error envelope and its response.',
  operations:
    "Every operation's parameters, request body and responses, by operation id.",
};

/** The module's text: a header, the generated types, TSDoc on each root export. */
export function renderModule(generated, document) {
  const body = generated
    .replace(/^\/\*\*\n \* This file was auto-generated[\s\S]*?\*\/\n\n/, '')
    .replace(/^export type (webhooks|\$defs) = Record<string, never>;\n/gm, '')
    .replace(
      /^export interface (paths|components|operations) \{/gm,
      (line, name) => `/** ${ROOT_DOCS[name]} */\n${line}`,
    );
  const version = document.info?.version ?? 'unknown';
  return `/**
 * clinozy-be's API (OpenAPI ${version}) as TypeScript types — generated, never edited.
 *
 * Written by \`pnpm api:types\` (tooling/codegen/api-types.mjs) from clinozy-be's OpenAPI
 * document; \`pnpm api:types:check\` fails when it drifts. Read through \`src/core/http/api.ts\`.
 */
${body}`;
}

/** Generates the module's text from the document at `source`. */
export async function generate(source) {
  const raw = JSON.parse(readFileSync(source, 'utf8'));
  const document = prepareDocument(raw);
  const ast = await openapiTS(document, { alphabetize: true });
  return renderModule(astToString(ast), document);
}

async function main() {
  const check = process.argv.includes('--check');
  const source = resolveSource(process.argv, process.env);
  if (!existsSync(source)) {
    const message = `api:types — no OpenAPI document at ${source} (run \`pnpm docs:generate\` in clinozy-be, or pass --source).`;
    if (check) {
      console.log(`${message} Skipping.`);
      return;
    }
    console.error(message);
    process.exit(1);
  }
  const text = await generate(source);
  const target = join(ROOT, API_TYPES_TARGET);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== text) {
      console.error(
        `api:types:check — ${API_TYPES_TARGET} is stale. Run \`pnpm api:types\`.`,
      );
      process.exit(1);
    }
    console.log(`api:types:check OK — ${API_TYPES_TARGET} matches ${source}.`);
    return;
  }
  writeFileSync(target, text);
  console.log(`api:types — wrote ${API_TYPES_TARGET} from ${source}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
