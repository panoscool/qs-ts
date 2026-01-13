export type ArrayFormat = "repeat" | "bracket" | "comma";
export type TypeName = "string" | "number" | "boolean" | "string[]" | "number[]";
export interface ParseOptions {
    decode?: boolean;
    inferTypes?: boolean;
    arrayFormat?: ArrayFormat;
    types?: Record<string, TypeName>;
}
export interface StringifyOptions {
    encode?: boolean;
    arrayFormat?: ArrayFormat;
    skipNull?: boolean;
    skipEmptyString?: boolean;
}
