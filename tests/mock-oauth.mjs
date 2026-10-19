import assert from 'node:assert/strict';
import axios from 'axios';

let requests = 0;
let refreshes = 0;

// Intercept every request before the server creates its Axios instance.
// No test request can reach Home Connect or operate an appliance.
axios.defaults.adapter = async config => {
  const reply = data => ({ status: 200, statusText: 'OK', headers: {}, config, data });
  if (config.url === 'https://api.home-connect.com/security/oauth/token') {
    assert.equal(config.method, 'post');
    assert.equal(config.headers.get('Content-Type'), 'application/x-www-form-urlencoded');
    const form = new URLSearchParams(config.data);
    assert.deepEqual(Object.fromEntries(form), {
      grant_type: 'refresh_token',
      refresh_token: `refresh+token&${refreshes}`,
      client_id: 'synthetic client+id',
      client_secret: 'synthetic+secret&value',
    });
    refreshes++;
    return reply({ access_token: `access-${refreshes}`, refresh_token: `refresh+token&${refreshes}` });
  }

  assert.equal(config.baseURL, 'https://api.home-connect.com/api');
  assert.equal(config.url, '/homeappliances');
  assert.equal(config.method, 'get');
  requests++;
  if (requests % 2 === 1) {
    const error = new Error('Request failed with status code 401');
    error.response = { status: 401 };
    throw error;
  }
  assert.equal(refreshes, requests / 2);
  assert.equal(config.headers.Authorization, `Bearer access-${refreshes}`);
  return reply({ cycle: refreshes });
};
