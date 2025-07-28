const path = require("node:path");
const fs = require("node:fs");
const { contextBridge, ipcRenderer } = require("electron");

// This object is deprecated, use window.close() instead
contextBridge.exposeInMainWorld("steamWebWrap", {
	quitApp: () => ipcRenderer.invoke("quitApp"),
	window: {
		bringToFront: () => ipcRenderer.invoke("bringToFront"),
	},
});

let fullscreenState = false;

/**
 * @typedef AdditionalPreloadData
 * @property {boolean} debug
 * @property {import("./main.js", {with: {"resolution-mode": "import"}}).SteamNotInitializedWarning?} steamNotInitializedWarning
 */
/** @type {AdditionalPreloadData?} */
let additionalPreloadData = null;

{
	const args = /** @type {string[]} */ (window.process.argv);
	const additionalDataPrefix = "--additionalPreloadData=";
	for (const arg of args) {
		if (arg.startsWith(additionalDataPrefix)) {
			const jsonString = arg.slice(additionalDataPrefix.length);
			additionalPreloadData = JSON.parse(jsonString);
			break;
		}
	}
	if (!additionalPreloadData) {
		throw new Error("No --additionalPreloadData argument was found");
	}
}

const sameContextPreloadPath = path.join(__dirname, "sameContextPreload.js");
const sameContextPreloadContent = fs.readFileSync(sameContextPreloadPath, { encoding: "utf8" });

process.once("document-start", () => {
	const script = document.createElement("script");
	script.textContent = sameContextPreloadContent;
	document.documentElement.appendChild(script);
});

/**
 * This calls `ipcRenderer.invoke` and strips some unnecessary info from error messages.
 *
 * @param {string} channel
 * @param  {any} args
 */
async function invokeWithErrorHandling(channel, ...args) {
	try {
		return await ipcRenderer.invoke(channel, ...args);
	} catch (error) {
		const prefix = `Error invoking remote method '${channel}': Error: `;
		if (error instanceof Error && error.message.startsWith(prefix)) {
			throw new Error(error.message.slice(prefix.length));
		}

		throw error;
	}
}

let steamNotInitializedWarningMessage = null;
if (additionalPreloadData.steamNotInitializedWarning) {
	const warning = additionalPreloadData.steamNotInitializedWarning;
	if (warning == "no-app-id") {
		steamNotInitializedWarningMessage =
			"No steam appid was specified. Launch with --appid=<your app id> if you wish to make calls to the steamworks sdk. This is only required during development. When launched through steam, the appid will automatically be determined.";
	} else if (warning == "not-running") {
		steamNotInitializedWarningMessage =
			"Steam doesn't appear to be running. Make sure to launch Steam if you wish to make calls to the steamworks sdk.";
	} else if (warning == "not-logged-in") {
		steamNotInitializedWarningMessage =
			"No user appears to be logged in in the Steam client. Log in to Steam if you wish to make calls to the steamworks sdk.";
	} else {
		steamNotInitializedWarningMessage = "An unknown error occurred while initializing the steamworks sdk.";
	}
}

contextBridge.exposeInMainWorld("_steamWebWrapInternal", {
	debug: additionalPreloadData.debug,
	steamNotInitializedWarningMessage,
	exitFullScreen: () => invokeWithErrorHandling("exitFullScreen"),
	/**
	 * @param {boolean} state
	 */
	setFullscreenState: (state) => {
		fullscreenState = state;
	},
	getFullscreenState: () => fullscreenState,
	quitApp: () => invokeWithErrorHandling("quitApp"),
	/**
	 * @param {import("./steamworksCalls.js", {with: {"resolution-mode": "import"}}).SteamworksCall} call
	 */
	steamworksCall: (call) => invokeWithErrorHandling("steamworksCall", call),
	/**
	 * @param {string} interfaceName
	 */
	getSteamworksProps: (interfaceName) => invokeWithErrorHandling("getSteamworksProps", interfaceName),
	/**
	 * @param {string} steamCallback
	 * @param {number} id
	 */
	registerSteamworksCallback: (steamCallback, id) =>
		invokeWithErrorHandling("registerSteamworksCallback", steamCallback, id),
	/**
	 * @param {(id: number, args: unknown[]) => void} cb
	 */
	onSteamworksCallbackFired: (cb) => {
		ipcRenderer.on("steamworksCallbackFired", (_, id, args) => {
			cb(id, args);
		});
	},
	/**
	 * @param {number} id
	 */
	disconnectSteamworksCallback: (id) => invokeWithErrorHandling("disconnectSteamworksCallback", id),
});
