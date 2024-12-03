const path = require("node:path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron/main");
const { loadConfig, ConfigError } = require("./configLoading.js");

app.whenReady().then(async () => {
	process.on("unhandledRejection", (error) => {
		console.error(error);
		app.exit();
	});

	let config;
	try {
		config = await loadConfig(app);
	} catch (e) {
		if (e instanceof ConfigError) {
			dialog.showErrorBox("Error", e.message);
		}
		throw e;
	}
	const { url, fullscreen } = config;
	ipcMain.handle("close", () => {
		app.quit();
	});
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			sandbox: false,
		},
	});

	win.loadURL(url);
});

app.on("window-all-closed", () => {
	app.quit();
});
