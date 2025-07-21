const path = require("node:path");
const { shell } = require("electron");
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron/main");
const { buildMenu } = require("./buildMenu.js");
const steamworks = require("@jespertheend/steamworks.js");
const { initializeSteamworkCalls } = require("./steamworksCalls.js");

steamworks.electronEnableSteamOverlay();

const debug = process.argv.includes("--debug-mode") || process.argv.includes("-d");

// We will try to load the steamworks sdk in case Steam Web Wrap was launched through steam.
// If it wasn't launched through steam, developers can use the --appid= command line flag or maybe even a
// steam_appid.txt file to set their app id for development.
// If no appid was set and it wasn't launched through steam, the user is likely
// just trying to experiment with steam-web-wrap. We'll still want to launch in that case,
// the steamworks sdk just won't be available. `steamworks.init()` will throw but
// we'll only print a warning and continue launching.
/** @typedef {Omit<steamworks.Client, "init" | "runCallbacks">} SteamClient */
/** @type {SteamClient?} */
let steamClient = null;
/** @typedef {"unknown" | "no-app-id" | "not-running" | "not-logged-in"} SteamNotInitializedWarning */
/** @type {SteamNotInitializedWarning?} */
let steamNotInitializedWarning = "unknown";
try {
	const appIdFlag = app.commandLine.getSwitchValue("appid");
	let appId = undefined;
	if (appIdFlag) {
		appId = parseInt(appIdFlag);
	}
	steamClient = steamworks.init(appId);
	steamNotInitializedWarning = null;
} catch (e) {
	if (e instanceof Error) {
		if (e.message.includes("No appID found")) {
			steamNotInitializedWarning = "no-app-id";
		} else if (
			e.message.includes("Steam is probably not running") || // Windows and Linux
			e.message.includes("Could not determine Steam client install directory.") // macOS
		) {
			// Normally applications would call restartAppIfNecessary(appId) here, but that doesn't really make sense in our case
			// since steam-web-wrap will be used for multiple applications. So we wouldn't know which appId to start.
			steamNotInitializedWarning = "not-running";
		} else if (e.message.includes("ConnectToGlobalUser failed")) {
			steamNotInitializedWarning = "not-logged-in";
		} else {
			throw e;
		}
	} else {
		throw e;
	}
}

let steamWebWrapDataPath;
if (process.platform == "win32") {
	const localAppData = process.env.LOCALAPPDATA;
	if (!localAppData) {
		throw new Error("Assertion failed, no LOCALAPPDATA env has been set");
	}
	steamWebWrapDataPath = path.resolve(localAppData, "steam-web-wrap");
} else if (process.platform == "darwin") {
	steamWebWrapDataPath = path.resolve(app.getPath("appData"), "steam-web-wrap");
} else if (process.platform == "linux") {
	const homedir = require("os").homedir();
	steamWebWrapDataPath = path.resolve(homedir, ".local/share/steam-web-wrap");
} else {
	throw new Error("Unknown platform");
}
const gamesPath = path.resolve(steamWebWrapDataPath, "games");

let sessionDataPath;
if (steamClient) {
	const appId = steamClient.utils.getAppId();
	const steamId = steamClient.localplayer.getSteamId();
	sessionDataPath = path.resolve(gamesPath, String(appId), String(steamId.steamId64));
} else {
	sessionDataPath = path.resolve(gamesPath, "unknown-games");
}
app.setPath("sessionData", sessionDataPath);

app.whenReady().then(async () => {
	process.on("unhandledRejection", (error) => {
		console.error("unhandled rejection:", error);
		// Normally we want to crash the application when an error occurs,
		// but since calls to `executeJavaScript()` might throw errors, which can only be debugged by looking at devtools,
		// we want to prevent the browser process from closing in that case.
		if (!debug) {
			app.exit();
		}
	});

	const url = app.commandLine.getSwitchValue("url");
	if (!url) {
		dialog.showErrorBox("Error", "No url was provided, provide one using the --url= command line argument.");
		app.quit();
		return;
	}

	let fullscreen = true;
	if (process.argv.includes("--no-fullscreen")) {
		fullscreen = false;
	}

	if (debug) fullscreen = false;
	const menu = buildMenu(debug);

	ipcMain.handle("quitApp", () => {
		app.quit();
	});

	/** @type {import("./preload.js").AdditionalPreloadData} */
	const additionalPreloadData = {
		debug,
		steamNotInitializedWarning,
	}

	const win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen,
		fullscreenable: true,
		autoHideMenuBar: !debug,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			sandbox: false,
			additionalArguments: ["--additionalPreloadData=" + JSON.stringify(additionalPreloadData)],
		},
	});
	if (process.platform == "darwin") {
		Menu.setApplicationMenu(menu);
	} else {
		if (fullscreen) {
			win.removeMenu();
		} else {
			win.setMenu(menu);
		}
	}

	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});

	ipcMain.handle("exitFullScreen", () => {
		win.setFullScreen(false);
	});

	initializeSteamworkCalls(ipcMain, win.webContents, steamClient, debug);

	/**
	 * @param {boolean} state
	 */
	async function setFullscreenState(state) {
		await win.webContents.executeJavaScript(`
		(() => {
			_steamWebWrapInternal.setFullscreenState(${Boolean(state)})
			const event = new Event("fullscreenchange");
			document.dispatchEvent(event);
		})();
		void(0);`);
	}
	win.on("enter-full-screen", () => {
		setFullscreenState(true);
	});
	win.on("leave-full-screen", () => {
		setFullscreenState(false);
	});
	setFullscreenState(fullscreen);

	try {
		await win.loadURL(url);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code == "ERR_INTERNET_DISCONNECTED") {
			await win.loadFile("src/youAreOffline.html");
		} else {
			throw error;
		}
	}
	win.show();
});

app.on("window-all-closed", () => {
	app.quit();
});
