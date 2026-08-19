const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite uses its bundled WebAssembly build on web.
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
