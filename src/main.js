const path = require("node:path");
const fs = require("node:fs/promises");
const { app, shell, BrowserWindow, ipcMain, dialog, Menu } = require("electron/main");
const { buildMenu } = require("./buildMenu.js");

app.whenReady().then(async () => {
	/**
	 * This argument should really only be used during development of steam-web-wrap.
	 * I.e. when running through `npm run start`.
	 * Normally the process crashes on unhandled rejections, but since calls to `executeJavaScript()`
	 * might throw errors during development, which can only be debugged by looking at devtools,
	 * we want to prevent the process from closing in that case.
	 */
	const debug = process.argv.includes("--debug-dev");

	process.on("unhandledRejection", (error) => {
		console.error(error);
		if (!debug) {
			app.exit();
		}
	});

	const url = app.commandLine.getSwitchValue("url");
	if (!url) {
		dialog.showErrorBox("Error", "No url was provided, provide one using the --url= command line argument.");
	}

	let fullscreen = true;
	if (process.argv.includes("--no-fullscreen")) {
		fullscreen = false;
	}

	const showDebugMenu = process.argv.includes("--show-debug-menu");
	if (showDebugMenu) fullscreen = false;
	const menu = buildMenu(showDebugMenu);

	ipcMain.handle("closeApp", () => {
		app.quit();
	});

	const win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen: true,
		fullscreenable: true,
		autoHideMenuBar: !showDebugMenu,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			sandbox: false,
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

	const sameContextPreloadPath = path.join(__dirname, "sameContextPreload.js");
	const sameContextPreloadContent = await fs.readFile(sameContextPreloadPath, { encoding: "utf8" });
	win.webContents.on("dom-ready", async () => {
		try {
			await win.webContents.executeJavaScript(sameContextPreloadContent);
		} catch (e) {
			if (e instanceof Error && e.message.includes("Script failed to execute")) {
				console.error("sameContextPreload.js contains an error, check the browser console for details");
				if (!debug) {
					throw e;
				}
			} else {
				throw e;
			}
		}
	});

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

	win.loadURL(url);
});

app.on("window-all-closed", () => {
	app.quit();
});
