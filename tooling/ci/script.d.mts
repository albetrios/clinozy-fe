/**
 * Types for `script.mjs`. The module is plain JS (the tooling runs under bare `node`), so its
 * contract is declared here for the TypeScript consumers — the `.ts` tooling scripts and tests.
 */

/** One option a script takes, in node:util `parseArgs` terms. */
export interface CommandLineOption {
  type: 'boolean' | 'string';
  short?: string;
  multiple?: boolean;
}

type OptionValue<Option extends CommandLineOption> = Option['type'] extends 'boolean'
  ? boolean
  : Option['multiple'] extends true
    ? string[]
    : string;

/** A script's own wording for an unknown option or a missing value; `undefined` keeps the default. */
export interface CommandLineMessages {
  unknownOption?: (option: string) => string | undefined;
  needsValue?: (option: string) => string | undefined;
}

/** True when the module at `importMetaUrl` is the script node was started with. */
export declare function isMain(importMetaUrl: string): boolean;

/** Reads a command line with node:util `parseArgs`, strictly; throws an Error naming what is wrong. */
export declare function parseCommandLine<
  Options extends Record<string, CommandLineOption> = Record<never, CommandLineOption>,
>(
  args: readonly string[],
  shape?: {
    options?: Options;
    maxPositionals?: number;
    usage?: string;
    messages?: CommandLineMessages;
  },
): {
  values: { [Name in keyof Options]?: OptionValue<Options[Name]> };
  positionals: string[];
};
