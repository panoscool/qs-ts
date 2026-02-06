#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd, opts = {}) {
	console.log(`\n> ${cmd}`);
	execSync(cmd, { stdio: "inherit", ...opts });
}

function runGet(cmd, opts = {}) {
	return execSync(cmd, { encoding: "utf8", ...opts }).trim();
}

function fail(msg) {
	console.error(`\n❌ ${msg}\n`);
	process.exit(1);
}

// 1) Unit tests
run("bun test");

// 2) Build
run("bun run build");

// 3) Smoke test dist outputs directly (Node ESM + CJS)
run(
	`node --input-type=module -e "import { parse, stringify } from './dist/index.mjs'; console.log(parse('a=1&b=2')); console.log(stringify({a:1}));"`,
);
run(
	`node -e "const { parse, stringify } = require('./dist/index.cjs'); console.log(parse('a=1&b=2')); console.log(stringify({a:1}));"`,
);

// 4) Create a tarball (the real artifact users install)
run("npm pack");

// Find the latest .tgz created by npm pack
const tgz = runGet(
	`node -e "const fs=require('fs'); const files=fs.readdirSync('.').filter(f=>f.endsWith('.tgz')).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs); console.log(files[0]||'');"`,
);
if (!tgz) fail("npm pack did not produce a .tgz file");

// 5) Install tarball into a temp consumer project and test imports + types
const dir = mkdtempSync(join(tmpdir(), "qs-ts-consumer-"));
console.log(`\n📦 Temp consumer project: ${dir}`);

try {
	run("npm init -y", { cwd: dir });

	// Install the tarball
	run(`npm install ${join(process.cwd(), tgz)}`, { cwd: dir });

	// ESM usage test
	writeFileSync(
		join(dir, "esm.mjs"),
		`${`
            import { parse, stringify } from "qs-ts";
            console.log(parse("a=1&b=2"));
            console.log(stringify({ a: 1, b: "two" }));
`.trim()}\n`,
	);
	run("node esm.mjs", { cwd: dir });

	// CJS usage test
	writeFileSync(
		join(dir, "cjs.cjs"),
		`${`
            const { parse, stringify } = require("qs-ts");
            console.log(parse("a=1&b=2"));
            console.log(stringify({ a: 1, b: "two" }));
`.trim()}\n`,
	);
	run("node cjs.cjs", { cwd: dir });

	// TypeScript typecheck test
	run("npm install -D typescript", { cwd: dir });

	writeFileSync(
		join(dir, "tsconfig.json"),
		`${JSON.stringify(
			{
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
					moduleResolution: "Bundler",
					strict: true,
					noEmit: true,
				},
			},
			null,
			2,
		)}\n`,
	);

	writeFileSync(
		join(dir, "types-test.ts"),
		`${`
            import { parse, stringify } from "qs-ts";

            const q1 = parse("a=1&b=true", { types: { a: "number", b: "boolean" } });
            const q2 = parse("ids=1,2,3", { array: { format: "comma", encoded: "preserve" }, types: { ids: "number[]" } });

            const s1 = stringify({ a: 1, b: "two" });
            console.log(q1, q2, s1);
`.trim()}\n`,
	);

	run("npx tsc", { cwd: dir });
} finally {
	// Clean up temp dir
	rmSync(dir, { recursive: true, force: true });
}

// Optional: clean up tarball after verification
rmSync(join(process.cwd(), tgz), { force: true });

console.log("\n✅ All checks passed!");
