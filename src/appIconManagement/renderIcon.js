const { ipcRenderer } = require("electron");

/**
 * @typedef RenderIconResult
 * @property {ArrayBuffer} buffer
 * @property {number} size
 */
/**
 * @typedef {RenderIconSuccessResponse | RenderIconErrorResponse} RenderIconResponse
 */
/**
 * @typedef RenderIconSuccessResponse
 * @property {"success"} type
 * @property {RenderIconResult} result
 */
/**
 * @typedef RenderIconErrorResponse
 * @property {"error"} type
 * @property {string} message
 */

/**
 * @typedef RenderIconOptions
 * @property {ArrayBuffer} buffer
 * @property {string} contentType
 * @property {number} [forceSize]
 */

/**
 * @param {RenderIconOptions} options
 * @returns {Promise<RenderIconResult>}
 */
async function renderIcon({ buffer, contentType, forceSize }) {
	const inputBlob = new Blob([buffer], {
		type: contentType || "",
	});
	const img = new Image();
	img.src = URL.createObjectURL(inputBlob);

	/** @type {Promise<void>} */
	const imageLoadPromise = new Promise((resolve, reject) => {
		img.addEventListener(
			"load",
			() => {
				resolve();
			},
			{ once: true },
		);
		img.addEventListener("error", () => {
			reject(new Error("Image failed to load"));
		});
	});
	await imageLoadPromise;

	const size = forceSize || Math.max(img.width, img.height);

	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	document.body.append(canvas);
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to create canvas 2d rendering context");
	}
	ctx.drawImage(img, 0, 0, size, size);

	/** @type {Blob?} */
	const renderedBlob = await new Promise((resolve) => {
		canvas.toBlob(resolve, "image/png", 1);
	});
	if (!renderedBlob) {
		throw new Error("Failed to encode canvas to blob");
	}

	return {
		buffer: await renderedBlob.arrayBuffer(),
		size,
	};
}

ipcRenderer.on("render-icon", async (event, data) => {
	/**
	 * @param {RenderIconResponse} result
	 */
	function sendResult(result) {
		event.sender.send("render-icon-result", data.requestId, result);
	}
	try {
		const result = await renderIcon(data.options);
		sendResult({
			type: "success",
			result,
		});
	} catch (error) {
		let message = "An unknown error occurred while rendering the icon.";
		if (error instanceof Error) {
			message = error.message;
		}
		sendResult({
			type: "error",
			message,
		});
	}
});
