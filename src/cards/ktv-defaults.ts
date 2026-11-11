/**
 * Entity ids the KTV backend publishes. Kept apart from the card so the
 * dashboard strategy can resolve the same defaults without importing (and so
 * registering) the card element.
 */
export const DEFAULT_KTV_ENTITY = 'sensor.ktv_box';
export const DEFAULT_KTV_COMMAND_ENTITY = 'text.ktv_command';
