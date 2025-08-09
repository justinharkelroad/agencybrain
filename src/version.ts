declare const __BUILD_TIME__: string | undefined;
declare const __APP_VERSION__: string | undefined;

export const appVersion: string = typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
  ? __APP_VERSION__
  : "dev";

export const buildTime: string = typeof __BUILD_TIME__ !== "undefined" && __BUILD_TIME__
  ? __BUILD_TIME__
  : new Date().toISOString();

export const versionLabel = `${appVersion} • ${new Date(buildTime).toLocaleString()}`;
