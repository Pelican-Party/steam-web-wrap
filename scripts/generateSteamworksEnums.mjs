/**
 * Reads the const enums from the client.d.ts of @jespertheend/steamworks.js
 * and generates src/steamworksEnums.cjs from them.
 *
 * The renderer process needs these enums synchronously, while most other
 * steamworks calls go through async ipc. Passing them along at build time
 * avoids having to manually duplicate hundreds of enum members.
 *
 * Function signatures are parsed as well, the generated `enumArgTypes` table
 * maps each method to which of its arguments expect an enum. That allows
 * the main process to accept enum member names (strings) instead of only
 * their numeric values.
 *
 * Run `node scripts/generateSteamworksEnums.mjs` after updating the
 * steamworks.js dependency, this also happens automatically on npm install.
 * With `--check` the script fails instead of writing (used in ci).
 */
import fs from "node:fs";
import path from "node:path";

const checkOnly = process.argv.includes("--check");
const packageDir = path.resolve(import.meta.dirname, "../node_modules/@jespertheend/steamworks.js");
const outputPath = path.resolve(import.meta.dirname, "../src/steamworksEnums.cjs");

const { version } = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), { encoding: "utf8" }));
const dts = fs.readFileSync(path.join(packageDir, "client.d.ts"), { encoding: "utf8" });

/** @typedef {Map<string, number | string | bigint>} InstalledEnum */
/** @typedef {Map<string, InstalledEnum>} InstalledNamespace */

/** @type {Map<string, InstalledNamespace>} */
const namespaces = new Map();
/** Maps "namespace.method" to which argument positions expect which enum.
 * @type {Map<string, (string | null)[]>}
 */
const enumArgTypes = new Map();

/**
 * Enum values in the d.ts are either quoted strings, numbers or (possibly
 * at some point) bigints.
 * @param {string} raw
 */
function parseEnumValue(raw) {
	const stringMatch = raw.match(/^'((?:[^'\\]|\\.)*)'$/);
	if (stringMatch) return stringMatch[1].replaceAll("\\'", "'");
	const value = raw.endsWith("n") ? BigInt(raw.slice(0, -1)) : Number(raw);
	if (typeof value == "number" && Number.isNaN(value)) {
		throw new Error(`Failed to parse enum value: ${raw}`);
	}
	return value;
}

/**
 * Splits a parameter list on top level commas. Brackets of nested types like
 * generics, unions and function types are respected.
 * @param {string} raw
 * @returns {string[]}
 */
function splitParams(raw) {
	const params = [];
	let depth = 0;
	let current = "";
	for (const char of raw) {
		if ("(<[{".includes(char)) depth++;
		else if (")>]}".includes(char)) depth--;
		if (char == "," && depth == 0) {
			params.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	if (current.trim()) params.push(current.trim());
	return params;
}

/**
 * Returns the name of the enum a parameter type refers to. Enums are always
 * referenced by their bare name within their own namespace.
 * @param {string} param
 * @param {string} namespaceName
 * @returns {string | null}
 */
function resolveEnumType(param, namespaceName) {
	// Parameters are written as "name: Type", enums are referenced by their
	// bare type name.
	const typeMatch = param.match(/^[\w$]+\s*:\s*([\w$]+)\??$/) ?? param.match(/^([\w$]+)\??$/);
	if (!typeMatch) return null;
	const enums = namespaces.get(namespaceName);
	return enums != null && enums.has(typeMatch[1]) ? typeMatch[1] : null;
}

let currentNamespace = null;
let currentEnum = null;
let implicitValue = 0;
for (const line of dts.split("\n")) {
	if (currentEnum != null) {
		if (line.trim() == "}") {
			currentEnum = null;
			continue;
		}
		const explicit = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+?),?\s*$/);
		if (explicit) {
			const value = parseEnumValue(explicit[2]);
			currentEnum.set(explicit[1], value);
			if (typeof value == "number" || typeof value == "bigint") implicitValue = value;
			continue;
		}
		const implicit = line.match(/^\s*([A-Za-z_]\w*),?\s*$/);
		if (implicit) {
			implicitValue++;
			currentEnum.set(implicit[1], implicitValue);
			continue;
		}
		// Skip comments, blank lines and anything else we don't understand
		continue;
	}

	const namespaceMatch = line.match(/^export declare namespace (\w+) \{$/);
	if (namespaceMatch) {
		currentNamespace = namespaceMatch[1];
		namespaces.set(currentNamespace, new Map());
		continue;
	}
	if (currentNamespace == null) continue;
	if (line == "}") {
		currentNamespace = null;
		continue;
	}
	const enumMatch = line.match(/^\s*export const enum (\w+) \{$/);
	if (enumMatch) {
		currentEnum = new Map();
		implicitValue = 0;
		namespaces.get(currentNamespace).set(enumMatch[1], currentEnum);
		continue;
	}
	const functionMatch = line.match(/^\s*export function (\w+)\((.*)\): (.+)$/);
	if (functionMatch) {
		const types = splitParams(functionMatch[2]).map((param) => resolveEnumType(param, currentNamespace));
		if (types.some(Boolean)) {
			enumArgTypes.set(`${currentNamespace}.${functionMatch[1]}`, types);
		}
	}
}

if (namespaces.size == 0) {
	throw new Error("No namespaces were found in client.d.ts, the type definition format might have changed.");
}
let totalEnums = 0;
let totalMembers = 0;
for (const enums of namespaces.values()) {
	totalEnums += enums.size;
	for (const members of enums.values()) {
		totalMembers += members.size;
	}
}
if (totalEnums == 0) {
	throw new Error("No const enums were found in client.d.ts, the type definition format might have changed.");
}

// Fail loudly if signature parsing stops matching the d.ts format, otherwise
// string arguments would silently stop being converted.
for (const required of [
	"input.getGlyphForActionOrigin",
	"matchmaking.createLobby",
	"networking.sendP2PPacket",
	"overlay.activateDialog",
	"overlay.activateToStore",
	"utils.showGamepadTextInput",
	"workshop.getAllItems",
	"workshop.getUserItems",
]) {
	if (!enumArgTypes.has(required)) {
		throw new Error(
			`Signature parsing failed: "${required}" should have enum arguments, the d.ts format might have changed.`,
		);
	}
}

/**
 * Serializes a Map into an object literal, matching prettier's preferred
 * output for the project (.prettierrc). The output is still formatted by
 * prettier afterwards, this just makes the input deterministic.
 * @param {Map<string, any>} value
 * @param {number} depth
 */
function serialize(value, depth) {
	const indent = "\t".repeat(depth);
	if (Array.isArray(value)) {
		return `[${value.map((item) => serialize(item, 0)).join(", ")}]`;
	}
	if (value instanceof Map) {
		if (value.size == 0) return "{}";
		const lines = [];
		for (const [key, childValue] of value) {
			lines.push(`${indent}\t${JSON.stringify(key)}: ${serialize(childValue, depth + 1)},`);
		}
		return `{\n${lines.join("\n")}\n${indent}}`;
	}
	if (typeof value == "string") return JSON.stringify(value);
	if (typeof value == "bigint") return `${value}n`;
	if (typeof value == "number") return String(value);
	if (value === null) return "null";
	throw new Error(`Unserializable enum value type: ${typeof value}`);
}

// Namespaces without any enums are not included in the generated file
for (const [name, enums] of namespaces) {
	if (enums.size == 0) namespaces.delete(name);
}

const source = `// This file is auto generated by scripts/generateSteamworksEnums.mjs, do not edit it manually.
// It is generated from the client.d.ts of @jespertheend/steamworks.js@${version}.
// - enums: every const enum, so the renderer process can use them without
//   making async calls to the main process.
// - enumArgTypes: which argument positions of which method expect which enum,
//   used to convert enum member names to their numeric values.
// Regenerate it with \`npm run generate-enums\`.

"use strict";

module.exports = ${serialize(
	new Map([
		["enums", namespaces],
		["enumArgTypes", enumArgTypes],
	]),
	0,
)};
`;

const prettier = await import("prettier");
const config = await prettier.resolveConfig(outputPath);
const formatted = await prettier.format(source, { ...config, filepath: outputPath });

const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, { encoding: "utf8" }) : "";
const summary = `(${totalEnums} enums, ${totalMembers} members, ${enumArgTypes.size} methods with enum arguments)`;
if (existing == formatted) {
	console.log(`${path.relative(process.cwd(), outputPath)} is up to date ${summary}`);
} else if (checkOnly) {
	console.error(
		`${path.relative(process.cwd(), outputPath)} is out of date with @jespertheend/steamworks.js@${version}.` +
			`\nRun \`npm run generate-enums\` to regenerate it.`,
	);
	process.exit(1);
} else {
	fs.writeFileSync(outputPath, formatted);
	console.log(`Wrote ${path.relative(process.cwd(), outputPath)} ${summary}`);
}
