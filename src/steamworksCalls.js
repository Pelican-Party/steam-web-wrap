/**
 * @fileoverview
 * This file takes care of everything related to making steamworks sdk calls from the renderer process.
 * This file itself is loaded by the main process, but it handles events fired by the renderer process.
 */

// Generated from the type definitions of @jespertheend/steamworks.js
import steamworksEnumsModule from "./steamworksEnums.cjs";
/** @typedef {Record<string, Record<string, Record<string, any>>>} EnumsMap */
/** @typedef {Record<string, (string | null)[]>} EnumArgTypesMap */
// The import is inferred with exact keys, this widens it so dynamic lookups
// type check and mismatches with the generated file shape fail here.
const steamworksEnums = /** @type {{enums: EnumsMap, enumArgTypes: EnumArgTypesMap}} */ (steamworksEnumsModule);
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

/**
 * @typedef SteamworksCall
 * @property {string} interface
 * @property {string} method
 * @property {unknown[]} args
 */

/** @type {Map<number, {disconnect: () => void}>} */
const createdCallbackHandles = new Map();

/**
 * Converts enum member names (strings) in the arguments of a steamworks call
 * to their numeric values. The generated `enumArgTypes` table knows which argument
 * positions of which method expect which enum. Numbers, bigints and null are
 * passed through and validated by the native sdk itself.
 * @param {SteamworksCall} call
 * @returns {unknown[]}
 */
function convertEnumArgs(call) {
	const enumArgTypes = steamworksEnums.enumArgTypes[call.interface + "." + call.method];
	if (!enumArgTypes) return call.args;
	return call.args.map((arg, index) => {
		const enumName = enumArgTypes[index];
		if (!enumName || arg == null) return arg;
		const members = steamworksEnums.enums[call.interface]?.[enumName];
		if (!members) return arg;
		if (typeof arg == "string") {
			if (!Object.hasOwn(members, arg)) {
				const allMembers = Object.keys(members);
				const preview =
					allMembers.length > 20 ? allMembers.slice(0, 20).join(", ") + ", ..." : allMembers.join(", ");
				throw new Error(`"${arg}" is not a member of ${enumName}. Valid members: ${preview}`);
			}
			return members[arg];
		}
		if (typeof arg != "number" && typeof arg != "bigint") {
			throw new Error(`Expected a member name or numeric value of the ${enumName} enum, but got ${typeof arg}`);
		}
		return arg;
	});
}

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Electron.WebContents} webContents
 * @param {import("./main.js").SteamClient?} steamClient
 * @param {boolean} debug
 */
export function initializeSteamworkCalls(ipcMain, webContents, steamClient, debug) {
	function getSteamClient() {
		if (steamClient) return steamClient;
		throw new Error("Assertion failed: Steamworks sdk is not initialized");
	}

	ipcMain.handle("steamworksCall", async (_, call) => {
		const castCall = /** @type {SteamworksCall} */ (call);
		const args = convertEnumArgs(castCall);
		// @ts-ignore
		const result = getSteamClient()[castCall.interface][castCall.method](...args);
		return result;
	});

	ipcMain.handle("registerSteamworksCallback", (_, steamCallback, id) => {
		const handle = getSteamClient().callback.register(steamCallback, (...args) => {
			webContents.send("steamworksCallbackFired", id, args);
		});
		createdCallbackHandles.set(id, handle);
	});

	ipcMain.handle("disconnectSteamworksCallback", (_, id) => {
		const handle = createdCallbackHandles.get(id);
		if (handle) {
			handle.disconnect();
			createdCallbackHandles.delete(id);
		}
	});

	/**
	 * @param {string} path
	 */
	async function pathToGlyph(path) {
		const buffer = await readFile(path);
		let mimeType;
		const ext = extname(path).toLowerCase();
		if (ext == ".png") {
			mimeType = "image/png";
		} else if (ext == ".svg") {
			mimeType = "image/svg+xml";
		} else {
			return null;
		}
		return `data:${mimeType};base64,${buffer.toString("base64")}`;
	}

	ipcMain.handle("getGlyphForActionOrigin", async (_, origin) => {
		return await pathToGlyph(getSteamClient().input.getGlyphForActionOrigin(origin));
	});

	ipcMain.handle("getGlyphPngForActionOrigin", async (_, origin, size, glyphStyle) => {
		return await pathToGlyph(getSteamClient().input.getGlyphPngForActionOrigin(origin, size, glyphStyle));
	});

	ipcMain.handle("getGlyphSvgForActionOrigin", async (_, origin, glyphStyle) => {
		return await pathToGlyph(getSteamClient().input.getGlyphSvgForActionOrigin(origin, glyphStyle));
	});

	if (debug) {
		ipcMain.handle("getSteamworksProps", async (event, path) => {
			let obj = steamClient;
			if (!obj) return [];
			for (const propName of path) {
				// @ts-ignore
				obj = obj[propName];
			}
			return Object.getOwnPropertyNames(obj);
		});
	}
}
