import assert from 'node:assert/strict';
import axios from 'axios';

// Replace every Axios request before the server creates its API client.
// Unknown requests fail closed; no test may contact Home Connect.
axios.defaults.adapter = async config => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const request = { method: config.method, url: config.url, data };
  const routes = {
    '/homeappliances': 'get',
    '/homeappliances/demo/status': 'get',
    '/homeappliances/demo/programs': 'get',
    '/homeappliances/demo/settings': 'get',
    '/homeappliances/demo/programs/active': ['put', 'delete'],
    '/homeappliances/demo/settings/setting': 'put',
  };
  assert.ok([routes[config.url]].flat().includes(config.method), 'Unexpected HTTP request');
  assert.equal(config.baseURL, 'https://api.home-connect.com/api');
  assert.equal(config.headers.Authorization, 'Bearer synthetic-access-token');
  if (config.method === 'put') {
    const expected = config.url.endsWith('/programs/active')
      ? { data: { key: 'program', options: { temperature: 40 } } }
      : { data: { key: 'setting', value: false } };
    assert.deepEqual(data, expected);
  }
  return { status: 200, statusText: 'OK', headers: {}, config, data: { request } };
};
