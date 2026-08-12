// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Native-only packages that ship no web build, mapped to web implementations.
const webAliases = {
  "react-native-pager-view": path.resolve(__dirname, "src/web/pager-view.tsx"),
  "@react-native-segmented-control/segmented-control": path.resolve(
    __dirname,
    "src/web/segmented-control.tsx",
  ),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && webAliases[moduleName]) {
    return { type: "sourceFile", filePath: webAliases[moduleName] };
  }

  const resolve = defaultResolveRequest ?? context.resolveRequest;
  return resolve(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
