/**
 * @fileoverview
 * This file takes care of everything related to making steamworks sdk calls from the renderer process.
 * This file itself is loaded by the main process, but it handles events fired by the renderer process.
 */

/**
 * @typedef SteamworksCall
 * @property {string} interface
 * @property {string} method
 * @property {unknown[]} args
 */

/** @type {Map<number, {disconnect: () => void}>} */
const createdCallbackHandles = new Map();

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
		// @ts-ignore
		const result = getSteamClient()[castCall.interface][castCall.method](...castCall.args);
		return result;
	});

	ipcMain.handle("registerSteamworksCallback", (_, steamCallback, id) => {
		// @ts-ignore
		const callbackType = getSteamClient().callback.SteamCallback[steamCallback];
		if (!callbackType) {
			throw new Error(`${steamCallback} is not a valid callback type`);
		}
		const handle = getSteamClient().callback.register(callbackType, (...args) => {
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
};
