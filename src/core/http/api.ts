import { API_BASE_PATH } from '@/core/config/constants.ts';
import {
  apiClient,
  type HttpResponse,
  type RequestOptions,
} from '@/core/http/fetch-client.ts';
import type { paths } from '@/core/http/openapi-types.d.ts';

type Prefix = typeof API_BASE_PATH;
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** A route's path as the API spells it, without `/api/v1`: `/app/leads/{lead_id}`. */
type ApiPath = keyof paths extends infer FullPath
  ? FullPath extends `${Prefix}${infer Path}`
    ? Path
    : never
  : never;

type Operation<P extends ApiPath, M extends HttpMethod> = NonNullable<
  paths[`${Prefix}${P}`][M]
>;

/** The paths that answer method `M`. */
export type ApiPathFor<M extends HttpMethod> = {
  [P in ApiPath]: [Operation<P, M>] extends [never] ? never : P;
}[ApiPath];

type ParametersOf<O> = O extends { parameters: infer Parameters } ? Parameters : never;
type PathParametersOf<O> = ParametersOf<O> extends { path: infer Path } ? Path : never;
type QueryOf<O> = ParametersOf<O> extends { query?: infer Query } ? Query : never;
type BodyOf<O> = O extends {
  requestBody?: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;
type SuccessOf<O> = O extends {
  responses: { 200: { content: { 'application/json': infer Success } } };
}
  ? Success
  : never;

/** The `data` of an operation's 200 answer, as the API types it. */
export type ApiData<P extends ApiPath, M extends HttpMethod> =
  SuccessOf<Operation<P, M>> extends { data?: infer Data } ? Data : undefined;

type RequiredWhenPresent<Key extends string, Value> = [Value] extends [never]
  ? { [K in Key]?: never }
  : [Value] extends [undefined]
    ? { [K in Key]?: never }
    : object extends Value
      ? { [K in Key]?: Value }
      : { [K in Key]: Value };

type BodyOption<O> = O extends { requestBody: unknown }
  ? { body: BodyOf<O> }
  : [BodyOf<O>] extends [never]
    ? { body?: never }
    : { body?: BodyOf<O> };

/** What a call takes besides its path: path parameters, query, body and the per-action key. */
export type ApiInit<P extends ApiPath, M extends HttpMethod> = RequiredWhenPresent<
  'params',
  PathParametersOf<Operation<P, M>>
> &
  RequiredWhenPresent<'query', QueryOf<Operation<P, M>>> &
  BodyOption<Operation<P, M>> &
  Pick<RequestOptions, 'idempotencyKey'>;

/** The init is optional when nothing in it is required (a list with no required filter). */
type InitArguments<Init> = Partial<Init> extends Init ? [init?: Init] : [init: Init];

/**
 * A delete also takes the record's delete `reason` and an optional `note`. The routes require
 * them (`?reason=&note=`) though the OpenAPI document omits them (api-integration §9 M4).
 */
export type ApiDeleteInit<P extends ApiPath> = ApiInit<P, 'delete'> & {
  reason?: string;
  note?: string;
};

type QueryValue =
  string | number | boolean | readonly (string | number)[] | null | undefined;

/**
 * The request path: `/api/v1`, the path with each `{name}` filled from `params` (encoded), then
 * the query — empty values dropped, lists comma-joined (how the API takes several values).
 *
 * @throws Error when a `{name}` in the path has no value in `params`.
 */
export function buildApiPath(
  path: string,
  params?: Readonly<Record<string, string | number>>,
  query?: Readonly<Record<string, QueryValue>>,
): string {
  const filled = path.replaceAll(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === '') {
      throw new Error(`api: no value for path parameter "${name}" in ${path}`);
    }
    return encodeURIComponent(String(value));
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const queryString = search.toString();
  const suffix = queryString ? `?${queryString}` : '';
  return `${API_BASE_PATH}${filled}${suffix}`;
}

interface LooseInit {
  params?: Readonly<Record<string, string | number>>;
  query?: Readonly<Record<string, QueryValue>>;
  body?: unknown;
  idempotencyKey?: string;
  reason?: string;
  note?: string;
}

const optionsOf = (init: LooseInit): RequestOptions | undefined =>
  init.idempotencyKey ? { idempotencyKey: init.idempotencyKey } : undefined;

/**
 * clinozy-be's API, typed from its OpenAPI document (`openapi-types.d.ts`). Each method takes a
 * path as the API spells it (`'/app/leads/{lead_id}'`) and checks its path parameters, query and
 * body against the document; the answer's `data` is typed as the document types it.
 *
 * @remarks
 * The answer is not validated here: a room parses it with its Zod wire schema (`wireSchema`),
 * which is itself checked against these types. Requests go through {@link apiClient}, so the
 * envelope, the bearer token, the 401 refresh and the idempotency key behave as everywhere else.
 */
export const api = {
  get<P extends ApiPathFor<'get'>>(
    path: P,
    ...[init]: InitArguments<ApiInit<P, 'get'>>
  ): Promise<HttpResponse<ApiData<P, 'get'>>> {
    const loose = (init as LooseInit | undefined) ?? {};
    return apiClient.get(buildApiPath(path, loose.params, loose.query));
  },
  post<P extends ApiPathFor<'post'>>(
    path: P,
    ...[init]: InitArguments<ApiInit<P, 'post'>>
  ): Promise<HttpResponse<ApiData<P, 'post'>>> {
    const loose = (init as LooseInit | undefined) ?? {};
    return apiClient.post(
      buildApiPath(path, loose.params, loose.query),
      loose.body,
      optionsOf(loose),
    );
  },
  put<P extends ApiPathFor<'put'>>(
    path: P,
    init: ApiInit<P, 'put'>,
  ): Promise<HttpResponse<ApiData<P, 'put'>>> {
    const loose = init as LooseInit;
    return apiClient.put(
      buildApiPath(path, loose.params, loose.query),
      loose.body,
      optionsOf(loose),
    );
  },
  patch<P extends ApiPathFor<'patch'>>(
    path: P,
    init: ApiInit<P, 'patch'>,
  ): Promise<HttpResponse<ApiData<P, 'patch'>>> {
    const loose = init as LooseInit;
    return apiClient.patch(
      buildApiPath(path, loose.params, loose.query),
      loose.body,
      optionsOf(loose),
    );
  },
  delete<P extends ApiPathFor<'delete'>>(
    path: P,
    init: ApiDeleteInit<P>,
  ): Promise<HttpResponse<undefined>> {
    const loose = init as LooseInit;
    const query = { ...loose.query, reason: loose.reason, note: loose.note };
    return apiClient.delete(buildApiPath(path, loose.params, query), optionsOf(loose));
  },
};
