const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steamWebWrap", {
	closeApp: () => ipcRenderer.invoke("closeApp"),
});
