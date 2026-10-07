import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectInstallEnvironment } from '../platform/npm-install.mjs';

test('[NPM-01] remove only forwarded approval keys across Windows casing', () => {
  const source = Object.freeze({ npm_config_allow_scripts: 'unreviewed',
    NPM_CONFIG_ALLOW_SCRIPTS: 'other', 'npm_config_allow-scripts': 'third',
    npm_config_ignore_scripts: 'true', npm_config_strict_allow_scripts: 'true',
    npm_config_registry: 'https://registry.example.test/', npm_config_proxy: 'local-proxy',
    npm_config_userconfig: 'C:\\Users\\Test User\\.npmrc', NODE_EXTRA_CA_CERTS: 'owned.pem',
    NPM_CONFIG_STRICT_SSL: 'true', npm_config_allow_scripts_pin: 'true',
    npm_execpath: 'C:\\tools with spaces\\npm-cli.js', PATH: 'kept', NPM_TOKEN: 'fixture-not-a-secret' });
  const result = projectInstallEnvironment(source);
  assert.equal(result.removedKeys.length, 3);
  const expected = { ...source };
  delete expected.npm_config_allow_scripts; delete expected.NPM_CONFIG_ALLOW_SCRIPTS;
  delete expected['npm_config_allow-scripts'];
  assert.deepEqual(result.env, expected);
  assert.equal(source.npm_config_allow_scripts, 'unreviewed');
  assert.equal(result.env.npm_config_ignore_scripts, 'true');
});

test('[NPM-02] no-policy and empty-value inputs are deterministic nonmutating copies', () => {
  const source = Object.freeze({ PATH: 'kept' });
  const result = projectInstallEnvironment(source);
  assert.deepEqual(result, { env: { PATH: 'kept' }, removedKeys: [] });
  assert.notEqual(result.env, source);
  assert.deepEqual(projectInstallEnvironment({ npm_config_allow_scripts: '' }).env, {});
});
