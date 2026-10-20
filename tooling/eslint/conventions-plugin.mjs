/**
 * Local ESLint rules for conventions CLAUDE.md states that no installed plugin checks. The
 * planted-bug drill (20 Oct 2026) reached a PR with each of them broken:
 *
 * - `no-sibling-island-import` (A1-9): a page imports another page island by a relative path
 *   (`../mfa/mfa.constants.ts` from the login page). `@/pages/**` was already banned; the
 *   relative form was not. An island is the nearest folder holding a `*.route.tsx`; a parent
 *   island may import its own child islands (a layout registers its sections) and a child its
 *   parent, but never a sideways island.
 * - `import-extension` (A1-8): a relative or `@/` import without its extension (`@/lib/utils`).
 * - `no-static-inline-style` (A1-11): `style={{ minWidth: 24 }}` with only constant values,
 *   which a Tailwind class says. A style computed at runtime (a calendar block's top, a photo's
 *   zoom) stays allowed: no class can carry it.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';

/** The nearest folder at or above `directory`, inside `src/pages`, that holds a route file. */
function islandOf(directory, pagesRoot) {
  for (
    let current = directory;
    current.startsWith(pagesRoot);
    current = dirname(current)
  ) {
    if (
      existsSync(current) &&
      readdirSync(current).some((name) => name.endsWith('.route.tsx'))
    )
      return current;
    if (current === pagesRoot) break;
  }
  return null;
}

/** Whether `inner` is `outer` or a folder below it. */
function contains(outer, inner) {
  return inner === outer || inner.startsWith(outer + sep);
}

/** The import sources of a file: static imports, re-exports and dynamic imports. */
function importVisitors(check) {
  return {
    ImportDeclaration: (node) => check(node.source),
    ExportNamedDeclaration: (node) => node.source && check(node.source),
    ExportAllDeclaration: (node) => check(node.source),
    ImportExpression: (node) => node.source.type === 'Literal' && check(node.source),
  };
}

const noSiblingIslandImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Pages never import a sideways page island by a relative path.',
    },
    schema: [],
    messages: {
      sideways:
        "'{{source}}' is another page island ({{target}}). Pages never import other pages — share the code via src/shared.",
    },
  },
  create(context) {
    const filename = context.filename;
    const pagesRoot = resolve(context.cwd, 'src/pages');
    if (!contains(pagesRoot, filename)) return {};
    const own = islandOf(dirname(filename), pagesRoot);
    if (!own) return {};
    return importVisitors((source) => {
      const value = String(source.value);
      if (!value.startsWith('.')) return;
      const target = islandOf(
        dirname(normalize(join(dirname(filename), value))),
        pagesRoot,
      );
      if (!target || contains(own, target) || contains(target, own)) return;
      context.report({
        node: source,
        messageId: 'sideways',
        data: { source: value, target: target.slice(pagesRoot.length + 1) },
      });
    });
  },
};

const importExtension = {
  meta: {
    type: 'problem',
    docs: { description: 'Relative and @/ imports name their file extension.' },
    schema: [],
    messages: {
      missing:
        "'{{source}}' has no extension. Always write the .ts/.tsx (CLAUDE.md → Import Conventions).",
    },
  },
  create(context) {
    return importVisitors((source) => {
      const value = String(source.value);
      if (!/^(\.\.?\/|@\/)/.test(value)) return;
      const last = value.split('?')[0].split('/').pop() ?? '';
      if (/\.[a-z0-9]+$/i.test(last)) return;
      context.report({ node: source, messageId: 'missing', data: { source: value } });
    });
  },
};

/** Whether `node` is a constant: a literal, a negated literal or a template with no `${}`. */
function isConstant(node) {
  if (node.type === 'Literal') return true;
  if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
  if (node.type === 'UnaryExpression')
    return node.operator === '-' && node.argument.type === 'Literal';
  return false;
}

const noStaticInlineStyle = {
  meta: {
    type: 'problem',
    docs: {
      description: 'An inline style with only constant values is a Tailwind class.',
    },
    schema: [],
    messages: {
      constant:
        'This style has only constant values — use Tailwind utility classes (CLAUDE.md → Styling: never inline styles).',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return;
        const expression =
          node.value?.type === 'JSXExpressionContainer' ? node.value.expression : null;
        if (expression?.type !== 'ObjectExpression' || expression.properties.length === 0)
          return;
        const allConstant = expression.properties.every(
          (property) =>
            property.type === 'Property' &&
            !property.computed &&
            isConstant(property.value),
        );
        if (allConstant) context.report({ node, messageId: 'constant' });
      },
    };
  },
};

export default {
  meta: { name: 'conventions' },
  rules: {
    'no-sibling-island-import': noSiblingIslandImport,
    'import-extension': importExtension,
    'no-static-inline-style': noStaticInlineStyle,
  },
};
