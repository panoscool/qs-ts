# qs-ts Copilot Instructions

## Project Overview
This is a TypeScript library for parsing and stringifying URL query strings, similar to the popular 'qs' library. It provides robust handling of arrays, type inference, and encoding options.

## Architecture
- **Entry point**: `src/index.ts` re-exports from `parse.ts`, `stringify.ts`, `core.ts`, and types from `types.ts`
- **Core modules**:
  - `parse.ts`: Handles query string parsing with type inference and array formats
  - `stringify.ts`: Serializes objects to query strings with configurable array handling
  - `core.ts`: Utility functions for encoding/decoding and string manipulation
  - `types.ts`: TypeScript interfaces for options and formats

## Key Patterns
- **Array formats**: Support `repeat` (key=a&key=b) and `comma` (key=a,b) with configurable encoding
- **Type inference**: Automatically converts "true"/"false" to booleans, numeric strings to numbers, "null" to null
- **Null handling**: `null` values become keys without equals (e.g., `key` instead of `key=`)
- **Encoding**: Uses strict URI encoding that handles special characters like `!'()*`

## Development Workflow
- **Build**: Run `bun run build` (uses `build.ts` to generate ESM/CJS + TypeScript declarations in `dist/`)
- **Test**: Run `bun test` (uses Bun's test runner on `tests/*.spec.ts`)
- **Verify**: Run `node verify.mjs` for comprehensive testing including tarball installation
- **Release**: Run `bash release.sh <patch|minor|major>` (note: script assumes 'develop' branch, but repo uses 'main')

## Code Style
- **Formatting**: Tabs for indentation, double quotes, organized imports (Biome)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
- **Linting**: Biome with recommended rules enabled

## Examples
- Parse with type inference: `parse("a=1&b=true&c=null")` → `{a: 1, b: true, c: null}`
- Stringify arrays (repeat): `stringify({tags: ['a', 'b']}, {array: {format: 'repeat'}})` → `tags=a&tags=b`
- Stringify arrays (comma): `stringify({tags: ['a', 'b']}, {array: {format: 'comma', encoded: 'preserve'}})` → `tags=a,b`
- Skip nulls: `stringify({a: 1, b: null}, {skipNull: true})` → `a=1`</content>