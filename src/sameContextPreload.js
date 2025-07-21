// By default, electron executes the preload script in an isolated context.
// However, we want to make some modifications to browser apis such as document.exitFullScreen()
// This script is executed within the same context as the browser process.
// This is done by creating a new <script> element from the preload script and injecting
// it into the page. This should make sure it runs before any other scripts on the page.

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

	const originalGetFullscreenElement = Object.getOwnPropertyDescriptor(Document.prototype, "fullscreenElement")?.get;

	Object.defineProperty(document, "fullscreenElement", {
		configurable: true,
		get: () => {
			const original = originalGetFullscreenElement?.call(document);
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

	/**
	 * @param {{}} target
	 * @param {string[]} path
	 * @param {any} propValues
	 */
	async function populateSteamworksProps(target, path, propValues) {
		if (!_steamWebWrapInternal.debug) return;

		const props = await _steamWebWrapInternal.getSteamworksProps(path);
		for (const prop of props) {
			Object.defineProperty(target, prop, {
				configurable: true,
				value: propValues,
			});
		}
	}

	/** @type {Map<string, {}>} */
	const createdInterfaceProxies = new Map();

	/** @type {Map<number, CallbackHandle>} */
	const createdCallbackHandles = new Map();
	/** @type {Map<number, (...args: unknown[]) => void>} */
	const createdCallbacks = new Map();
	let lastCallbackId = 0;
	class CallbackHandle {
		#id;

		/**
		 * @param {number} id
		 */
		constructor(id) {
			this.#id = id;
		}

		disconnect() {
			_steamWebWrapInternal.disconnectSteamworksCallback(this.#id);
			createdCallbacks.delete(this.#id);
		}
	}

	_steamWebWrapInternal.onSteamworksCallbackFired((id, args) => {
		const callback = createdCallbacks.get(id);
		if (!callback) return;
		callback(...args);
	});

	/**
	 * @param {string} interfaceProperty
	 */
	function createInterface(interfaceProperty) {
		if (interfaceProperty == "callback") {
			/** @type {Object.<string, string>} */
			const callbackTypesTarget = {};
			populateSteamworksProps(callbackTypesTarget, ["callback", "SteamCallback"], "");
			return {
				Handle: CallbackHandle,
				SteamCallback: new Proxy(callbackTypesTarget, {
					get(_target, property) {
						if (typeof property == "symbol") return;
						callbackTypesTarget[property] = property;
						return property;
					}
				}),
				/**
				 * @param {string} steamCallback
				 * @param {() => void} handler
				 */
				register(steamCallback, handler) {
					lastCallbackId++;
					const handle = new CallbackHandle(lastCallbackId);
					createdCallbackHandles.set(lastCallbackId, handle);
					createdCallbacks.set(lastCallbackId, handler);
					_steamWebWrapInternal.registerSteamworksCallback(steamCallback, lastCallbackId);
					return handle;
				}
			}
		}
		const interfaceTarget = {};
		const interfaceProxy = new Proxy(interfaceTarget, {
			get(_target, property) {
				if (typeof property == "symbol") return;

				/**
				 * @param  {...unknown[]} args
				 */
				const fn = async function(...args) {
					const result = await _steamWebWrapInternal.steamworksCall({
						interface: interfaceProperty,
						method: property,
						args,
					});
					return result;
				}
				return fn;
			}
		});
		populateSteamworksProps(interfaceTarget, [interfaceProperty], () => {});
		return interfaceProxy;
	}

	const steamworksTarget = {};
	const steamworksProxy = new Proxy(steamworksTarget, {
		get(_target, interfaceProperty) {
			if (typeof interfaceProperty == "symbol") return;

			let interfaceProxy = createdInterfaceProxies.get(interfaceProperty);
			if (interfaceProxy) return interfaceProxy;

			interfaceProxy = createInterface(interfaceProperty);
			createdInterfaceProxies.set(interfaceProperty, interfaceProxy);
			Object.defineProperty(steamworksTarget, interfaceProperty, {
				get: () => interfaceProxy,
			});
			return interfaceProxy;
		}
	});

	let didShowWarning = false;
	Object.defineProperty(globalThis, "steamworks", {
		get() {
			const message = _steamWebWrapInternal.steamNotInitializedWarningMessage;
			if (message) {
				if (!didShowWarning) {
					didShowWarning = true;
					console.warn(message);
				}
				return null;
			}

			return steamworksProxy;
		}
	})

	populateSteamworksProps(steamworksTarget, [], {});
})();
