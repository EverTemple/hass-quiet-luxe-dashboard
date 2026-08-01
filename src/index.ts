import { version } from '../package.json';
import { injectFontStylesheet } from './fonts/load-fonts';
import './elements/ql-canvas';
import './elements/ql-status-dot';
import './elements/ql-badge';
import './elements/ql-chip';
import './elements/ql-toggle';
import './elements/ql-slider';
import './elements/ql-segmented';
import './elements/ql-section-eyebrow';
import './elements/ql-header-home';
import './elements/ql-header-room';
import './cards/quiet-luxe-room-card';
import './cards/quiet-luxe-climate-card';
import './cards/quiet-luxe-light-card';
import './cards/quiet-luxe-cover-card';
import './cards/quiet-luxe-sensor-tile';

export { QlBaseCard, type EntityAvailability } from './cards/ql-base-card';
export { QlCanvas } from './elements/ql-canvas';
export { QlStatusDot, type QlStatus } from './elements/ql-status-dot';
export { QlBadge } from './elements/ql-badge';
export { QlChip, type QlChipEmphasis, type QlChipVariant } from './elements/ql-chip';
export { QlToggle } from './elements/ql-toggle';
export { QlSlider } from './elements/ql-slider';
export { QlSegmented, type QlSegmentOption } from './elements/ql-segmented';
export { QlSectionEyebrow } from './elements/ql-section-eyebrow';
export { QlHeaderHome, type QlHeaderVariant } from './elements/ql-header-home';
export { QlHeaderRoom } from './elements/ql-header-room';
export {
  QuietLuxeRoomCard,
  type RoomCardChipConfig,
  type RoomCardConfig,
  type RoomCardSize,
} from './cards/quiet-luxe-room-card';
export {
  CONFIRM_TIMEOUT_MS,
  QuietLuxeClimateCard,
  type ClimateCardConfig,
} from './cards/quiet-luxe-climate-card';
export { QuietLuxeLightCard, type LightCardConfig } from './cards/quiet-luxe-light-card';
export {
  detectCoverType,
  QuietLuxeCoverCard,
  type CoverCardConfig,
  type CoverType,
} from './cards/quiet-luxe-cover-card';
export { QuietLuxeSensorTile, type SensorTileConfig } from './cards/quiet-luxe-sensor-tile';
export {
  climateActivity,
  detectClimateDeviceType,
  type ClimateActivity,
  type ClimateDeviceType,
} from './cards/climate-device-type';
export {
  formatSensorValue,
  SENSOR_METRICS,
  sensorStatus,
  type SensorMetric,
} from './cards/sensor-format';
export { navigate } from './cards/navigate';
export { registerCard, type CustomCardEntry } from './cards/register';
export * from './tokens/palette';
export { colorCssVariables, cssVariableBlock, dimensionCssVariables } from './tokens/css';
export { resolveLocale } from './i18n/resolve';
export { t } from './i18n/translate';
export { SUPPORTED_LOCALES, type Locale } from './i18n/types';
export type { HomeAssistant } from './types/home-assistant';

injectFontStylesheet(document, import.meta.url);

console.info(
  `%c QUIET LUXE %c v${version} `,
  'background:#B08D57;color:#FDFBF6;font-weight:500',
  'color:#8C8578',
);
