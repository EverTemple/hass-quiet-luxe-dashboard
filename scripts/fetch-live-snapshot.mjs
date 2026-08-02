// Dumps one HA instance's registry + states to dev/live-snapshot.json so the
// dev harness can render the strategy against real data.
// Usage: HA_URL=https://... HA_TOKEN=... node scripts/fetch-live-snapshot.mjs [out.json]
import { writeFileSync } from 'node:fs';

const url = process.env.HA_URL?.replace(/\/+$/, '');
const token = process.env.HA_TOKEN;
const outPath = process.argv[2] ?? 'dev/live-snapshot.json';

if (!url || !token) {
  console.error('usage: HA_URL=... HA_TOKEN=... node scripts/fetch-live-snapshot.mjs [out.json]');
  process.exit(1);
}

const states = await fetch(`${url}/api/states`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((res) => {
  if (!res.ok) throw new Error(`GET /api/states -> HTTP ${res.status}`);
  return res.json();
});

const socket = new WebSocket(`${url.replace(/^http/, 'ws')}/api/websocket`);
const pending = new Map();
let nextId = 1;

function send(message) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ ...message, id }));
  });
}

const registry = await new Promise((resolve, reject) => {
  socket.addEventListener('error', reject);
  socket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'auth_required') {
      socket.send(JSON.stringify({ type: 'auth', access_token: token }));
      return;
    }
    if (message.type === 'auth_invalid') {
      reject(new Error('auth_invalid'));
      return;
    }
    if (message.type === 'auth_ok') {
      const [areas, devices, entities] = await Promise.all([
        send({ type: 'config/area_registry/list' }),
        send({ type: 'config/device_registry/list' }),
        send({ type: 'config/entity_registry/list' }),
      ]);
      resolve({ areas, devices, entities });
      return;
    }
    if (message.type === 'result') {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.success) handler?.resolve(message.result);
      else handler?.reject(new Error(JSON.stringify(message.error)));
    }
  });
});

socket.close();

writeFileSync(
  outPath,
  `${JSON.stringify({ fetched_at: new Date().toISOString(), registry, states }, null, 2)}\n`,
);
console.log(
  `fetch-live-snapshot: ${registry.areas.length} areas, ${registry.entities.length} registry entries, ${states.length} states -> ${outPath}`,
);
