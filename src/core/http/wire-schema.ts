import type { z } from 'zod';

type Scalar = string | number | boolean | bigint | symbol;
type Present<T> = Exclude<T, null | undefined>;

/**
 * The keys a wire shape `Wire` has and the API's type `Api` does not, at any depth (`contact.name`,
 * `items.batch_number`); `never` when every key exists in the API's type.
 */
type ExtraWireKeys<Wire, Api> =
  Present<Wire> extends readonly (infer WireItem)[]
    ? Present<Api> extends readonly (infer ApiItem)[]
      ? ExtraWireKeys<WireItem, ApiItem>
      : never
    : Present<Wire> extends Scalar
      ? never
      : Present<Api> extends object
        ? string extends keyof Present<Api>
          ? never
          : | Exclude<keyof Present<Wire>, keyof Present<Api>>
            | {
                [Key in keyof Present<Wire> & keyof Present<Api>]: [
                  ExtraWireKeys<Present<Wire>[Key], Present<Api>[Key]>,
                ] extends [never]
                  ? never
                  : `${Key & string}.${ExtraWireKeys<Present<Wire>[Key], Present<Api>[Key]> & string}`;
              }[keyof Present<Wire> & keyof Present<Api>]
        : never;

/** `unknown` when `Wire` fits `Api` — its values assignable, no key the API lacks — else a message. */
export type WireFit<Wire, Api> = [Wire] extends [Api]
  ? [ExtraWireKeys<Wire, Api>] extends [never]
    ? unknown
    : { 'keys the API does not have': ExtraWireKeys<Wire, Api> }
  : { 'values that do not fit the API type': Api };

/**
 * Declares a room's Zod wire schema for an API shape and checks it at compile time against the
 * shape generated from the OpenAPI document (`ApiData<…>` from `src/core/http/api.ts`): every key
 * must exist in the API's type and every value must fit it — so a renamed field, a stale enum value
 * or a wrong type fails `pnpm type-check`.
 *
 * @remarks
 * The OpenAPI document marks no response field required (api-integration §9 M2), so the generated
 * types make every field optional; the wire schema is where presence is declared, and the runtime
 * parse is what enforces it. Usage:
 *
 * ```ts
 * type ApiLead = NonNullable<ApiData<'/app/leads/{lead_id}', 'get'>>;
 * const leadWire = wireSchema<ApiLead>()(z.object({ id: z.string(), lead_number: z.number() }));
 * ```
 */
export function wireSchema<Api>() {
  return <Schema extends z.ZodType>(
    schema: Schema & WireFit<z.output<Schema>, Api>,
  ): Schema => schema;
}
