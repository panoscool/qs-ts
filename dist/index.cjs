var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/index.ts
var exports_src = {};
__export(exports_src, {
  stringify: () => stringify,
  strictUriEncode: () => strictUriEncode,
  splitOnFirst: () => splitOnFirst,
  safeDecodeURIComponent: () => safeDecodeURIComponent,
  parse: () => parse
});
module.exports = __toCommonJS(exports_src);

// src/core.ts
function splitOnFirst(string, separator) {
  if (!(typeof string === "string" && typeof separator === "string")) {
    throw new TypeError("Expected the arguments to be of type `string`");
  }
  if (separator === "") {
    return [string, undefined];
  }
  const separatorIndex = string.indexOf(separator);
  if (separatorIndex === -1) {
    return [string, undefined];
  }
  return [
    string.slice(0, separatorIndex),
    string.slice(separatorIndex + separator.length)
  ];
}
function safeDecodeURIComponent(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}
function strictUriEncode(text) {
  return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// src/parse.ts
function maybeDecode(text, options) {
  return options.decode === false ? text : safeDecodeURIComponent(text);
}
function parseScalarValue(value, options, key) {
  const typeDef = options.types?.[key];
  if (typeDef) {
    const isArrayType = typeDef.endsWith("[]");
    const baseType = isArrayType ? typeDef.slice(0, -2) : typeDef;
    if (baseType === "number") {
      const n = Number(value);
      return value.trim() !== "" && Number.isFinite(n) ? n : value;
    }
    if (baseType === "boolean") {
      if (value === "true")
        return true;
      if (value === "false")
        return false;
      return value;
    }
    return value;
  }
  if (options.inferTypes) {
    if (value === "true")
      return true;
    if (value === "false")
      return false;
    if (value === "null")
      return null;
    const n = Number(value);
    if (value.trim() !== "" && Number.isFinite(n))
      return n;
  }
  return value;
}
function splitCommaRaw(raw) {
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function parse(query, options = {}) {
  const opts = {
    decode: true,
    arrayFormat: "repeat",
    ...options
  };
  const result = Object.create(null);
  if (typeof query !== "string")
    return result;
  const cleaned = query.trim().replace(/^[?#&]/, "");
  if (!cleaned)
    return result;
  for (const param of cleaned.split("&")) {
    if (!param)
      continue;
    let [rawKey, rawValue] = splitOnFirst(param, "=");
    const key = maybeDecode(rawKey, opts);
    if (rawValue === undefined) {
      const finalKey = opts.arrayFormat === "bracket" && key.endsWith("[]") ? key.slice(0, -2) : key;
      if (result[finalKey] === undefined)
        result[finalKey] = null;
      else if (Array.isArray(result[finalKey]))
        result[finalKey].push(null);
      else
        result[finalKey] = [result[finalKey], null];
      continue;
    }
    const normalizedKey = opts.arrayFormat === "bracket" && key.endsWith("[]") ? key.slice(0, -2) : key;
    const rawParts = opts.arrayFormat === "comma" ? splitCommaRaw(rawValue) : [rawValue];
    const decodedParts = rawParts.map((p) => maybeDecode(p, opts));
    const incoming = opts.arrayFormat === "comma" ? decodedParts : decodedParts[0];
    if (result[normalizedKey] === undefined) {
      result[normalizedKey] = incoming;
    } else if (Array.isArray(result[normalizedKey])) {
      result[normalizedKey].push(incoming);
    } else {
      result[normalizedKey] = [result[normalizedKey], incoming];
    }
  }
  for (const key of Object.keys(result)) {
    let val = result[key];
    if (opts.arrayFormat === "comma") {
      if (Array.isArray(val)) {
        const flat = [];
        for (const item of val) {
          if (Array.isArray(item))
            flat.push(...item);
          else
            flat.push(item);
        }
        val = flat;
        result[key] = val;
      }
    }
    val = result[key];
    if (Array.isArray(val)) {
      result[key] = val.map((item) => item === null ? null : parseScalarValue(String(item), opts, key));
    } else {
      if (val !== null) {
        result[key] = parseScalarValue(String(val), opts, key);
      }
    }
    const typeDef = opts.types?.[key];
    if (typeDef && typeDef.endsWith("[]") && !Array.isArray(result[key])) {
      result[key] = [result[key]];
    }
  }
  return result;
}
// src/stringify.ts
function enc(text, options) {
  return options.encode === false ? text : strictUriEncode(text);
}
function encValue(v, options) {
  return enc(String(v), options);
}
function stringify(object, options = {}) {
  if (!object)
    return "";
  const opts = {
    encode: true,
    arrayFormat: "repeat",
    skipNull: false,
    skipEmptyString: false,
    ...options
  };
  const parts = [];
  for (const key of Object.keys(object)) {
    const value = object[key];
    if (value === undefined)
      continue;
    if (value === null) {
      if (opts.skipNull)
        continue;
      parts.push(enc(key, opts));
      continue;
    }
    if (value === "" && opts.skipEmptyString)
      continue;
    if (Array.isArray(value)) {
      const items = value.filter((v) => v !== undefined);
      if (opts.arrayFormat === "comma") {
        const encodedItems = items.filter((item) => !(item === null && opts.skipNull)).filter((item) => !(item === "" && opts.skipEmptyString)).map((item) => item === null ? "" : encValue(item, opts));
        const cleaned = encodedItems.filter((s) => s.length > 0);
        if (cleaned.length === 0)
          continue;
        parts.push(`${enc(key, opts)}=${cleaned.join(",")}`);
        continue;
      }
      if (opts.arrayFormat === "bracket") {
        const keyWithBrackets = `${key}[]`;
        const sub2 = items.filter((item) => !(item === null && opts.skipNull)).filter((item) => !(item === "" && opts.skipEmptyString)).map((item) => {
          if (item === null)
            return enc(keyWithBrackets, opts);
          return `${enc(keyWithBrackets, opts)}=${encValue(item, opts)}`;
        });
        parts.push(...sub2);
        continue;
      }
      const sub = items.filter((item) => !(item === null && opts.skipNull)).filter((item) => !(item === "" && opts.skipEmptyString)).map((item) => {
        if (item === null)
          return enc(key, opts);
        return `${enc(key, opts)}=${encValue(item, opts)}`;
      });
      parts.push(...sub);
      continue;
    }
    parts.push(`${enc(key, opts)}=${encValue(value, opts)}`);
  }
  return parts.join("&");
}
