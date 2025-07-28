import { Menu } from "electron/main";

/**
 * @param {boolean} enableDebugMenu
 */
export function buildMenu(enableDebugMenu) {
	/** @type {import("electron").MenuItemConstructorOptions[]} */
	const template = [];

	const isMac = process.platform == "darwin";

	if (isMac) template.push({ role: "appMenu" });

	template.push({ role: "fileMenu" }, { role: "editMenu" }, { role: "windowMenu" });

	if (enableDebugMenu) {
		template.push({
			label: "Debug",
			submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }],
		});
	}

	if (isMac) template.push({ role: "help" });

	const menu = Menu.buildFromTemplate(template);
	return menu;
}
