/**
 * Logs a message in both the DevTools console and stdout.
 * This takes care of any escaping to prevent javascript injection.
 * @param {Electron.BrowserWindow} window
 * @param {"log" | "warn" | "error"} level
 * @param {string} message
 */
export function logConsoleMessage(window, level, message) {
	if (typeof message != "string") {
		throw new Error("Message must be a string");
	}
	if (!["log", "warn", "error"].includes(level)) {
		throw new Error(`"${level}" is not a valid log level`);
	}
	console[level](message);

	window.webContents.executeJavaScript(`
		console.${level}(${JSON.stringify(message)});
	`);
}
