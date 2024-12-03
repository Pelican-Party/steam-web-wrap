const path = require("node:path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron/main");
const { loadConfig, ConfigError } = require("./configLoading.js");

app.whenReady().then(async () => {
	process.on("unhandledRejection", (error) => {
		console.error(error);
		app.exit();
	});

	const url = app.commandLine.getSwitchValue("url");
	if (!url) {
		dialog.showErrorBox("Error", "No url was provided, provide one using the --url= command line argument.");
	}

	let fullscreen = true;
	if (process.argv.includes("--no-fullscreen")) {
		fullscreen = false;
	}

	ipcMain.handle("closeApp", () => {
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
	win.removeMenu();

	win.loadURL(url);
});

app.on("window-all-closed", () => {
	app.quit();
});
