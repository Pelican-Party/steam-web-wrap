import { SteamworksCall } from "./steamworksCalls.js";

declare global {
	var _steamWebWrapInternal: {
		debug: boolean;
		steamNotInitializedWarningMessage: string | null;
		steamworksEnums: (typeof import("./steamworksEnums.cjs"))["enums"];
		getFullscreenState(): boolean;
		exitFullScreen(): Promise<void>;
		quitApp(): void;
		steamworksCall(call: SteamworksCall): Promise<void>;
		getSteamworksProps(path: string[]): Promise<string[]>;
		registerSteamworksCallback(steamCallback: string, id: number): Promise<void>;
		disconnectSteamworksCallback(id: number): Promise<void>;
		onSteamworksCallbackFired(cb: (id: number, args: unknown[]) => void): Promise<void>;
	};

	var steamworks: {};
}
