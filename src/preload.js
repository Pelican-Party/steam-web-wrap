const { contextBridge, internalContextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steamWebWrap", {
	closeApp: () => ipcRenderer.invoke("closeApp"),
});

let fullscreenState = false;

contextBridge.exposeInMainWorld("_steamWebWrapInternal", {
	exitFullScreen: () => ipcRenderer.invoke("exitFullScreen"),
	setFullscreenState: (state) => {
		fullscreenState = state;
	},
	getFullscreenState: () => fullscreenState,
});
