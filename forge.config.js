const path = require("node:path");
const fs = require("node:fs/promises");

module.exports = {
	packagerConfig: {
		ignore: [
			/^\/\.gitignore$/gi,
			/^\/\.gitattributes$/gi,
			/^\/\.prettierrc$/gi,
			/^\/config\.json$/gi,
			/^\/forge\.config\.js$/gi,
		],
	},
	makers: [
		{
			name: "@electron-forge/maker-zip",
		},
	],
	hooks: {
		postPackage: async (forgeConfig, options) => {
			if (options.platform == "linux") {
				// Electron apps run fine when launched directly, but it seems like with the steam linux runtime enabled
				// (i.e. when launching through steam) it takes a good minute or so for the app to launch.
				// Disabling the sandbox seems to fix this. I'm not happy about this,
				// especially since we'reloading remote content, but I haven't been able to find a better solution unfortunately.

				// Electron has no way to programatically disable the sandbox globally,
				// the only option is to launch the electron app with --no-sandbox.
				// To avoid developers having to configure this flag in the steamworks settings page,
				// we'll create a launch.sh file which runs steam-web-wrap with the --no-sandbox flag.
				// This has the benefit that we'll be able to edit the launch flags in an update
				// without having to ask developers to modify their steamworks settings.
				const script = `#!/bin/bash\n"\${BASH_SOURCE%/*}"/steam-web-wrap --no-sandbox "$@"`;
				const scriptPath = path.join(options.outputPaths[0], "launch.sh");
				await fs.writeFile(scriptPath, script);
				await fs.chmod(scriptPath, 0o755);
			}
		},
	},
};
