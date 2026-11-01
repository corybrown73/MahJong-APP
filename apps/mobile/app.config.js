// Dynamic layer over app.json. One thing changes between builds: where the web
// build is served. At a domain root it needs no base path; on GitHub Pages it
// lives under /<repo-name>. Set EXPO_BASE_URL for that build only.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL?.replace(/\/+$/, '') || undefined;
  return {
    ...config,
    experiments: { ...config.experiments, ...(baseUrl ? { baseUrl } : {}) },
  };
};
