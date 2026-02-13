# qs-ts

A TypeScript library for parsing and stringifying URL query strings, inspired by the popular 'query-string' library. It provides robust handling of arrays, type inference, and encoding options.

## Features

- **Type Inference**: Flexible options to parse numbers (`parseNumber`) and booleans (`parseBoolean`)
- **Array Formats**: Support for `repeat` (key=a&key=b) and `comma` (key=a,b), plus configurable comma parsing
- **Flexible Options**: Configurable encoding/decoding, null handling, array formatting
- **TypeScript Support**: Full type definitions included
- **Safe Parsing**: Handles malformed encodings gracefully
- **Dual Package**: ESM and CommonJS support

## Installation

```bash
npm install qs-ts
# or
bun add qs-ts
```

> 
> 💡 Consider using the native browser API `URLSearchParams` for simple use cases.

## Usage

### Basic Parsing

```typescript
import { parse } from 'qs-ts';

const result = parse('a=1&b=hello&c=true');
console.log(result);
// { a: '1', b: 'hello', c: 'true' } -> by default everything is a string
```

### Basic Stringifying

```typescript
import { stringify } from 'qs-ts';

const query = stringify({ a: 1, b: 'hello', c: true });
console.log(query);
// 'a=1&b=hello&c=true'
```

### CommonJS

```javascript
const { parse, stringify } = require('qs-ts');
```

## API

### parse(query: string, options?: ParseOptions): Record<string, any>

Parses a query string into an object.

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `decode` | `boolean` | `true` | Decode percent-encoded characters. |
| `parseNumber` | `boolean` | `false` | Parse numeric-looking values with `Number(...)`; does not parse `Infinity`, `NaN`, or empty strings. |
| `parseBoolean` | `boolean` | `false` | Parse only lowercase `"true"` / `"false"` to booleans. |
| `array` | `ParseArrayFormat` | `{ format: "repeat" }` | How arrays are represented in the query string. |
| `types` | `Record<string, ValueType>` | `undefined` | Explicit per-key typing; takes priority over global parse flags. |
| `onTypeError` | `ValueTypeError` | `"keep"` | Behavior when explicit `types` casting fails. |

&nbsp;

`onTypeError` behavior with explicit `types`:

| Mode | Invalid Scalar (`number`, `boolean`) | Invalid Array Item (`number[]`, `string[]`) |
| --- | --- | --- |
| `"keep"` | Keep original value | Keep original item |
| `"throw"` | Throw `TypeError` | Throw `TypeError` |
| `"drop"` | Remove the key | Drop invalid item |

For scalar explicit types with repeated params (`a=1&a=2`), the **last value wins** before casting.

&nbsp;

**Parse Options Definition:**
```typescript
type ParseOptions = {
	decode?: boolean;
	array?: ParseArrayFormat;
	parseNumber?: boolean;
	parseBoolean?: boolean;
	types?: Record<string, ValueType>;
	onTypeError?: ValueTypeError;
};
```
```typescript
type ParseArrayFormat =
  | { format: "repeat" }
  | { format: "comma"; encoded: "preserve" | "split" };
```
```typescript
type ValueType =
	| "string"
	| "number"
	| "boolean"
	| "string[]"
	| "number[]";
```
```typescript
type ValueTypeError = "keep" | "throw" | "drop";
```

> 
> ⚠️ Comma separated arrays depend on delimiter consistency. If values may be URL encoded or come from external sources, **repeat is safer and more predictable**.

- `encoded: "preserve"` splits on literal `,` only; `%2C` is treated as data.
- `encoded: "split"` splits on literal `,` and on `%2C`/`%2c` so results don’t depend on upstream encoding.

#### Examples

##### Parsing Numbers and Booleans

```typescript
parse('a=1&b=true&c=null', { parseNumber: true, parseBoolean: true });
// { a: 1, b: true, c: 'null' } (null literal not parsed unless typed)

parse('d=hello&e=001&f=12.5', { parseNumber: true });
// { d: 'hello', e: 1, f: 12.5 }
```

##### Array Formats

```typescript
// Repeat (default)
parse('tags=a&tags=b');
// { tags: ['a', 'b'] }

// Comma (Preserve encoded commas)
parse('tags=a,b%2Cc', { array: { format: 'comma', encoded: 'preserve' } });
// { tags: ['a', 'b,c'] }

// Comma (Split encoded commas)
parse('tags=a,b%2Cc', { array: { format: 'comma', encoded: 'split' } });
// { tags: ['a', 'b', 'c'] }
```

##### Explicit Types

Explicit types take priority over global `parseNumber`/`parseBoolean` flags.

```typescript
parse('count=5&flags=on&items=a&items=b', {
  parseNumber: true,
  parseBoolean: true,
  types: { count: 'string', flags: 'boolean', items: 'string[]' }
});
// { count: '5', flags: true, items: ['a', 'b'] }
// count stays string because of explicit type, despite parseNumber: true
```

##### Decoding Control

```typescript
parse('q=hello%20world', { decode: true });
// { q: 'hello world' }

parse('q=hello%20world', { decode: false });
// { q: 'hello%20world' }
```

### stringify(object: Record<string, any>, options?: StringifyOptions): string

Serializes an object into a query string.

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `encode` | `boolean` | `true` | Encode special characters. |
| `array` | `StringifyArrayFormat` | `{ format: "repeat" }` | How arrays are serialized. |
| `skipNull` | `boolean` | `false` | Skip `null` values (or `null` array items). |
| `skipEmptyString` | `boolean` | `false` | Skip empty-string values (or empty-string array items). |

&nbsp;

**Stringify Options Definition:**
```typescript
type StringifyOptions = {
	encode?: boolean;
	array?: StringifyArrayFormat;
	skipNull?: boolean;
	skipEmptyString?: boolean;
};
```
```typescript
type StringifyArrayFormat =
  | { format: "repeat" }
  | { format: "comma" };
```

#### Examples

##### Basic Usage

```typescript
stringify({ a: 1, b: 'hello', c: true });
// 'a=1&b=hello&c=true'
```

##### Array Formats

```typescript
// Repeat (default)
stringify({ tags: ['a', 'b', 'c'] });
// 'tags=a&tags=b&tags=c'

// Comma
stringify({ tags: ['a', 'b', 'c'] }, { array: { format: 'comma' } });
// 'tags=a,b,c'
```

##### Skipping Values

```typescript
stringify({ a: 1, b: null, c: '', d: undefined }, { skipNull: true, skipEmptyString: true });
// 'a=1'

stringify({ a: 1, b: null }, { skipNull: false });
// 'a=1&b'
```

##### Encoding Control

```typescript
stringify({ q: 'hello world' }, { encode: true });
// 'q=hello%20world'

stringify({ q: 'hello world' }, { encode: false });
// 'q=hello world'
```

## Advanced Examples

### Complex Objects

**Note:** Nested objects are not supported. They are converted to their string representation.

```typescript
const obj = {
  user: 'john',
  age: 30,
  active: true,
  tags: ['developer', 'typescript'],
  metadata: {
    created: '2025-01-01'  // This nested object will become '[object Object]'
  }
};

const query = stringify(obj, { array: { format: 'repeat' } });
console.log(query);
// 'user=john&age=30&active=true&tags=developer&tags=typescript&metadata=%5Bobject%20Object%5D'

// When parsing back, you might want numeric/boolean values restored:
const parsed = parse(query, {
  parseNumber: true,
  parseBoolean: true,
  array: { format: 'repeat' }
});
console.log(parsed);
// { user: 'john', age: 30, active: true, tags: ['developer', 'typescript'], metadata: '[object Object]' }
```

### URL Integration

```typescript
// Parse from URL with repeat format (default)
const url2 = new URL('https://example.com/search?q=typescript&tags=web&tags=api&limit=10');
// Use explicit global parse flags as needed
const params2 = parse(url2.search.slice(1), { parseNumber: true, array: { format: 'repeat' } });
console.log(params2);
// { q: 'typescript', tags: ['web', 'api'], limit: 10 }

// Parse from URL with comma format
const url3 = new URL('https://example.com/search?q=typescript&tags=web,api&limit=10');
const params3 = parse(url3.search.slice(1), { parseNumber: true, array: { format: 'comma', encoded: 'preserve' } });
console.log(params3);
// { q: 'typescript', tags: ['web', 'api'], limit: 10 }

// Build URL
const baseUrl = 'https://example.com/search';
const queryString = stringify({ q: 'javascript', sort: 'recent' });
const fullUrl = `${baseUrl}?${queryString}`;
console.log(fullUrl);
// 'https://example.com/search?q=javascript&sort=recent'
```

## Development

### Building

```bash
bun run build
```

### Testing

```bash
bun test
```

### Verification

```bash
node verify.mjs
# or
bun verify.mjs
```

## License

MIT - see [LICENSE](LICENSE)
