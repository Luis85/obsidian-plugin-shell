/** Keep persistent project policy, not npm run's forwarded one-off approval list.
 * npm treats npm_config_allow_scripts as CLI policy and rejects it in npm ci.
 * See npm/cli#9912. Never change the parent environment or strip other config.
 */
export function projectInstallEnvironment(source = process.env) {
  const env = { ...source };
  const removedKeys = [];
  for (const key of Object.keys(env)) {
    if (key.toLowerCase().replaceAll('-', '_') === 'npm_config_allow_scripts') {
      delete env[key];
      removedKeys.push(key);
    }
  }
  return { env, removedKeys };
}
