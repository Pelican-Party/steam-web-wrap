/**
 * @fileoverview The recommended way to open the default browser is by using electron's
 * `shell.openExternal(url)` function. However, this causes Steam to think the game is still running even after
 * closing its window. An alternative often found on the web is the 'open' npm package, but this seems
 * to run commands in a shell which leaves open the possibility of injecting commands.
 * So instead we will just use node's `spawn` to keep things simple and secure.
 */

import process from "node:process";
import { spawn } from "child_process";
import { logConsoleMessage } from "./logConsoleMessage.js";

/**
 * @param {string} url
 * @param {Electron.BrowserWindow} window
 */
export function openExternalUrl(url, window) {
	let sanitizedUrl;
	try {
		sanitizedUrl = sanitizeUrl(url);
	} catch (error) {
		if (error instanceof Error) {
			logConsoleMessage(window, "warn", error.message);
			return null;
		} else {
			throw error;
		}
	}

	openSanitizedUrl(sanitizedUrl);
}

/**
 * @param {string} sanitizedUrl
 */
function openSanitizedUrl(sanitizedUrl) {
	let file;
	let args;
	if (process.platform == "win32") {
		file = "rundll32.exe";
		args = ["url.dll,OpenURL", sanitizedUrl];
	} else if (process.platform == "darwin") {
		file = "open";
		args = [sanitizedUrl];
	} else {
		file = "xdg-open";
		args = [sanitizedUrl];
	}
	spawn(file, args, {
		shell: false,
		detached: true,
		stdio: "ignore",
	}).unref();
}

const allowedChars = new Set("!#$&'()*+,-./0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]_abcdefghijklmnopqrstuvwxyz~");

/**
 * @param {string} char
 */
function isHexChar(char) {
	return /^[0-9A-Fa-f]$/.test(char);
}

/**
 * @param {string} urlStr
 */
function sanitizeUrl(urlStr) {
	let url;
	try {
		url = new URL(urlStr);
	} catch {
		throw new Error(`"${urlStr}" is not a valid url`);
	}

	if (url.protocol != "http:" && url.protocol != "https:") {
		throw new Error("Only http: or https: urls may be opened");
	}

	let escaped = "";
	for (let i = 0; i < urlStr.length; i++) {
		const char = urlStr[i];

		if (char === "%" && i + 2 < urlStr.length && isHexChar(urlStr[i + 1]) && isHexChar(urlStr[i + 2])) {
			escaped += char + urlStr[i + 1] + urlStr[i + 2];
			i += 2;
			continue;
		}

		if (allowedChars.has(char)) {
			escaped += char;
		} else {
			const utf8Bytes = new TextEncoder().encode(char);
			for (const byte of utf8Bytes) {
				escaped += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
			}
		}
	}
	return escaped;
}
