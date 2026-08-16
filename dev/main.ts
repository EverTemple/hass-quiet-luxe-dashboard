import '../src/index';
import {
  climateEntity,
  coverEntity,
  lightEntity,
  makeEntity,
  makeMockHass,
  sensorEntity,
} from '../src/testing/mock-hass';
import { cssVariableBlock } from '../src/tokens/css';
import type { ThemeMode } from '../src/tokens/types';
import { QuietLuxeStrategy } from '../src/strategy/quiet-luxe-strategy';
import type { HomeConfig } from '../src/strategy/config';
import {
  SUBANG_CONFIG,
  TUNGCHUNG_CONFIG,
  XIAMEN_CONFIG,
} from '../src/strategy/reference-homes';
import { referenceHome, type ReferenceHomeName } from '../src/testing/mock-registry';

// Remote Unsplash photos are fine here: the harness is local-dev only and never
// ships in the HACS package (China-reachability rule applies to the bundle).
const PHOTO_LIVING =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70';
const PHOTO_STUDY =
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=70';

const hass = makeMockHass(
  [
    lightEntity('light.pendant', 'on', 178),
    lightEntity('light.floor_lamp', 'off'),
    lightEntity('light.offline_lamp', 'unavailable'),
    makeEntity('light.living_group', 'on'),
    climateEntity('climate.living_ac', 'cool', { hvac_action: 'cooling' }),
    climateEntity('climate.master_ac', 'off'),
    makeEntity('fan.study_fan', 'on'),
    makeEntity('switch.bath_exhaust', 'off'),
    coverEntity('cover.living_curtain', 65, { device_class: 'curtain' }),
    coverEntity('cover.study_shade', 0, { device_class: 'shade' }),
    sensorEntity('sensor.living_aqi', '18'),
    sensorEntity('sensor.living_temp', '24.5'),
    sensorEntity('sensor.living_humidity', '62'),
    sensorEntity('sensor.uv_index', '7'),
    sensorEntity('sensor.rain_chance', '80'),
    makeEntity('media_player.living_sonos', 'playing', {
      friendly_name: 'Living Sonos',
      media_title: 'So What',
      media_artist: 'Miles Davis',
      media_album_name: 'Kind of Blue',
      source: 'Spotify',
      volume_level: 0.34,
      entity_picture: PHOTO_STUDY,
      group_members: ['media_player.living_sonos', 'media_player.kitchen_sonos'],
    }),
    makeEntity('media_player.kitchen_sonos', 'playing', {
      friendly_name: 'Kitchen Sonos',
      volume_level: 0.2,
    }),
    makeEntity('media_player.study_sonos', 'idle', { friendly_name: 'Study Sonos' }),
    makeEntity('media_player.tv', 'off', { friendly_name: 'Living TV' }),
    makeEntity('camera.front_door', 'streaming', {
      friendly_name: 'Front Door',
      entity_picture: PHOTO_LIVING,
    }),
    makeEntity('camera.gate', 'unavailable', { friendly_name: 'Gate' }),
    sensorEntity('sensor.power_total', '1236'),
    sensorEntity('sensor.energy_today', '8.61'),
    sensorEntity('sensor.phase_l1', '2300'),
    sensorEntity('sensor.phase_l2', '840'),
    sensorEntity('sensor.phase_l3', '410'),
    makeEntity('todo.family', '2', { friendly_name: 'Family Tasks' }),
    makeEntity('person.steven', 'home', { friendly_name: 'Steven' }),
    makeEntity('person.mei', 'not_home', {
      friendly_name: 'Mei',
      entity_picture: PHOTO_STUDY,
    }),
    makeEntity('binary_sensor.front_door', 'off', {
      friendly_name: 'Front Door',
      device_class: 'door',
    }),
    makeEntity('binary_sensor.hall_motion', 'on', {
      friendly_name: 'Hall Motion',
      device_class: 'motion',
    }),
    makeEntity('switch.hall_motion_detection', 'on'),
    makeEntity('switch.guest_wifi', 'on', { friendly_name: 'Guest Wi-Fi' }),
    sensorEntity('sensor.car_battery', '76'),
    sensorEntity('sensor.car_fuel', '55'),
    sensorEntity('sensor.car_range', '412', { unit_of_measurement: 'km' }),
    makeEntity('binary_sensor.car_lock', 'off', { device_class: 'lock' }),
    makeEntity('switch.car_precondition', 'off'),
    sensorEntity('sensor.car_location', 'Subang Jaya'),
    makeEntity('vacuum.robot', 'cleaning', { friendly_name: 'Robot', battery_level: 76 }),
  ],
  {
    apiResponses: {
      'calendars/calendar.family': [
        {
          summary: 'Dentist',
          start: { dateTime: '2026-08-03T09:30:00+08:00' },
          end: { dateTime: '2026-08-03T10:30:00+08:00' },
        },
        {
          summary: 'Sports day',
          start: { date: '2026-08-02' },
          end: { date: '2026-08-03' },
        },
      ],
    },
    wsResponses: {
      'todo/item/list': {
        items: [
          { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-07-31' },
          { uid: 'a2', summary: 'Water plants', status: 'needs_action' },
          { uid: 'a3', summary: 'Book flights', status: 'completed' },
        ],
      },
    },
  },
);

type CardElement = HTMLElement & {
  hass: unknown;
  setConfig(config: Record<string, unknown>): void;
};

function makeCard(tag: string, config: Record<string, unknown>): CardElement {
  const card = document.createElement(tag) as CardElement;
  card.setConfig(config);
  card.hass = hass;
  return card;
}

function el(tag: string, props: Record<string, unknown> = {}, text = ''): HTMLElement {
  const node = document.createElement(tag) as HTMLElement & Record<string, unknown>;
  Object.assign(node, props);
  if (text !== '') {
    node.textContent = text;
  }
  return node;
}

function row(children: ReadonlyArray<HTMLElement>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
  wrap.append(...children);
  return wrap;
}

function section(title: string, children: ReadonlyArray<HTMLElement>): HTMLElement {
  const wrap = document.createElement('section');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  wrap.append(el('ql-section-eyebrow', { label: title }), ...children);
  return wrap;
}

function primitives(): HTMLElement[] {
  return [
    row([
      el('ql-chip', { variant: 'device', active: true }, 'Lights'),
      el('ql-chip', { variant: 'device' }, 'AC'),
      el('ql-chip', { variant: 'scene', emphasis: 'primary' }, 'Movie night'),
      el('ql-chip', { variant: 'scene', emphasis: 'secondary' }, 'Good morning'),
      el('ql-chip', { variant: 'scene', emphasis: 'secondary', touch: true }, 'iPad touch'),
    ]),
    row([
      el('ql-toggle', { checked: true, label: 'On toggle' }),
      el('ql-toggle', { label: 'Off toggle' }),
      el('ql-toggle', { disabled: true, label: 'Disabled toggle' }),
      el('ql-status-dot', { status: 'good' }),
      el('ql-status-dot', { status: 'warn' }),
      el('ql-status-dot', { status: 'alert' }),
      el('ql-status-dot', { status: 'neutral' }),
      el('ql-badge', {}, 'AQI 42'),
    ]),
    el('ql-slider', { value: 60, label: 'Brightness' }),
    el('ql-segmented', {
      value: 'agenda',
      label: 'Schedule view',
      options: [
        { value: 'agenda', label: 'Agenda' },
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ],
    }),
  ];
}

function buildPane(mode: ThemeMode): HTMLElement {
  const pane = document.createElement('div');
  pane.style.cssText = `position:relative;min-height:100vh;${cssVariableBlock(mode)}`;
  const canvas = document.createElement('ql-canvas');
  const content = document.createElement('main');
  content.style.cssText =
    'position:relative;display:flex;flex-direction:column;gap:24px;padding:24px;max-width:430px;margin:0 auto;';
  content.append(
    el('ql-header-home', {
      variant: 'mobile',
      homeName: 'Subang Jaya',
      userName: 'Steven',
      meta: 'Fri 1 Aug · 29° · AQI 42',
      presence: 'Steven & Mei home',
      hour: 20,
    }),
    el('ql-header-home', {
      variant: 'ipad',
      homeName: 'Tung Chung',
      meta: 'Fri 1 Aug · 29°',
      presence: 'Home',
    }),
    el('ql-header-view', {
      variant: 'mobile',
      backLabel: 'Home',
      heading: 'Living Room',
      subtitle: '24.5° · 62% · AQI 18',
    }),
    el('ql-header-view', {
      variant: 'ipad',
      backLabel: 'Home',
      heading: 'Living Room',
      subtitle: '24.5° · 62% · AQI 18',
    }),
    section('Primitives', primitives()),
    section('Rooms', [
      makeCard('quiet-luxe-room-card', {
        type: 'custom:quiet-luxe-room-card',
        name: 'Living Room',
        image: PHOTO_LIVING,
        size: 'm',
        temperature_entity: 'sensor.living_temp',
        aqi_entity: 'sensor.living_aqi',
        lights_entity: 'light.living_group',
        navigation_path: '/quiet-luxe/living',
        chips: [
          { entity: 'light.pendant', label: 'Lights' },
          { entity: 'climate.living_ac', label: 'AC' },
        ],
      }),
      makeCard('quiet-luxe-room-card', {
        type: 'custom:quiet-luxe-room-card',
        name: 'Study',
        image: PHOTO_STUDY,
        size: 's',
        lights_entity: 'light.floor_lamp',
      }),
      makeCard('quiet-luxe-room-card', {
        type: 'custom:quiet-luxe-room-card',
        name: 'Master Bedroom',
        image: PHOTO_LIVING,
        size: 'l',
        aqi_entity: 'sensor.living_aqi',
        lights_entity: 'light.living_group',
      }),
    ]),
    section('Climate', [
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'climate.living_ac',
        name: 'Living AC',
      }),
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'fan.study_fan',
        name: 'Study Fan',
      }),
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'switch.bath_exhaust',
        name: 'Bath Exhaust',
        device_type: 'exhaust',
        confirm: true,
      }),
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'climate.missing_ac',
        name: 'Missing AC',
      }),
    ]),
    section('Lights', [
      makeCard('quiet-luxe-light-card', {
        type: 'custom:quiet-luxe-light-card',
        entity: 'light.pendant',
        name: 'Pendant',
      }),
      makeCard('quiet-luxe-light-card', {
        type: 'custom:quiet-luxe-light-card',
        entity: 'light.floor_lamp',
        name: 'Floor Lamp',
      }),
      makeCard('quiet-luxe-light-card', {
        type: 'custom:quiet-luxe-light-card',
        entity: 'light.offline_lamp',
        name: 'Offline Lamp',
      }),
    ]),
    section('Covers', [
      makeCard('quiet-luxe-cover-card', {
        type: 'custom:quiet-luxe-cover-card',
        entity: 'cover.living_curtain',
        name: 'Living Curtain',
      }),
      makeCard('quiet-luxe-cover-card', {
        type: 'custom:quiet-luxe-cover-card',
        entity: 'cover.study_shade',
        name: 'Study Shade',
      }),
    ]),
    section('Sensors', [
      row([
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.living_aqi',
          metric: 'aqi',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.living_temp',
          metric: 'temp',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.living_humidity',
          metric: 'humidity',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.uv_index',
          metric: 'uv',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.rain_chance',
          metric: 'rain',
        }),
      ]),
    ]),
    section('Media', [
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.living_sonos',
        form: 'player',
      }),
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.living_sonos',
        form: 'bar',
      }),
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.kitchen_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      }),
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.study_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      }),
    ]),
    section('Cameras', [
      row([
        makeCard('quiet-luxe-camera-card', {
          type: 'custom:quiet-luxe-camera-card',
          entity: 'camera.front_door',
          size: 'l',
        }),
        makeCard('quiet-luxe-camera-card', {
          type: 'custom:quiet-luxe-camera-card',
          entity: 'camera.front_door',
          size: 'm',
          motion_entity: 'binary_sensor.hall_motion',
        }),
        makeCard('quiet-luxe-camera-card', {
          type: 'custom:quiet-luxe-camera-card',
          entity: 'camera.gate',
          size: 'm',
        }),
      ]),
    ]),
    section('Energy', [
      makeCard('quiet-luxe-energy-card', {
        type: 'custom:quiet-luxe-energy-card',
        power_entity: 'sensor.power_total',
        today_entity: 'sensor.energy_today',
      }),
      row([
        makeCard('quiet-luxe-energy-card', {
          type: 'custom:quiet-luxe-energy-card',
          form: 'ring',
          power_entity: 'sensor.phase_l1',
          name: 'L1',
        }),
        makeCard('quiet-luxe-energy-card', {
          type: 'custom:quiet-luxe-energy-card',
          form: 'ring',
          power_entity: 'sensor.phase_l2',
          name: 'L2',
        }),
        makeCard('quiet-luxe-energy-card', {
          type: 'custom:quiet-luxe-energy-card',
          form: 'ring',
          power_entity: 'sensor.phase_l3',
          name: 'L3',
        }),
      ]),
    ]),
    section('Schedule & Tasks', [
      makeCard('quiet-luxe-schedule-card', {
        type: 'custom:quiet-luxe-schedule-card',
        calendars: ['calendar.family'],
        todo_entity: 'todo.family',
      }),
      makeCard('quiet-luxe-schedule-card', {
        type: 'custom:quiet-luxe-schedule-card',
        todo_entity: 'todo.family',
      }),
    ]),
    section('Car', [
      makeCard('quiet-luxe-car-card', {
        type: 'custom:quiet-luxe-car-card',
        brand: 'liauto',
        name: 'Li Auto L7',
        battery_entity: 'sensor.car_battery',
        fuel_entity: 'sensor.car_fuel',
        range_entity: 'sensor.car_range',
        lock_entity: 'binary_sensor.car_lock',
        precondition_entity: 'switch.car_precondition',
        location_entity: 'sensor.car_location',
      }),
      row([
        makeCard('quiet-luxe-car-card', {
          type: 'custom:quiet-luxe-car-card',
          brand: 'bmw',
          name: 'BMW',
          battery_entity: 'sensor.car_battery',
        }),
        makeCard('quiet-luxe-car-card', {
          type: 'custom:quiet-luxe-car-card',
          brand: 'audi',
          name: 'Audi',
          range_entity: 'sensor.car_range',
        }),
      ]),
    ]),
    section('Vacuum', [
      makeCard('quiet-luxe-vacuum-card', {
        type: 'custom:quiet-luxe-vacuum-card',
        entity: 'vacuum.robot',
        rooms: [
          { name: 'Living', params: { segments: [3] } },
          { name: 'Kitchen', params: { segments: [5] } },
        ],
      }),
    ]),
    section('Rows', [
      makeCard('ql-row-presence', {
        type: 'custom:ql-row-presence',
        entities: ['person.steven', 'person.mei'],
      }),
      makeCard('ql-row-door-motion', {
        type: 'custom:ql-row-door-motion',
        entity: 'binary_sensor.front_door',
      }),
      makeCard('ql-row-door-motion', {
        type: 'custom:ql-row-door-motion',
        entity: 'binary_sensor.hall_motion',
        toggle_entity: 'switch.hall_motion_detection',
        show_toggle: true,
      }),
      makeCard('ql-row-network-flow', {
        type: 'custom:ql-row-network-flow',
        entity: 'switch.guest_wifi',
        name: 'Guest Wi-Fi',
        description: 'UniFi guest network',
      }),
      makeCard('quiet-luxe-device-cutout-card', {
        type: 'custom:quiet-luxe-device-cutout-card',
        entity: 'media_player.tv',
        name: 'Living TV',
      }),
    ]),
    section('Language', [
      makeCard('quiet-luxe-language-card', { type: 'custom:quiet-luxe-language-card' }),
    ]),
    section('Idle clock', [
      ((): HTMLElement => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'height:320px;border-radius:18px;overflow:hidden;';
        wrap.append(
          el('ql-idle-clock', {
            time: '21:42',
            date: 'Friday, 1 August',
            weather: '29° · Rain 80% · AQI 42',
          }),
        );
        return wrap;
      })(),
    ]),
  );
  pane.append(canvas, content);
  return pane;
}

document.querySelector('#light')?.append(buildPane('light'));
document.querySelector('#dark')?.append(buildPane('dark'));

const STRATEGY_HOMES: ReadonlyArray<{
  readonly key: ReferenceHomeName;
  readonly home: HomeConfig;
}> = [
  { key: 'subang', home: SUBANG_CONFIG },
  { key: 'tungchung', home: TUNGCHUNG_CONFIG },
  { key: 'xiamen', home: XIAMEN_CONFIG },
];

/** JSON tree inspection of generate() output — not a full Lovelace render. */
async function buildStrategyPane(): Promise<HTMLElement> {
  const pane = document.createElement('section');
  pane.id = 'strategy';
  pane.style.cssText = 'padding:24px;display:flex;flex-direction:column;gap:16px;';
  pane.append(el('h2', {}, 'Strategy output — reference homes'));
  for (const { key, home } of STRATEGY_HOMES) {
    const { snapshot, entities } = referenceHome(key);
    const mock = makeMockHass(entities, {
      user: { id: 'dev-admin', name: 'Steven', is_admin: true },
      wsResponses: {
        'config/area_registry/list': snapshot.areas,
        'config/device_registry/list': snapshot.devices,
        'config/entity_registry/list': snapshot.entities,
        'config/label_registry/list': snapshot.labels,
      },
    });
    const dashboard = await QuietLuxeStrategy.generate({ type: 'custom:quiet-luxe', home }, mock);
    const details = document.createElement('details');
    details.append(el('summary', {}, `${home.name} — ${dashboard.views.length} views`));
    for (const view of dashboard.views) {
      const viewDetails = document.createElement('details');
      viewDetails.style.cssText = 'margin-left:16px;';
      viewDetails.append(el('summary', {}, `${view.title} (${view.path}, ${view.sections.length} sections)`));
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size:11px;overflow:auto;max-height:400px;';
      pre.textContent = JSON.stringify(view, null, 2);
      viewDetails.append(pre);
      details.append(viewDetails);
    }
    pane.append(details);
  }
  return pane;
}

void buildStrategyPane().then((pane) => document.body.append(pane));
