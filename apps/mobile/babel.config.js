module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo adds the worklets plugin for Reanimated 4 automatically.
  return { presets: ['babel-preset-expo'] };
};
