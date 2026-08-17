// Metro needs to know about the monorepo: engine and ai are workspace source,
// not published packages, so it has to watch and resolve outside apps/mobile.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// The engine and the AI are written as Node-ESM-correct TypeScript: relative
// imports carry a `.js` extension so the same source can run unbundled on a
// server later. Metro does not do that mapping itself, so do it here rather
// than compromise the packages.
const packagesRoot = path.resolve(workspaceRoot, 'packages');
const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath?.startsWith(packagesRoot)
  ) {
    return resolve(context, moduleName.slice(0, -'.js'.length), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
