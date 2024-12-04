const path = require("node:path");
const { app, shell, BrowserWindow, ipcMain, dialog, Menu } = require("electron/main");
const { buildMenu } = require("./buildMenu.js");

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

	const showDebugMenu = process.argv.includes("--show-debug-menu");
	if (showDebugMenu) fullscreen = false;
	const menu = buildMenu(showDebugMenu);

	ipcMain.handle("closeApp", () => {
		app.quit();
	});
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen,
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
		return { action: 'deny' };
	});

	win.loadURL(url);
});

app.on("window-all-closed", () => {
	app.quit();
});
