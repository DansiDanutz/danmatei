const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: path.resolve(projectRoot, "tailwind.config.js"),
});
