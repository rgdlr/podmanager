const assert = require('assert');
const app = require('../src/app');

async function testLifecycle() {
  console.log('🧪 Testing container & pod lifecycle via Podmanager API...');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Create a pod
    console.log('1. Creating test pod...');
    const podRes = await fetch(`${baseUrl}/api/pods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-pod-lifecycle', ports: ['9876:9876'] })
    });
    const podData = await podRes.json();
    assert.strictEqual(podRes.status, 200, `Pod creation failed: ${JSON.stringify(podData)}`);
    console.log('Created pod ID:', podData.podId);

    // 2. Inspect the created pod
    console.log('2. Inspecting created pod...');
    const inspectPodRes = await fetch(`${baseUrl}/api/pods/test-pod-lifecycle`);
    const inspectPodData = await inspectPodRes.json();
    assert.strictEqual(inspectPodRes.status, 200);
    assert.ok(inspectPodData.data, 'Pod inspect data must exist');

    // 3. Remove the created pod
    console.log('3. Removing test pod...');
    const delPodRes = await fetch(`${baseUrl}/api/pods/test-pod-lifecycle?force=true`, { method: 'DELETE' });
    const delPodData = await delPodRes.json();
    assert.strictEqual(delPodRes.status, 200, `Pod removal failed: ${JSON.stringify(delPodData)}`);
    console.log('Test pod successfully deleted.');

    // 4. Create a volume
    console.log('4. Creating test volume...');
    const volRes = await fetch(`${baseUrl}/api/volumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-vol-lifecycle' })
    });
    const volData = await volRes.json();
    assert.strictEqual(volRes.status, 200, `Volume create failed: ${JSON.stringify(volData)}`);

    // 5. Remove the volume
    console.log('5. Removing test volume...');
    const delVolRes = await fetch(`${baseUrl}/api/volumes/test-vol-lifecycle?force=true`, { method: 'DELETE' });
    const delVolData = await delVolRes.json();
    assert.strictEqual(delVolRes.status, 200, `Volume delete failed: ${JSON.stringify(delVolData)}`);
    console.log('Test volume successfully deleted.');

    console.log('✅ Lifecycle integration test passed cleanly!');
  } finally {
    server.close();
  }
}

testLifecycle().catch(err => {
  console.error('❌ Lifecycle test error:', err);
  process.exit(1);
});
