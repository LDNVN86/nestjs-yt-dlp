import { HttpException, HttpStatus } from '@nestjs/common';
import { Source } from 'src/constants';

export const detectSource = (url: string): Source => {
  const detect = url.toLowerCase();
  if (/(youtube\.com|youtu\.be)/.test(detect)) return 'youtube';
  if (/facebook\.com|fb\.watch/.test(detect)) return 'facebook';
  if (/tiktok\.com/.test(detect)) return 'tiktok';
  if (/instagram\.com/.test(detect)) return 'instagram';
  throw new HttpException(
    'Không Nhận Diện Được Đường Dẫn Của Bạn Hoặc Đường Dẫn Từ Nguồn Của Bạn Không Được Hỗ Trợ',
    HttpStatus.BAD_REQUEST,
  );
};
