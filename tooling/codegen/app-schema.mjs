#!/usr/bin/env node
/**
 * Generates `src/shared/api/app/app-schema.ts` — the clinic data contract
 * as Zod — from the launch's `schema-routes.md` (KICKOFF D22: the data and URL
 * contract, byte-identical in clinozy-be). Entities validate SHAPE: types,
 * nullability, enums, uuid / ISO datetime / civil date / clock time / E.164
 * formats and integer money in paise. Lengths, ranges and cross-field rules are
 * UX and live in each form's input schema.
 *
 *   pnpm app:schema          write the module
 *   pnpm app:schema:check    exit 1 when the module drifted from the markdown
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isMain, parseCommandLine } from '../ci/script.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const SCHEMA_SOURCE =
  'iterations/launch-2026-09-30-jxmr/intake-files/schema-routes.md';
export const SCHEMA_TARGET = 'src/shared/api/app/app-schema.ts';

/**
 * Values later iterations add to a contract enum, appended after the launch's. The launch's
 * `schema-routes.md` is frozen (never edited); a value clinozy-be has since accepted is listed
 * here with the iteration that added it, so the generated module stays the wire truth.
 */
export const ENUM_AMENDMENTS = {
  // change-branches-in-navbar-2026-10-14-zrml: Branches is its own section, after Users.
  section: ['branches'],
  // Leads follow their bookings (clinozy-be L11): a booked lead waits on its visit.
  lead_status: ['appointment_scheduled'],
};

/** Embedded shapes the markdown spells inline in a Constraints cell. */
const INLINE_EMBEDDED = {
  SuggestionInvoiceLink: `z.object({
  invoiceId: z.uuid(),
  invoiceLineIndex: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
})`,
  PaymentSplit: `z.object({
  mode: paymentModeSchema,
  amount: paiseSchema,
})`,
  BillRef: `z.object({
  kind: billKindSchema,
  purchaseId: z.uuid(),
  billNo: z.string(),
})`,
  MedicineBatch: `z.object({
  batchNo: z.string(),
  expiry: expiryMonthSchema,
  qty: z.number().int().nonnegative(),
  purchaseRate: paiseSchema,
})`,
  SupplierRate: `z.object({
  supplierId: z.uuid(),
  rate: paiseSchema,
  free: z.number().int().nonnegative(),
  leadDays: z.number().int().nonnegative(),
})`,
  PurchaseItem: `z.object({
  medicineId: z.uuid(),
  qty: z.number().int().positive(),
  free: z.number().int().nonnegative(),
  rate: paiseSchema,
  batchNo: z.string().nullable(),
  expiry: expiryMonthSchema.nullable(),
  received: z.boolean(),
})`,
  SaleReturn: `z.object({
  items: z.array(
    z.object({ medicineId: z.uuid(), batchNo: z.string(), qty: z.number().int().positive() }),
  ),
  amount: paiseSchema,
  reason: z.string(),
  at: isoDateTimeSchema,
})`,
  StockPurchaseLine: `z.object({
  itemId: z.uuid(),
  qtyMilli: z.number().int().positive(),
  rate: paiseSchema,
})`,
  StockCountLine: `z.object({
  itemId: z.uuid(),
  systemMilli: z.number().int().nonnegative(),
  countedMilli: z.number().int().nonnegative(),
})`,
};

/** Fields whose markdown type is a bare `object`. */
const OBJECT_FIELDS = {
  'Treatment.params': 'z.record(z.string(), z.string())',
  'Payment.billRef': 'billRefSchema',
};

const camel = (snake) => snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const pascal = (snake) => camel(snake).replace(/^./, (c) => c.toUpperCase());
const lowerFirst = (name) =>
  /^[A-Z]{2,}[a-z]/.test(name)
    ? name.replace(/^[A-Z]+(?=[A-Z][a-z])/, (m) => m.toLowerCase())
    : name.replace(/^./, (c) => c.toLowerCase());
const schemaName = (entity) => `${lowerFirst(entity)}Schema`;

function cells(line) {
  return line
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));
}

/** Parse every `## Enum:` and `## Entity:` table. */
export function parseSchemaMarkdown(markdown) {
  const lines = markdown.split('\n');
  const enums = [];
  const entities = [];
  let current = null;
  for (const line of lines) {
    const enumHead = /^## Enum: ([a-z_]+)\s*$/.exec(line);
    const entityHead = /^## Entity: ([A-Za-z_]+)( \(embedded in [^)]+\))?\s*$/.exec(line);
    if (enumHead) {
      current = { kind: 'enum', name: enumHead[1], values: [] };
      enums.push(current);
      continue;
    }
    if (entityHead) {
      current = {
        kind: 'entity',
        name: entityHead[1],
        embedded: Boolean(entityHead[2]),
        description: '',
        fields: [],
      };
      entities.push(current);
      continue;
    }
    if (/^#{1,2} /.test(line)) {
      current = null;
      continue;
    }
    if (current?.kind === 'entity' && !current.description && /^[A-Z]/.test(line)) {
      current.description = line.trim();
      continue;
    }
    const tableRow = line.startsWith('| ') && !/^\| -/.test(line);
    if (!(current && tableRow)) continue;
    const row = cells(line);
    if (current.kind === 'enum') {
      if (row[0] === 'Machine value') continue;
      current.values.push(row[0]);
    } else {
      if (row[0] === 'Field' || row.length < 8) continue;
      const [field, type, , nullable, , constraints, serverSet] = row;
      // `n/a` rows are prototype behaviour, not fields; write-only fields (a
      // password) are never in a response, so the read shape leaves them out.
      if (type === 'n/a' || /write-only/.test(constraints)) continue;
      current.fields.push({
        field,
        type,
        nullable: nullable === 'yes',
        constraints,
        serverSet,
      });
    }
  }
  return { enums, entities };
}

/** An enum whose PascalCase name an entity already uses gets a \`Kind\` suffix. */
let entityNames = new Set();
const enumIdent = (snake) =>
  entityNames.has(pascal(snake)) ? `${pascal(snake)}Kind` : pascal(snake);
const enumSchema = (snake) => `${lowerFirst(enumIdent(snake))}Schema`;

function zodForType(entity, { field, type, constraints }) {
  const base = type.replace(/\s*\|\s*null$/, '');
  const nullable = /\|\s*null$/.test(type);
  let zod;
  const array = /^array<(.+)> \(max (\d+)\)$/.exec(base);
  if (array) {
    zod = `z.array(${zodForType(entity, { field, type: array[1], constraints: '' })})`;
  } else if (base === 'string (uuid)') zod = 'z.uuid()';
  else if (base === 'string (email)') zod = 'z.email()';
  else if (base === 'string (ISO 8601 UTC datetime)') zod = 'isoDateTimeSchema';
  else if (base === 'boolean') zod = 'z.boolean()';
  else if (base === 'number (int)') zod = 'z.number().int()';
  else if (base === 'number (int, ≥0)')
    zod = /paise/.test(constraints) ? 'paiseSchema' : 'z.number().int().nonnegative()';
  else if (base === 'string') {
    if (/YYYY-MM-DD/.test(constraints)) zod = 'civilDateSchema';
    else if (/HH:mm/.test(constraints)) zod = 'clockTimeSchema';
    else if (/E\.164/.test(constraints)) zod = 'phoneSchema';
    else if (/`MM\/YY`/.test(constraints)) zod = 'expiryMonthSchema';
    else zod = 'z.string()';
  } else if (base.startsWith('enum: ')) zod = enumSchema(base.slice(6));
  else if (base === 'object') {
    zod = OBJECT_FIELDS[`${entity}.${field}`];
    if (!zod) throw new Error(`${entity}.${field}: unmapped object type`);
  } else if (INLINE_EMBEDDED[base] || /^[A-Z]/.test(base)) zod = schemaName(base);
  else throw new Error(`${entity}.${field}: unknown type "${type}"`);
  return nullable ? `${zod}.nullable()` : zod;
}

/** The generated module, Prettier-formatted — what the file on disk must equal. */
export async function generateAppSchemaFile(markdown) {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(join(ROOT, SCHEMA_TARGET))) ?? {};
  return prettier.format(generateAppSchema(markdown), {
    ...options,
    filepath: join(ROOT, SCHEMA_TARGET),
  });
}

/** The generated module source, from the markdown. Pure — the drift test calls it too. */
export function generateAppSchema(markdown) {
  const { enums, entities } = parseSchemaMarkdown(markdown);
  for (const { name, values } of enums) values.push(...(ENUM_AMENDMENTS[name] ?? []));
  entityNames = new Set(entities.map((entity) => entity.name));
  const out = [];
  out.push(`/**
 * The clinic data contract — GENERATED by \`pnpm app:schema\` from
 * \`${SCHEMA_SOURCE}\` (KICKOFF D22), plus the enum values later
 * iterations added (\`ENUM_AMENDMENTS\` in the generator). Do not edit by hand;
 * \`app-schema.drift.test.ts\` fails when this file and the markdown disagree.
 *
 * Entities validate shape (types, nullability, enums, id / date / phone formats,
 * money as integer paise). Lengths, ranges and cross-field rules are form rules.
 */
import { z } from 'zod';

/** Money: integer paise (₹1 = 100), never a float. */
export const paiseSchema = z.number().int().nonnegative();
/** ISO 8601 UTC timestamp. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
/** Clinic-local calendar date, \`YYYY-MM-DD\`. */
export const civilDateSchema = z.iso.date();
/** Clinic-local clock time, \`HH:mm\` (24h). */
export const clockTimeSchema = z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/);
/** An Indian mobile in E.164. */
export const phoneSchema = z.string().regex(/^\\+91[6-9]\\d{9}$/);
/** A batch expiry month, \`MM/YY\`. */
export const expiryMonthSchema = z.string().regex(/^(0[1-9]|1[0-2])\\/\\d{2}$/);
`);
  out.push('// ── Enums ──');
  for (const { name, values } of enums) {
    const constName = `${name.toUpperCase()}_VALUES`;
    out.push(`/** Machine values of the contract's \`${name}\` enum. */`);
    out.push(
      `export const ${constName} = [${values.map((v) => `'${v}'`).join(', ')}] as const;`,
    );
    out.push(`/** Zod enum of \`${name}\`. */`);
    out.push(`export const ${enumSchema(name)} = z.enum(${constName});`);
    out.push(`/** One \`${name}\` value. */`);
    out.push(`export type ${enumIdent(name)} = z.infer<typeof ${enumSchema(name)}>;`);
  }
  out.push('\n// ── Embedded shapes ──');
  for (const [name, body] of Object.entries(INLINE_EMBEDDED)) {
    out.push(
      `/** Embedded \`${name}\` shape (spelled inline in its parent's constraints). */`,
    );
    out.push(`export const ${schemaName(name)} = ${body};`);
    out.push(`/** One \`${name}\`. */`);
    out.push(`export type ${name} = z.infer<typeof ${schemaName(name)}>;`);
  }
  const common = entities.find((entity) => entity.name === '_Common');
  const body = (entity) =>
    entity.fields
      .map((field) => `  ${field.field}: ${zodForType(entity.name, field)},`)
      .join('\n');
  out.push(`\n// ── Entities ──\n/** Audit + soft-delete fields every entity carries (\`_Common\`). */
export const appCommonSchema = z.object({\n${body(common)}\n});
/** The audit + soft-delete fields of a record. */
export type AppCommon = z.infer<typeof appCommonSchema>;`);
  const ordered = [
    ...entities.filter((entity) => entity.embedded),
    ...entities.filter((entity) => !entity.embedded && entity.name !== '_Common'),
  ];
  for (const entity of ordered) {
    const base =
      entity.embedded || entity.name === 'Organization'
        ? 'z.object'
        : 'appCommonSchema.extend';
    const summary = (entity.description || `The \`${entity.name}\` entity.`).replaceAll(
      '*/',
      '* /',
    );
    out.push(`/** ${entity.name}: ${summary} */`);
    out.push(`export const ${schemaName(entity.name)} = ${base}({\n${body(entity)}\n});`);
    out.push(`/** A \`${entity.name}\` record. */`);
    out.push(`export type ${entity.name} = z.infer<typeof ${schemaName(entity.name)}>;`);
    const serverSet = entity.fields
      .filter((field) => field.serverSet === 'yes')
      .map((field) => `'${field.field}'`);
    if (!entity.embedded && serverSet.length > 0) {
      out.push(
        `/** Fields the server sets on ${entity.name} — omitted from create / update inputs. */`,
      );
      out.push(
        `export const ${lowerFirst(entity.name)}ServerSet = [${serverSet.join(', ')}] as const;`,
      );
    }
  }
  return `${out.join('\n')}\n`;
}

async function main() {
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { check: { type: 'boolean' } },
  });
  const markdown = readFileSync(join(ROOT, SCHEMA_SOURCE), 'utf8');
  const generated = await generateAppSchemaFile(markdown);
  const target = join(ROOT, SCHEMA_TARGET);
  if (values.check === true) {
    const current = readFileSync(target, 'utf8');
    if (current !== generated) {
      console.error(
        `${SCHEMA_TARGET} drifted from ${SCHEMA_SOURCE} — run pnpm app:schema`,
      );
      process.exit(1);
    }
    console.log(`${SCHEMA_TARGET} matches ${SCHEMA_SOURCE}`);
    return;
  }
  writeFileSync(target, generated);
  console.log(`wrote ${SCHEMA_TARGET}`);
}

if (isMain(import.meta.url)) await main();
