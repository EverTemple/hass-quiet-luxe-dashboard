import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG } from './reference-homes';

describe('reference home configs (spec §2 matrix)', () => {
  it('energy exists only in Subang Jaya (Shelly 3EM)', () => {
    expect(SUBANG_CONFIG.energy).not.toBe(false);
    expect(TUNGCHUNG_CONFIG.energy).toBe(false);
    expect(XIAMEN_CONFIG.energy).toBe(false);
  });

  it('car brands follow the matrix', () => {
    expect(SUBANG_CONFIG.car).toBe('bmw');
    expect(TUNGCHUNG_CONFIG.car).toBe('audi');
    expect(XIAMEN_CONFIG.car).toBe('liauto');
  });

  it('calendar is google except Xiamen (China-reachability rule)', () => {
    expect(SUBANG_CONFIG.calendar).toBe('google');
    expect(TUNGCHUNG_CONFIG.calendar).toBe('google');
    expect(XIAMEN_CONFIG.calendar).toBe('none');
  });

  it('vacuum only in Xiamen (Dreame X30 Pro)', () => {
    expect(SUBANG_CONFIG.vacuum).toBe(false);
    expect(TUNGCHUNG_CONFIG.vacuum).toBe(false);
    expect(XIAMEN_CONFIG.vacuum).toBe(true);
  });

  it('media_rich only in Subang Jaya (Sonos everywhere)', () => {
    expect(SUBANG_CONFIG.media_rich).toBe(true);
    expect(TUNGCHUNG_CONFIG.media_rich).toBe(false);
    expect(XIAMEN_CONFIG.media_rich).toBe(false);
  });

  it('camera engine: webrtc for NVR/RTSP homes, snapshot for Dahua-cloud Xiamen', () => {
    expect(SUBANG_CONFIG.camera_engine).toBe('webrtc');
    expect(TUNGCHUNG_CONFIG.camera_engine).toBe('webrtc');
    expect(XIAMEN_CONFIG.camera_engine).toBe('snapshot');
  });

  it('broadlink RF/IR only in Subang Jaya and Tung Chung', () => {
    expect(SUBANG_CONFIG.broadlink).toBe(true);
    expect(TUNGCHUNG_CONFIG.broadlink).toBe(true);
    expect(XIAMEN_CONFIG.broadlink).toBe(false);
  });

  it('kiosk default languages per home', () => {
    expect(SUBANG_CONFIG.kiosk?.language).toBe('en');
    expect(TUNGCHUNG_CONFIG.kiosk?.language).toBe('zh-Hant');
    expect(XIAMEN_CONFIG.kiosk?.language).toBe('zh-Hans');
  });

  it('every home routes the shared kiosk user to the guest tier', () => {
    for (const home of [SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG]) {
      expect(home.users?.guests).toContain('kiosk');
    }
  });
});
