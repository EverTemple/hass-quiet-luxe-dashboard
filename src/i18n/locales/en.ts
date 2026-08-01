export const en = {
  'common.on': 'On',
  'common.off': 'Off',
  'common.unavailable': 'Unavailable',
  'common.offline': 'Offline',
  'common.back': 'Back',
  'greeting.morning': 'Good morning',
  'greeting.afternoon': 'Good afternoon',
  'greeting.evening': 'Good evening',
  'section.rooms': 'Rooms',
  'section.climate': 'Climate',
  'section.music': 'Music',
  'section.schedule': 'Schedule',
  'section.scenes': 'Scenes',
  'section.cameras': 'Cameras',
  'section.energy': 'Energy',
  'section.all_climates': 'All climates',
} as const;

export type TranslationKey = keyof typeof en;

export type TranslationTable = Readonly<Record<TranslationKey, string>>;
