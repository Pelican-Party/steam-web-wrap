// By default, electron executes the preload script in an isolated context.
// However, we want to make some modifications to browser apis such as document.exitFullScreen()
// This script is executed within the same context as the browser process.
// At the moment this is executed right after the browser window is created,
// although I'm not sure whether it is guaranteed that this script runs before
// any scripts of the page itself.

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

	window.close = () => {
		_steamWebWrapInternal.quitApp();
	};
})();
