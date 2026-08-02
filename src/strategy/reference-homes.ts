import { validateHomeConfig, type HomeConfig } from './config';

/**
 * Spec §2 per-home matrix as validated fixtures. Entity ids are UNCONFIRMED
 * until the live instances are reachable (spec §13); wrong ids degrade to
 * muted/omitted at render time, they never break generation.
 */
export const SUBANG_CONFIG: HomeConfig = validateHomeConfig({
  name: 'Subang Jaya',
  energy: {
    power_entity: 'sensor.shelly_3em_total_power',
    today_entity: 'sensor.shelly_3em_total_energy_today',
    phase_entities: [
      'sensor.shelly_3em_phase_a_power',
      'sensor.shelly_3em_phase_b_power',
      'sensor.shelly_3em_phase_c_power',
    ],
    tariff: 0.516,
  },
  car: 'bmw',
  car_entities: {
    battery_entity: 'sensor.bmw_battery',
    range_entity: 'sensor.bmw_range',
    lock_entity: 'binary_sensor.bmw_lock',
    location_entity: 'device_tracker.bmw',
  },
  calendar: 'google',
  vacuum: false,
  media_rich: true,
  camera_engine: 'webrtc',
  broadlink: true,
  room_order: ['main_living', 'side_living', 'master_bedroom'],
  admin_flows: [
    { entity: 'switch.nr_guest_wifi', name: 'Guest Wi-Fi', description: 'UniFi guest network' },
    { entity: 'switch.nr_plex_forward', name: 'Plex port forward', description: 'pfSense NAT rule' },
  ],
  kiosk: { language: 'en' },
  users: { guests: ['kiosk'] },
});

/**
 * Areas confirmed against the live registry on 2026-08-02 after the area
 * merge (backup: `.ai/tungchung-registry-pre-merge.json`). The duplicate
 * Chinese-named areas (客厅/饭厅/父母房/儿子房) were merged into their English
 * equivalents (living_room/dining_room/parents_room/steven_bedroom); the
 * Chinese names remain as area aliases. Audi and Google Calendar
 * integrations were NOT present in the audit; their entity ids stay as
 * UNCONFIRMED placeholders that degrade to omitted at render time.
 */
export const TUNGCHUNG_CONFIG: HomeConfig = validateHomeConfig({
  name: 'Tung Chung',
  car: 'audi',
  car_entities: {
    battery_entity: 'sensor.audi_battery',
    range_entity: 'sensor.audi_range',
  },
  calendar: 'google',
  camera_engine: 'webrtc',
  broadlink: true,
  room_order: [
    'living_room',
    'dining_room',
    'steven_bedroom',
    'parents_room',
    'parking',
  ],
  /* Most devices in steven_bedroom are named "Steven Room …", which the area
     itself is not called; listing it here keeps that prefix out of the labels
     inside the room (confirmed against the live registry 2026-08-02). */
  rooms: { steven_bedroom: { aliases: ['Steven Room'] } },
  admin_flows: [
    { entity: 'switch.zigbee2mqtt_bridge_permit_join', name: 'Zigbee pairing', description: 'Zigbee2MQTT permit join' },
  ],
  kiosk: { language: 'zh-Hant' },
  users: { guests: ['kiosk'] },
});

export const XIAMEN_CONFIG: HomeConfig = validateHomeConfig({
  name: 'Xiamen',
  car: 'liauto',
  car_entities: {
    battery_entity: 'sensor.liauto_battery',
    fuel_entity: 'sensor.liauto_fuel',
    range_entity: 'sensor.liauto_range',
  },
  calendar: 'none',
  vacuum: true,
  camera_engine: 'snapshot',
  broadlink: false,
  kiosk: { language: 'zh-Hans' },
  users: { guests: ['kiosk'] },
});
