import YTConfig from '../configs/youtube.formats.config.json';
import FBConfig from '../configs/facebook.formats.config.json';
import TTConfig from '../configs/tiktok.formats.config.json';
import IGConfig from '../configs/instagram.formats.config.json';

export const FORMATS_CONFIG = {
  youtube: YTConfig,
  facebook: FBConfig,
  tiktok: TTConfig,
  instagram: IGConfig,
} as const;

export type Source = keyof typeof FORMATS_CONFIG;
