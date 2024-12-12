# Steam Web Wrap

Steam web wrap is a prebuilt application which you can use to publish web games to steam with very minimal configuration required.

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

## Usage

### Launching the Application

At the moment, only online pages can be run using Steam Web Wrap, so the first step is to make sure your game is published online somewhere. If you haven't done this yet, you may also use https://steam-web-wrap-demo.deno.dev/ for experimentation.

To get started, you can download the latest build from [the releases page](https://github.com/Pelican-Party/steam-web-wrap/releases). Once downloaded and extracted, you can run the application and provide an url through the command line.

On Windows:

```
.\steam-web-wrap\launch.exe --url=https://steam-web-wrap-demo.deno.dev/
```

On Linux:

```
./steam-web-wrap/launch.sh --url=https://steam-web-wrap-demo.deno.dev/
```

Additional command line flags include:

- `--no-fullscreen` to launch the application in windowed mode
- `--show-debug-menu` to include a 'Debug' menu (next to File, Edit, Window) that allows you to reload the page and show DevTools

### Toggling Fullscreen Programmatically

You can use the [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) like you normally would:

```js
if (!document.fullscreenElement) {
	await document.body.requestFullscreen();
} else {
	await document.exitFullscreen();
}
```

Pages running in a browser don't normally start in fullscreen. But pages launched in steam web wrap do. To adjust for this, the `document.fullscreenElement` is initially set to the `<body>` of the page. That way you can use this to update the UI of any fullscreen setting you might have.

> [!NOTE]
> The fullscreen state is not maintained across sessions at the moment.

### Giving Users a Way to Exit Your Game

In a browser, users can close your page at any time. But since steam web wrap launches games in full screen by default, it might be difficult for users to find out how to close your game.

Even though they can still close the game through the steam overlay or by using shortcuts like `Alt` + `F4` or `Command` + `W`, you might want to add an exit button in your menu somewhere. You can close the game by calling `quitApp()`:

```js
steamWebWrap.quitApp();
```
