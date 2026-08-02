import { version } from '../package.json';
import { injectFontStylesheet } from './fonts/load-fonts';
import { injectInlineFonts } from './fonts/inline-fonts';
import { injectThemeStyle } from './theme/inject-theme';
import './elements/ql-canvas';
import './elements/ql-status-dot';
import './elements/ql-badge';
import './elements/ql-chip';
import './elements/ql-toggle';
import './elements/ql-slider';
import './elements/ql-segmented';
import './elements/ql-stepper';
import './elements/ql-dial-button';
import './elements/ql-preset-row';
import './elements/ql-sheet-button';
import './elements/ql-sheet';
import './elements/ql-sweep-dial';
import './elements/ql-timer-dial';
import './elements/ql-section-eyebrow';
import './elements/ql-header-home';
import './elements/ql-header-room';
import './cards/quiet-luxe-room-card';
import './cards/quiet-luxe-climate-card';
import './cards/quiet-luxe-fan-card';
import './cards/quiet-luxe-light-card';
import './cards/quiet-luxe-cover-card';
import './cards/quiet-luxe-sensor-tile';
import './elements/ql-idle-clock';
import './cards/quiet-luxe-media-card';
import './cards/quiet-luxe-camera-card';
import './cards/quiet-luxe-energy-card';
import './cards/quiet-luxe-schedule-card';
import './cards/quiet-luxe-tasks-card';
import './cards/quiet-luxe-car-card';
import './cards/quiet-luxe-vacuum-card';
import './cards/ql-row-presence';
import './cards/ql-row-door-motion';
import './cards/ql-row-network-flow';
import './cards/quiet-luxe-device-cutout-card';
import './cards/quiet-luxe-language-card';
import './cards/quiet-luxe-header-card';
import './strategy/quiet-luxe-strategy';

export { QlBaseCard, type EntityAvailability } from './cards/ql-base-card';
export { QlCanvas } from './elements/ql-canvas';
export { QlStatusDot, type QlStatus } from './elements/ql-status-dot';
export { QlBadge } from './elements/ql-badge';
export { QlChip, type QlChipEmphasis, type QlChipVariant } from './elements/ql-chip';
export { QlToggle } from './elements/ql-toggle';
export { QlSlider } from './elements/ql-slider';
export { QlSegmented, type QlSegmentOption } from './elements/ql-segmented';
export { QlStepper, STEPPER_COMMIT_MS } from './elements/ql-stepper';
export { QlDialButton, type QlDialState } from './elements/ql-dial-button';
export { QlPresetRow, type QlPresetOption } from './elements/ql-preset-row';
export { QlSheet } from './elements/ql-sheet';
export { QlSheetButton, type QlSheetButtonEmphasis } from './elements/ql-sheet-button';
export { QlSweepDial } from './elements/ql-sweep-dial';
export { QlTimerDial } from './elements/ql-timer-dial';
export { dysonIcon, DYSON_ICON_NAMES, type DysonIconName } from './elements/dyson-icons';
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
export { QuietLuxeFanCard, type FanCardConfig } from './cards/quiet-luxe-fan-card';
export {
  dialButtonsFor,
  fanCapabilities,
  TIMER_PRESETS,
  type DialId,
  type FanCapabilities,
  type FanCardForm,
} from './cards/fan-capabilities';
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
  fireMoreInfo,
  moreInfoTargetOf,
  MORE_INFO_ATTRIBUTE,
  MORE_INFO_EVENT,
  type MoreInfoEventDetail,
} from './cards/more-info';
export {
  angleForSpan,
  climateTargetTemperature,
  coverTiltPosition,
  fanOscillationAngle,
  fanPercentage,
  humidifierTargetHumidity,
  nearestSpan,
  optionList,
  selectableOptions,
  snapToStep,
  supportsFeature,
  ANGLE_SPANS,
  CLIMATE_FEATURE,
  COVER_FEATURE,
  FAN_FEATURE,
  HUMIDIFIER_FEATURE,
  type NumericTarget,
  type OscillationAngle,
} from './cards/supported-features';
export {
  controlServiceCall,
  deviceControls,
  optionLabel,
  titleCase,
  type ControlId,
  type DeviceControl,
  type ServiceCall,
} from './cards/device-controls';
export { renderControl, renderControls, type ControlEmit } from './cards/render-controls';
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
export {
  DARK_MODE_ATTRIBUTE,
  injectThemeStyle,
  syncDarkMode,
  THEME_STYLE_ID,
  themeStyleCss,
} from './theme/inject-theme';
export { INLINE_FONT_CSS, INLINE_FONT_STYLE_ID, injectInlineFonts } from './fonts/inline-fonts';
export {
  FONT_BODY_STACK,
  FONT_BODY_STACK_HANS,
  FONT_DISPLAY_STACK,
  FONT_DISPLAY_STACK_HANS,
} from './fonts/font-stacks';
export { resolveLocale } from './i18n/resolve';
export { t } from './i18n/translate';
export { SUPPORTED_LOCALES, type Locale } from './i18n/types';
export type { HomeAssistant } from './types/home-assistant';
export { QlIdleClock } from './elements/ql-idle-clock';
export {
  QuietLuxeMediaCard,
  type MediaCardConfig,
  type MediaCardForm,
} from './cards/quiet-luxe-media-card';
export {
  DEFAULT_CAMERA_REFRESH_S,
  QuietLuxeCameraCard,
  type CameraCardConfig,
  type CameraCardForm,
} from './cards/quiet-luxe-camera-card';
export { formatEnergy, formatPower, ringDasharray } from './cards/energy-format';
export {
  DEFAULT_RING_MAX_W,
  QuietLuxeEnergyCard,
  RING_RADIUS,
  type EnergyCardConfig,
  type EnergyCardForm,
} from './cards/quiet-luxe-energy-card';
export {
  AGENDA_DEFAULT_DAYS,
  AGENDA_REFRESH_MS,
  fetchAgenda,
  fetchTodoItems,
  formatAgendaTime,
  isDueSoon,
  updateTodoItem,
  type AgendaItem,
  type HaCalendarEvent,
  type HaTodoItem,
} from './cards/schedule-data';
export {
  QuietLuxeScheduleCard,
  type ScheduleCardConfig,
} from './cards/quiet-luxe-schedule-card';
export { QuietLuxeTasksCard, type TasksCardConfig } from './cards/quiet-luxe-tasks-card';
export {
  CAR_BODY_PATHS,
  CAR_VIEWBOX,
  CAR_WHEELS,
  type CarBrand,
  type CarWheel,
} from './cards/car-silhouettes';
export { QuietLuxeCarCard, type CarCardConfig } from './cards/quiet-luxe-car-card';
export {
  DEFAULT_ROOM_COMMAND,
  QuietLuxeVacuumCard,
  type VacuumCardConfig,
  type VacuumRoomConfig,
} from './cards/quiet-luxe-vacuum-card';
export { QlRowPresence, type PresenceRowConfig } from './cards/ql-row-presence';
export {
  QlRowDoorMotion,
  type DoorMotionKind,
  type DoorMotionRowConfig,
} from './cards/ql-row-door-motion';
export { QlRowNetworkFlow, type NetworkFlowRowConfig } from './cards/ql-row-network-flow';
export {
  QuietLuxeDeviceCutoutCard,
  type DeviceCutoutCardConfig,
} from './cards/quiet-luxe-device-cutout-card';
export {
  LANGUAGE_TILES,
  QuietLuxeLanguageCard,
  type LanguageCardConfig,
  type LanguageTile,
} from './cards/quiet-luxe-language-card';
export {
  QuietLuxeHeaderCard,
  variantForWidth,
  type HeaderCardConfig,
} from './cards/quiet-luxe-header-card';
export {
  fallbackDashboard,
  QuietLuxeStrategy,
  STRATEGY_ELEMENT_TAG,
  type QuietLuxeStrategyConfig,
} from './strategy/quiet-luxe-strategy';
export {
  DEFAULT_DASHBOARD_PATH,
  QuietLuxeConfigError,
  validateHomeConfig,
  viewUrl,
  type HomeConfig,
} from './strategy/config';
export { SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG } from './strategy/reference-homes';
export {
  buildRegistryIndex,
  fetchRegistrySnapshot,
  LABEL_FAVORITE,
  LABEL_HIDDEN,
  LABEL_PRIMARY_CAMERA,
  QuietLuxeRegistryError,
  type RegistryIndex,
  type RegistrySnapshot,
} from './strategy/registry';

// Self-sufficiency: the bundle carries its own Latin webfaces and --ql-* tokens,
// so a HACS-only install renders correctly with no files copied into /config.
// The /local font stylesheet and themes/quiet-luxe.yaml stay optional upgrades.
injectInlineFonts(document);
injectThemeStyle(document);
injectFontStylesheet(document, import.meta.url);

console.info(
  `%c QUIET LUXE %c v${version} `,
  'background:#B08D57;color:#FDFBF6;font-weight:500',
  'color:#8C8578',
);
