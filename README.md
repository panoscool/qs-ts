# qs-ts

A TypeScript library for parsing and stringifying URL query strings, inspired by the popular 'query-string' library. It provides robust handling of arrays, type inference, and encoding options.

## Features

- **Type Inference**: Flexible options to parse numbers (`parseNumber`) and booleans (`parseBoolean`)
- **Array Formats**: Support for `repeat` (key=a&key=b) and `comma` (key=a,b) with configurable encoding
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

- `decode?: boolean` (default: `true`) - Whether to decode percent-encoded characters
- `parseNumber?: boolean` (default: `false`) - Attempt to parse numbers ("1", "12.5", "1e3" -> number).
  - Uses `Number(val)`.
  - Does NOT parse "Infinity", "NaN", or empty strings.
- `parseBoolean?: boolean` (default: `false`) - Attempt to parse booleans.
  - Only "true" and "false" (lowercase) are converted.
- `array?: ArrayFormat` (default: `{ format: 'repeat' }`) - How arrays are represented
- `types?: Record<string, ValueType>` - Explicit type casting (takes priority over global flags)

**ArrayFormat Definition:**
```typescript
type ArrayFormat =
  | { format: "repeat" }
  | { format: "comma"; encoded: "preserve" | "split" };
```

> [IMPORTANT]
> Comma-separated arrays depend on delimiter consistency. If values may be URL-encoded or come from external sources, **repeat is safer and more predictable**.

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

- `encode?: boolean` (default: `true`) - Whether to encode special characters
- `array?: ArrayFormat` (default: `{ format: 'repeat' }`) - How arrays are serialized
- `skipNull?: boolean` (default: `false`) - Whether to skip null values
- `skipEmptyString?: boolean` (default: `false`) - Whether to skip empty strings

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
stringify({ tags: ['a', 'b', 'c'] }, { array: { format: 'comma', encoded: 'preserve' } });
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
// inferTypes is gone, use specific flags if needed
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

MIT - see [LICENSE](LICENSE)</content>