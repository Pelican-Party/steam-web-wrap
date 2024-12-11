import { packager } from "@electron/packager";
import path from "node:path";
import fs from "node:fs/promises";
import { zip } from "cross-zip";
import { promisify } from "node:util";

const platform = process.argv[2];

let packagerPlatform;
if (platform == "linux") {
	packagerPlatform = "linux";
} else if (platform == "windows") {
	packagerPlatform = "win32";
} else {
	console.error("invalid platform: " + platform);
	process.exit(1);
}

const outDir = path.resolve(import.meta.dirname, "../out");
const platformParentDir = path.resolve(outDir, platform);
const buildOutDir = path.resolve(platformParentDir, "steam-web-wrap");
const zipPath = path.resolve(outDir, platform + ".zip");

try {
	await fs.rm(buildOutDir, { recursive: true });
} catch (e) {
	if (e.code == "ENOENT") {
		// already deleted
	} else {
		throw e;
	}
}

const appPaths = await packager({
	dir: path.resolve(import.meta.dirname, ".."),
	platform: packagerPlatform,
	arch: "x64",
	overwrite: true,
	out: platformParentDir,
	ignore: [/^\/\.gitignore$/gi, /^\/\.gitattributes$/gi, /^\/\.prettierrc$/gi, /^\/out$/gi, /^\/scripts$/gi],
});

if (appPaths.length != 1) {
	throw new Error("Assertion failed, expected a single path");
}
await fs.rename(appPaths[0], buildOutDir);

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
if (platform == "linux") {
	const script = `#!/bin/bash\n"\${BASH_SOURCE%/*}"/steam-web-wrap --no-sandbox "$@"`;
	const scriptPath = path.join(buildOutDir, "launch.sh");
	await fs.writeFile(scriptPath, script);
	await fs.chmod(scriptPath, 0o755);
} else if (platform == "windows") {
	// For windows, we don't need to disable the sandbox, but it's still nice
	// to keep the name of the main entry point consistent.
	const oldPath = path.join(buildOutDir, "steam-web-wrap.exe");
	const newPath = path.join(buildOutDir, "launch.exe");
	await fs.rename(oldPath, newPath);
}

await promisify(zip)(buildOutDir, zipPath);
