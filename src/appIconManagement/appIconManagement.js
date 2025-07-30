import { BrowserWindow, ipcMain, nativeImage } from "electron";
import { logConsoleMessage } from "../logConsoleMessage.js";

/**
 * Set to true when you are working on this file. It will make the browser window in which the
 * icons are rendered visible.
 */
const DEBUG_ICONS = false;

let lastRequestId = 0;

/**
 * @typedef OnResultCallback
 * @property {(result: import("./renderIcon.js").RenderIconResult) => void} resolve
 * @property {(error: Error) => void} reject
 */
/** @type {Map<number, OnResultCallback>} */
const onResultCbs = new Map();

/**
 * @param {Electron.BrowserWindow} mainWindow
 */
export function initIconManagement(mainWindow) {
	ipcMain.on("render-icon-result", (_event, requestId, result) => {
		const castResult = /** @type {import("./renderIcon.js").RenderIconResponse} */ (result);
		const cb = onResultCbs.get(requestId);
		if (cb) {
			if (castResult.type == "error") {
				cb.reject(new Error(castResult.message));
			} else {
				cb.resolve(castResult.result);
			}
		}
	});

	mainWindow.webContents.on("page-favicon-updated", async (_event, iconUrls) => {
		const iconRendererWindow = new BrowserWindow({
			show: DEBUG_ICONS,
			autoHideMenuBar: !DEBUG_ICONS,
			webPreferences: {
				offscreen: !DEBUG_ICONS,
				nodeIntegration: true,
				contextIsolation: false,
			},
		});
		await iconRendererWindow.loadFile("src/appIconManagement/renderer.html");
		if (DEBUG_ICONS) {
			iconRendererWindow.webContents.openDevTools();
		}

		try {
			await applyIcons(mainWindow, iconRendererWindow, iconUrls);
		} finally {
			if (!DEBUG_ICONS) {
				iconRendererWindow.destroy();
			}
		}
	});
}

/**
 * @param {BrowserWindow} mainWindow
 * @param {BrowserWindow} iconRendererWindow
 * @param {string[]} iconUrls
 */
async function applyIcons(mainWindow, iconRendererWindow, iconUrls) {
	/**
	 * @param {import("./renderIcon.js").RenderIconOptions} options
	 */
	async function renderIcon(options) {
		const requestId = ++lastRequestId;
		/** @type {Promise<import("./renderIcon.js").RenderIconResult>} */
		const resultPromise = new Promise((resolve, reject) => {
			onResultCbs.set(requestId, { resolve, reject });
		});
		iconRendererWindow.webContents.send("render-icon", {
			requestId,
			options,
		});
		return await resultPromise;
	}

	const image = nativeImage.createEmpty();

	/**
	 * @param {import("./renderIcon.js").RenderIconOptions} options
	 */
	async function renderAndAddRepresentation(options) {
		const result = await renderIcon(options);
		if (result) {
			image.addRepresentation({
				buffer: Buffer.from(new Uint8Array(result.buffer)),
				width: result.size,
				height: result.size,
			});
		}
		return result;
	}

	const responsePromises = iconUrls.map((url) => {
		return (async () => {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch favicon at ${url}. The server responded with a ${response.status} status code.`,
				);
			}
			const contentType = response.headers.get("Content-Type") || "";
			return {
				contentType,
				buffer: await response.arrayBuffer(),
			};
		})();
	});

	/** @type {{resource: string, message: string}[]} */
	const errorMessages = [];
	/**
	 * @param {string} resource
	 * @param {unknown} error
	 */
	function collectErrorMessage(resource, error) {
		if (error instanceof Error) {
			errorMessages.push({ resource, message: error.message });
		} else {
			errorMessages.push({ resource, message: String(error) });
		}
	}

	const responses = [];
	for (const [i, promiseResult] of (await Promise.allSettled(responsePromises)).entries()) {
		if (promiseResult.status == "fulfilled") {
			responses.push(promiseResult.value);
		} else {
			collectErrorMessage(iconUrls[i], promiseResult.reason);
		}
	}

	let svgUrl = null;
	let svgResponse = null;
	const nonSvgUrls = [];
	const nonSvgResponses = [];
	for (const [i, response] of responses.entries()) {
		if (response.contentType == "image/svg+xml") {
			svgUrl = iconUrls[i];
			svgResponse = response;
		} else {
			nonSvgUrls.push(iconUrls[i]);
			nonSvgResponses.push(response);
		}
	}

	let anyImageRendered = false;
	const requiredSvgSizes = new Set([16, 24, 32, 48, 64, 128, 256]);

	// First we add all non svg images
	const nonSvgPromises = [];
	for (const [i, response] of nonSvgResponses.entries()) {
		nonSvgPromises.push(
			(async () => {
				try {
					const result = await renderAndAddRepresentation(response);
					requiredSvgSizes.delete(result.size);
					anyImageRendered = true;
				} catch (error) {
					collectErrorMessage(nonSvgUrls[i], error);
				}
			})(),
		);
	}
	await Promise.all(nonSvgPromises);

	// Then, if an svg response was found, we will fill in any missing resolutions using this svg.
	// We do this because if the resolution of an image is higher than what it is used for, it will appear aliased
	// in certain situations.
	const svgPromises = [];
	if (svgUrl && svgResponse) {
		for (const size of requiredSvgSizes) {
			svgPromises.push(
				(async () => {
					try {
						await renderAndAddRepresentation({
							contentType: svgResponse.contentType,
							buffer: svgResponse.buffer,
							forceSize: size,
						});
						anyImageRendered = true;
					} catch (error) {
						collectErrorMessage(`${svgUrl} rendered at ${size}x${size}`, error);
					}
				})(),
			);
		}
	}
	await Promise.all(svgPromises);

	if (!anyImageRendered) {
		const formattedMessages = errorMessages.map((message) => {
			return `${message.resource}\n\t${message.message}`;
		});
		logConsoleMessage(
			mainWindow,
			"warn",
			`Failed to create an icon for the application. The following errors were encountered:\n\n${formattedMessages.join("\n\n")}`,
		);
	} else {
		mainWindow.setIcon(image);
	}
}
