const CAR_FLAGS = ['bmw', 'audi', 'liauto', 'none'] as const;
export type CarFlag = (typeof CAR_FLAGS)[number];

const CALENDAR_FLAGS = ['google', 'none'] as const;
export type CalendarFlag = (typeof CALENDAR_FLAGS)[number];

const CAMERA_ENGINES = ['webrtc', 'snapshot'] as const;
export type CameraEngine = (typeof CAMERA_ENGINES)[number];

export interface RoomOverride {
  readonly name?: string;
  readonly photo?: string;
  readonly hidden?: boolean;
  /**
   * Extra names this room is known by, on top of the HA area aliases. Stripped
   * from card and chip labels inside the room so they never repeat the room.
   */
  readonly aliases?: ReadonlyArray<string>;
}

export interface EnergyConfig {
  readonly power_entity: string;
  readonly today_entity?: string;
  readonly phase_entities?: ReadonlyArray<string>;
  /** Cost per kWh in home currency; reserved for the Plan 5 cost estimate. */
  readonly tariff?: number;
}

export interface CarEntities {
  readonly battery_entity?: string;
  readonly fuel_entity?: string;
  readonly range_entity?: string;
  readonly lock_entity?: string;
  readonly precondition_entity?: string;
  readonly location_entity?: string;
}

export interface AdminFlow {
  readonly entity: string;
  readonly name?: string;
  readonly description?: string;
}

export interface KioskConfig {
  readonly language?: string;
}

export interface UsersConfig {
  readonly family?: ReadonlyArray<string>;
  readonly guests?: ReadonlyArray<string>;
}

export interface HomeConfig {
  readonly name: string;
  /** Dashboard url_path; navigation targets are built from it (D2). */
  readonly dashboard_path?: string;
  readonly energy: false | EnergyConfig;
  readonly car: CarFlag;
  readonly car_entities?: CarEntities;
  readonly calendar: CalendarFlag;
  readonly vacuum: boolean;
  readonly media_rich: boolean;
  readonly camera_engine: CameraEngine;
  readonly broadlink: boolean;
  readonly room_order?: ReadonlyArray<string>;
  readonly rooms?: Readonly<Record<string, RoomOverride>>;
  readonly photo_base?: string;
  readonly admin_flows?: ReadonlyArray<AdminFlow>;
  readonly kiosk?: KioskConfig;
  readonly users?: UsersConfig;
}

export const DEFAULT_DASHBOARD_PATH = 'quiet-luxe';

export class QuietLuxeConfigError extends Error {
  constructor(message: string) {
    super(`[quiet-luxe] invalid home config: ${message}`);
    this.name = 'QuietLuxeConfigError';
  }
}

/** Absolute navigation path for a view; the dashboard's url_path must match (README). */
export function viewUrl(home: HomeConfig, viewPath: string): string {
  return `/${home.dashboard_path ?? DEFAULT_DASHBOARD_PATH}/${viewPath}`;
}

function fail(message: string): never {
  throw new QuietLuxeConfigError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  raw: Record<string, unknown>,
  allowed: ReadonlyArray<string>,
  context: string,
): void {
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    fail(`unknown ${context} key(s): ${unknown.join(', ')}`);
  }
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') {
    fail(`"${label}" must be a non-empty string`);
  }
  return value;
}

function optString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : stringValue(value, label);
}

function reqString(value: unknown, label: string): string {
  if (value === undefined) {
    fail(`"${label}" is required`);
  }
  return stringValue(value, label);
}

function boolValue(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    fail(`"${label}" must be true or false`);
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  label: string,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string' || !(allowed as ReadonlyArray<string>).includes(value)) {
    fail(`"${label}" must be one of ${allowed.join('|')}`);
  }
  return value as T;
}

function stringArray(value: unknown, label: string): ReadonlyArray<string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item === '')) {
    fail(`"${label}" must be an array of non-empty strings`);
  }
  return value as ReadonlyArray<string>;
}

function parseEnergy(value: unknown): false | EnergyConfig {
  if (value === undefined || value === false) {
    return false;
  }
  if (value === true) {
    fail('"energy" must be false or an object like { power_entity: "sensor.x" }; bare true names no entities');
  }
  if (!isRecord(value)) {
    fail('"energy" must be false or an object');
  }
  rejectUnknownKeys(value, ['power_entity', 'today_entity', 'phase_entities', 'tariff'], '"energy"');
  if (value.tariff !== undefined && typeof value.tariff !== 'number') {
    fail('"energy.tariff" must be a number');
  }
  return {
    power_entity: reqString(value.power_entity, 'energy.power_entity'),
    today_entity: optString(value.today_entity, 'energy.today_entity'),
    phase_entities: stringArray(value.phase_entities, 'energy.phase_entities'),
    tariff: value.tariff,
  };
}

const CAR_ENTITY_KEYS = [
  'battery_entity',
  'fuel_entity',
  'range_entity',
  'lock_entity',
  'precondition_entity',
  'location_entity',
] as const;

function parseCarEntities(value: unknown): CarEntities | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"car_entities" must be an object');
  }
  rejectUnknownKeys(value, CAR_ENTITY_KEYS, '"car_entities"');
  return Object.fromEntries(
    CAR_ENTITY_KEYS.map((key) => [key, optString(value[key], `car_entities.${key}`)]),
  ) as CarEntities;
}

function parseRooms(value: unknown): Readonly<Record<string, RoomOverride>> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"rooms" must be a map of area_id to override');
  }
  const rooms: Record<string, RoomOverride> = {};
  for (const [areaId, override] of Object.entries(value)) {
    if (!isRecord(override)) {
      fail(`"rooms.${areaId}" must be an object`);
    }
    rejectUnknownKeys(override, ['name', 'photo', 'hidden', 'aliases'], `"rooms.${areaId}"`);
    const hidden = override.hidden;
    if (hidden !== undefined && typeof hidden !== 'boolean') {
      fail(`"rooms.${areaId}.hidden" must be true or false`);
    }
    rooms[areaId] = {
      name: optString(override.name, `rooms.${areaId}.name`),
      photo: optString(override.photo, `rooms.${areaId}.photo`),
      hidden,
      aliases: stringArray(override.aliases, `rooms.${areaId}.aliases`),
    };
  }
  return rooms;
}

function parseAdminFlows(value: unknown): ReadonlyArray<AdminFlow> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail('"admin_flows" must be an array');
  }
  return value.map((flow: unknown, index) => {
    if (!isRecord(flow)) {
      fail(`"admin_flows[${index}]" must be an object`);
    }
    rejectUnknownKeys(flow, ['entity', 'name', 'description'], `"admin_flows[${index}]"`);
    return {
      entity: reqString(flow.entity, `admin_flows[${index}].entity`),
      name: optString(flow.name, `admin_flows[${index}].name`),
      description: optString(flow.description, `admin_flows[${index}].description`),
    };
  });
}

function parseKiosk(value: unknown): KioskConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"kiosk" must be an object');
  }
  rejectUnknownKeys(value, ['language'], '"kiosk"');
  return { language: optString(value.language, 'kiosk.language') };
}

function parseUsers(value: unknown): UsersConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"users" must be an object');
  }
  rejectUnknownKeys(value, ['family', 'guests'], '"users"');
  return {
    family: stringArray(value.family, 'users.family'),
    guests: stringArray(value.guests, 'users.guests'),
  };
}

const TOP_KEYS = [
  'name',
  'dashboard_path',
  'energy',
  'car',
  'car_entities',
  'calendar',
  'vacuum',
  'media_rich',
  'camera_engine',
  'broadlink',
  'room_order',
  'rooms',
  'photo_base',
  'admin_flows',
  'kiosk',
  'users',
] as const;

export function validateHomeConfig(raw: unknown): HomeConfig {
  if (!isRecord(raw)) {
    fail('config "home" must be an object (see README "Dashboard YAML")');
  }
  rejectUnknownKeys(raw, TOP_KEYS, 'home config');
  const car = enumValue(raw.car, 'car', CAR_FLAGS, 'none');
  const carEntities = parseCarEntities(raw.car_entities);
  if (car === 'none' && carEntities !== undefined) {
    fail('"car_entities" requires "car" to be bmw, audi, or liauto');
  }
  return {
    name: reqString(raw.name, 'name'),
    dashboard_path: optString(raw.dashboard_path, 'dashboard_path'),
    energy: parseEnergy(raw.energy),
    car,
    car_entities: carEntities,
    calendar: enumValue(raw.calendar, 'calendar', CALENDAR_FLAGS, 'none'),
    vacuum: boolValue(raw.vacuum, 'vacuum', false),
    media_rich: boolValue(raw.media_rich, 'media_rich', false),
    camera_engine: enumValue(raw.camera_engine, 'camera_engine', CAMERA_ENGINES, 'snapshot'),
    broadlink: boolValue(raw.broadlink, 'broadlink', false),
    room_order: stringArray(raw.room_order, 'room_order'),
    rooms: parseRooms(raw.rooms),
    photo_base: optString(raw.photo_base, 'photo_base'),
    admin_flows: parseAdminFlows(raw.admin_flows),
    kiosk: parseKiosk(raw.kiosk),
    users: parseUsers(raw.users),
  };
}
