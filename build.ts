import { rmSync } from "node:fs";
import { build } from "bun";

function assertBuild(result: Awaited<ReturnType<typeof build>>, label: string) {
	if (!result.success) {
		console.error(`\n❌ ${label} failed\n`);
		for (const log of result.logs) console.error(log);
		process.exit(1);
	}
}

rmSync("./dist", { recursive: true, force: true });

// Build ESM
const esm = await build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "node",
	format: "esm",
	naming: "[name].js",
	minify: true,
});
assertBuild(esm, "ESM build");

// Build CJS
const cjs = await build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "node",
	format: "cjs",
	naming: "[name].cjs",
	minify: true,
});
assertBuild(cjs, "CJS build");

// Generate Types (use bun x tsc + override noEmit)
const proc = Bun.spawn({
	cmd: [
		"bun",
		"x",
		"tsc",
		"-p",
		"tsconfig.json",
		"--noEmit",
		"false",
		"--declaration",
		"--emitDeclarationOnly",
		"--outDir",
		"dist",
	],
	stdout: "inherit",
	stderr: "inherit",
});

const code = await proc.exited;
if (code !== 0) {
	console.error("\n❌ Type generation failed (tsc exited non-zero)\n");
	process.exit(code);
}

console.log("✅ Build complete!");
