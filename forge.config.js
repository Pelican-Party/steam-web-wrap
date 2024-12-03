module.exports = {
	packagerConfig: {
		ignore: [/^\/\.gitignore$/gi, /^\/\.prettierrc$/gi, /^\/config\.json$/gi, /^\/forge\.config\.js$/gi],
	},
	makers: [
		{
			name: "@electron-forge/maker-zip",
		},
	],
};
