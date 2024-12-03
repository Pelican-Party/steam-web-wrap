const path = require("node:path");
const fs = require("node:fs/promises");

class ConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = "ConfigError";
	}
}
exports.ConfigError = ConfigError;

/**
 * @typedef WebWrapConfg
 * @property {string} url
 * @property {boolean} fullscreen
 */

/**
 * @param {Electron.App} app
 */
async function loadConfig(app) {
	/**
	 * @type {WebWrapConfg}
	 */
	const defaults = {
		url: "",
		fullscreen: true,
	};
	const configPath = path.join(app.getAppPath(), "config.json");
	let contents;
	try {
		contents = await fs.readFile(configPath, { encoding: "utf8" });
	} catch (e) {
		if (e.code == "ENOENT") {
			throw new ConfigError(`No config file was found at ${configPath}`);
		}
	}

	let json;
	try {
		json = JSON.parse(contents);
	} catch (e) {
		if (e instanceof SyntaxError) {
			throw new ConfigError(`${configPath} contains a syntax error.`);
		}
	}

	const result = /** @type {WebWrapConfg} */ ({
		...defaults,
		...json,
	});
	if (!result.url) {
		throw new ConfigError("No url was configured in the config.json");
	}
	return result;
}
exports.loadConfig = loadConfig;
