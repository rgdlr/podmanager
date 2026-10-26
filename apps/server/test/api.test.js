const assert = require('assert');
const app = require('../src/app');

async function runTests() {
  console.log('🧪 Starting Podmanager backend sanity tests...');

  // Start test server on random port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test Static files
    console.log('Checking GET / ...');
    const indexRes = await fetch(`${baseUrl}/`);
    assert.strictEqual(indexRes.status, 200);
    const htmlText = await indexRes.text();
    assert.ok(htmlText.includes('Podmanager'), 'Index HTML should contain title');

    // 2. Test /api/system/info
    console.log('Checking GET /api/system/info ...');
    const sysRes = await fetch(`${baseUrl}/api/system/info`);
    assert.strictEqual(sysRes.status, 200);
    const sysJson = await sysRes.json();
    assert.strictEqual(sysJson.success, true);
    assert.ok(sysJson.data.host, 'System info should have host');
    assert.ok(sysJson.data.version, 'System info should have version');

    // 3. Test /api/system/df
    console.log('Checking GET /api/system/df ...');
    const dfRes = await fetch(`${baseUrl}/api/system/df`);
    assert.strictEqual(dfRes.status, 200);
    const dfJson = await dfRes.json();
    assert.strictEqual(dfJson.success, true);
    assert.ok(Array.isArray(dfJson.data), 'System df should be an array');

    // 4. Test /api/containers
    console.log('Checking GET /api/containers ...');
    const cRes = await fetch(`${baseUrl}/api/containers`);
    assert.strictEqual(cRes.status, 200);
    const cJson = await cRes.json();
    assert.strictEqual(cJson.success, true);
    assert.ok(Array.isArray(cJson.data), 'Containers should be an array');

    // 5. Test /api/pods
    console.log('Checking GET /api/pods ...');
    const pRes = await fetch(`${baseUrl}/api/pods`);
    assert.strictEqual(pRes.status, 200);
    const pJson = await pRes.json();
    assert.strictEqual(pJson.success, true);
    assert.ok(Array.isArray(pJson.data), 'Pods should be an array');

    // 6. Test /api/images
    console.log('Checking GET /api/images ...');
    const imgRes = await fetch(`${baseUrl}/api/images`);
    assert.strictEqual(imgRes.status, 200);
    const imgJson = await imgRes.json();
    assert.strictEqual(imgJson.success, true);
    assert.ok(Array.isArray(imgJson.data), 'Images should be an array');

    // 7. Test /api/volumes
    console.log('Checking GET /api/volumes ...');
    const volRes = await fetch(`${baseUrl}/api/volumes`);
    assert.strictEqual(volRes.status, 200);
    const volJson = await volRes.json();
    assert.strictEqual(volJson.success, true);
    assert.ok(Array.isArray(volJson.data), 'Volumes should be an array');

    // 8. Test /api/networks
    console.log('Checking GET /api/networks ...');
    const netRes = await fetch(`${baseUrl}/api/networks`);
    assert.strictEqual(netRes.status, 200);
    const netJson = await netRes.json();
    assert.strictEqual(netJson.success, true);
    assert.ok(Array.isArray(netJson.data), 'Networks should be an array');

    // 9. Test /api/events
    console.log('Checking GET /api/events ...');
    const evRes = await fetch(`${baseUrl}/api/events?since=24h`);
    assert.strictEqual(evRes.status, 200);
    const evJson = await evRes.json();
    assert.strictEqual(evJson.success, true);
    assert.ok(Array.isArray(evJson.data), 'Events should be an array');

    console.log('✅ All sanity tests passed successfully!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
