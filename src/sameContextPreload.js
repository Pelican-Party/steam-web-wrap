// By default, electron executes the preload script in an isolated context.
// However, we want to make some modifications to browser apis such as document.exitFullScreen()
// This script is executed within the same context as the browser process.
// At the moment this is fired when the document is ready since I haven't found a way
// to run this before any other scripts on the page yet.

(() => {
	const originalExitFullscreen = document.exitFullscreen;
	Object.defineProperty(document, "exitFullscreen", {
		configurable: true,
		writable: true,
		value: async () => {
			if (_steamWebWrapInternal.getFullscreenState()) {
				await _steamWebWrapInternal.exitFullScreen();
			}
			return originalExitFullscreen.call(document);
		},
	});

	const originalGetFullscreenElement = Object.getOwnPropertyDescriptor(Document.prototype, "fullscreenElement").get;

	Object.defineProperty(document, "fullscreenElement", {
		configurable: true,
		get: () => {
			const original = originalGetFullscreenElement.call(document);
			if (original) return original;
			if (_steamWebWrapInternal.getFullscreenState()) {
				return document.body;
			}
			return null;
		},
	});
})();

// Since `webContents.executeJavaScript()` is used to run all of this,
// the last line determines what will be sent back to the main process.
// If we don't exclude this, we might accidentally try to send back
// an object wich can't be cloned, causing the application to crash.
void 0;
