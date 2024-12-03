const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steamWebWrap", {
	close: () => ipcRenderer.invoke("close"),
});
