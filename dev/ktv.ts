// Single-card page for the KTV card at any viewport width, in light or dark.
// Usage: /dev/ktv.html?mode=dark&box=offline&lang=zh-Hans
// The page fills the viewport like an HA panel/sections view does: 16px gutter, card full width.
import '../src/index';
import { makeEntity, makeMockHass } from '../src/testing/mock-hass';
import { cssVariableBlock } from '../src/tokens/css';
import type { ThemeMode } from '../src/tokens/types';

const params = new URLSearchParams(window.location.search);
const mode: ThemeMode = params.get('mode') === 'dark' ? 'dark' : 'light';
const offline = params.get('box') === 'offline';
const language = params.get('lang') ?? 'en';

const ktvBox = makeEntity('sensor.ktv_box', offline ? 'offline' : 'playing', {
  volume: 14,
  vocal: offline ? null : 'backing',
  now_playing: offline ? null : { no: '1087855', title: '富士山下', singer: '陈奕迅' },
  queue: offline
    ? []
    : [
        { no: '2002844', title: '陀飞轮', singer: '陈奕迅' },
        { no: '11010090', title: '相思风雨中', singer: '张学友' },
        { no: '1729413', title: '恋人', singer: '李荣浩' },
        { no: '1318195', title: '知否知否', singer: '胡夏' },
        { no: '11138176', title: '红色高跟鞋', singer: '蔡健雅' },
        { no: '1456407', title: '别知己', singer: '海来阿木' },
      ],
  queue_count: offline ? 0 : 6,
  catalogue_url: '/dev/ktv-catalogue.sample.json',
  catalogue_version: 'sample-59',
  catalogue_error: null,
});

const base = makeMockHass([ktvBox, makeEntity('text.ktv_command', '', {})], { language });
const hass = { ...base, themes: { darkMode: mode === 'dark' } };

const root = document.getElementById('root');
if (root === null) {
  throw new Error('dev/ktv.html: #root missing');
}
root.style.cssText = `min-height:100vh;box-sizing:border-box;padding:16px;background:var(--ql-bg-base);${cssVariableBlock(mode)}`;
document.documentElement.setAttribute('data-ql-dark', mode === 'dark' ? 'true' : 'false');

type CardElement = HTMLElement & { hass: unknown; setConfig(config: Record<string, unknown>): void };
const card = document.createElement('quiet-luxe-ktv-card') as CardElement;
card.setConfig({ type: 'custom:quiet-luxe-ktv-card', entity: 'sensor.ktv_box', command_entity: 'text.ktv_command' });
card.hass = hass;
root.append(card);
