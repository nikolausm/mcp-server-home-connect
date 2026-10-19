import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = fileURLToPath(new URL('./mock-home-connect.mjs', import.meta.url));

async function withServer(run, mockFixture = fixture, env = {}) {
  const client = new Client({ name: 'home-connect-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', mockFixture, 'build/index.js'],
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME_CONNECT_CLIENT_ID: 'synthetic-client',
      HOME_CONNECT_ACCESS_TOKEN: 'synthetic-access-token',
      ...env,
    },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close();
  }
}

test('stdio initializes and preserves all eight tool contracts', { timeout: 10000 }, async () => {
  await withServer(async client => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), [
      'get_appliances', 'get_appliance_status', 'get_appliance_programs',
      'start_program', 'stop_program', 'get_settings', 'update_setting', 'get_auth_url',
    ]);
    const required = {
      get_appliances: [], get_auth_url: [],
      get_appliance_status: ['haId'], get_appliance_programs: ['haId'],
      get_settings: ['haId'], stop_program: ['haId'],
      start_program: ['haId', 'programKey'], update_setting: ['haId', 'settingKey', 'value'],
    };
    for (const tool of tools) assert.deepEqual(tool.inputSchema.required ?? [], required[tool.name]);
  });
});

test('refresh uses encoded form data and rotates tokens without replaying requests', { timeout: 10000 }, async () => {
  const oauthFixture = fileURLToPath(new URL('./mock-oauth.mjs', import.meta.url));
  await withServer(async client => {
    for (let cycle = 1; cycle <= 2; cycle++) {
      await assert.rejects(
        client.callTool({ name: 'get_appliances', arguments: {} }),
        /Token refreshed, please retry the request/,
      );
      const result = await client.callTool({ name: 'get_appliances', arguments: {} });
      assert.deepEqual(JSON.parse(result.content[0].text), { cycle });
    }
  }, oauthFixture, {
    HOME_CONNECT_CLIENT_ID: 'synthetic client+id',
    HOME_CONNECT_CLIENT_SECRET: 'synthetic+secret&value',
    HOME_CONNECT_REFRESH_TOKEN: 'refresh+token&0',
  });
});

test('all tools dispatch through the protocol without live API or appliance actions', { timeout: 10000 }, async () => {
  await withServer(async client => {
    for (const name of ['get_appliances', 'get_appliance_status', 'get_appliance_programs', 'get_settings']) {
      const result = await client.callTool({ name, arguments: { haId: 'demo' } });
      assert.equal(result.isError, undefined);
      const response = JSON.parse(result.content[0].text);
      assert.equal(response.request.method, 'get');
    }
    for (const [name, args, expected] of [
      ['start_program', { haId: 'demo', programKey: 'program', options: { temperature: 40 } }, 'Program program started successfully'],
      ['stop_program', { haId: 'demo' }, 'Program stopped successfully'],
      ['update_setting', { haId: 'demo', settingKey: 'setting', value: false }, 'Setting setting updated successfully'],
    ]) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.content[0].text, expected);
    }
    const auth = await client.callTool({ name: 'get_auth_url', arguments: {} });
    assert.match(auth.content[0].text, /client_id=synthetic-client&response_type=code/);
  });
});

test('unknown tools fail and unexpected API routes never dial out', { timeout: 10000 }, async () => {
  await withServer(async client => {
    await assert.rejects(client.callTool({ name: 'unknown', arguments: {} }), /Unknown tool/);
    await assert.rejects(client.callTool({ name: 'get_appliance_status', arguments: { haId: 'unexpected' } }), /Unexpected HTTP request/);
  });
});
