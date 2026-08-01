// Dumps one HA instance's live area/entity registry to JSON via the REST API
// (template endpoint — no websocket dependency).
// Usage: HA_URL=https://... HA_TOKEN=... node scripts/audit-registry.mjs <out.json>
import { writeFileSync } from 'node:fs';

const url = process.env.HA_URL?.replace(/\/+$/, '');
const token = process.env.HA_TOKEN;
const outPath = process.argv[2];

if (!url || !token || !outPath) {
  console.error('usage: HA_URL=... HA_TOKEN=... node scripts/audit-registry.mjs <output.json>');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function getJson(path) {
  const res = await fetch(`${url}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function template(tpl) {
  const res = await fetch(`${url}/api/template`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template: tpl }),
  });
  if (!res.ok) throw new Error(`template ${tpl} -> HTTP ${res.status}`);
  return JSON.parse(await res.text());
}

const config = await getJson('/api/config');
const states = await getJson('/api/states');
const areaIds = await template('{{ areas() | list | tojson }}');

const areas = {};
const assigned = new Set();
for (const id of areaIds) {
  const name = await template(`{{ area_name('${id}') | tojson }}`);
  const entities = await template(`{{ area_entities('${id}') | list | tojson }}`);
  for (const e of entities) assigned.add(e);
  areas[id] = { name, entities: entities.sort() };
}

const unassigned = states
  .map((s) => s.entity_id)
  .filter((e) => !assigned.has(e))
  .sort();

writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      fetched_at: new Date().toISOString(),
      ha_version: config.version,
      location_name: config.location_name,
      areas,
      unassigned,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `audit-registry: ${config.location_name} (HA ${config.version}) — ${areaIds.length} areas, ${states.length} states -> ${outPath}`,
);
