const { contextBridge, ipcRenderer } = require("electron");

// This object is deprecated, use window.close() instead
contextBridge.exposeInMainWorld("steamWebWrap", {
	quitApp: () => ipcRenderer.invoke("quitApp"),
});

let fullscreenState = false;

contextBridge.exposeInMainWorld("_steamWebWrapInternal", {
	exitFullScreen: () => ipcRenderer.invoke("exitFullScreen"),
	setFullscreenState: (state) => {
		fullscreenState = state;
	},
	getFullscreenState: () => fullscreenState,
	quitApp: () => ipcRenderer.invoke("quitApp"),
});
