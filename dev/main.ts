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

// Remote Unsplash photos are fine here: the harness is local-dev only and never
// ships in the HACS package (China-reachability rule applies to the bundle).
const PHOTO_LIVING =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70';
const PHOTO_STUDY =
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=70';

const hass = makeMockHass([
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
]);

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
    el('ql-header-room', { name: 'Living Room', stats: ['24.5°', '62%', 'AQI 18'] }),
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
  );
  pane.append(canvas, content);
  return pane;
}

document.querySelector('#light')?.append(buildPane('light'));
document.querySelector('#dark')?.append(buildPane('dark'));
