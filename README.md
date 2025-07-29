# Steam Web Wrap

Steam Web Wrap is a prebuilt application which you can use to publish web games to steam with very minimal configuration required.

## What this is

- A prebuilt [Electron](https://www.electronjs.org/) application which can directly be uploaded to Steamworks without modifications
- Has Chromium bundled with the application (rather than using the webview of the OS) for predictable results
- Supports both Windows and Linux builds
- Built-in fixes and modifications to make your game play nice when launched through Steam
    - Steam Overlay is supported
    - Applications launch in full screen by default
    - Fixes have been made to make the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API) work when launched through Steam
    - Fixes have been made to make sure applications can be launched with the [Steam Linux Runtime](https://gitlab.steamos.cloud/steamrt/steam-runtime-tools/-/blob/main/docs/slr-for-game-developers.md)
- Loads your online game from an URL provided by you (loading from local files may be added later)
- Existing browser APIs are reused as much as possible in order to make porting existing games easier
- Extra functionality is exposed through the `steamWebWrap` object such as `steamWebWrap.quitApp()`

## What this isn't

- A highly configurable and programmable way to control Chromium (just use Electron if this is what you're after)
- A way to bundle 'software' (it is generally assumed that your webpage is a game)
- A way to publish your game to anything other than Steam
- A lightweight application that uses the OS webview (builds are ~280MB on disk and ~90MB to download)
- macOS builds are not supported (yet) due to the notarization requirement

## Getting Started

To get started quickly, download the latest version for your platform from [the releases page](https://github.com/Pelican-Party/steam-web-wrap/releases). Once extracted, launch it from the command line using:

```
.\steam-web-wrap\launch.exe --url=https://steam-web-wrap-demo.deno.dev/
```

or on linux:

```
./steam-web-wrap/launch.sh --url=https://steam-web-wrap-demo.deno.dev/
```

You may also use the url of one of your favorite web games.

For more info on how to develop your game, head over to the [GitHub wiki pages](https://github.com/Pelican-Party/steam-web-wrap/wiki/Usage).

## Publishing to Steam

The great news is that for the most part you can just directly upload the [zip files from the releases page](https://github.com/Pelican-Party/steam-web-wrap/releases/) to Steam, no building needed!

As with any game though, you will need to configure your game a fair bit on Steam's dashboard. We have extensive documentation on how to do this on our [GitHub wiki pages](https://github.com/Pelican-Party/steam-web-wrap/wiki/Uploading-to-Steam).
