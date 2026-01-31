/**
 * 	encoded: "preserve" splits on literal , only; %2C is treated as data.
 * 	encoded: "split" splits on literal , and on %2C/%2c so results don’t depend on upstream encoding.
 */
export type ArrayFormat =
	| { format: "repeat" }
	| { format: "comma"; encoded: "preserve" | "split" };

export type ValueType =
	| "string"
	| "number"
	| "boolean"
	| "string[]"
	| "number[]";

export type ParseOptions = {
	decode?: boolean;
	array?: ArrayFormat;
	parseNumber?: boolean;
	parseBoolean?: boolean;
	types?: Record<string, ValueType>;
};

export type StringifyOptions = {
	encode?: boolean;
	array?: ArrayFormat;
	skipNull?: boolean;
	skipEmptyString?: boolean;
};
