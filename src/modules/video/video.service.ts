import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { FORMATS_CONFIG, Source } from 'src/constants';
import youtubeDl from 'yt-dlp-exec';
import { ConfigService } from '@nestjs/config';
import ffmpegPath from 'ffmpeg-static';
@Injectable()
export class VideoService {
  constructor(private readonly configService: ConfigService) {}

  //check format_id
  async BanTumLum(url: string) {
    try {
      const raw: any = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      return raw;
    } catch (error) {
      throw new HttpException(
        'Lỗi Url Lấy Thông Tin Tên File',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async listFormats(url: string, source: Source) {
    const cfg = FORMATS_CONFIG[source];
    if (!cfg) {
      throw new HttpException(
        `Nguồn Không Được Hỗ Trợ`,
        HttpStatus.BAD_REQUEST,
      );
    }
    let raw: any;
    try {
      raw = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
    } catch (error) {
      throw new BadRequestException(
        'Không tìm thấy hoặc không thể lấy thông tin từ đường link bạn cung cấp.',
        error,
      );
    }
    const title = raw.title;
    const thumbnail = raw.thumbnail;

    if (cfg.source === 'tiktok') {
      return {
        title,
        thumbnail,
        options: raw.formats.map((f: any) => ({
          label: f.resolution,
          format_id: f.format_id,
          ext: f.ext,
          resolution: f.resolution,
          type: f.dynamic_range,
        })),
      };
    }

    const formatsRaw: any = raw.formats || [];
    const mapped = await cfg.formats
      .map((opt) => {
        const id = opt.format_id;
        if (id.includes('+')) {
          const [vid, aud] = id.split('+');
          if (
            formatsRaw.some((f) => f.format_id === vid) &&
            formatsRaw.some((f) => f.format_id === aud)
          ) {
            return opt;
          }
        } else {
          if (formatsRaw.some((f) => f.format_id === id)) {
            return opt;
          }
        }
        return null;
      })
      .filter((o): o is (typeof cfg.formats)[0] => o !== null);

    return {
      title,
      thumbnail,
      options: mapped,
    };
  }

  async mergeAndStream(
    url: string,
    format: string,
    ext: string,
  ): Promise<PassThrough> {
    const stream = new PassThrough();
    const path = this.configService.get<string>('YTDL_PATH') || 'yt-dlp';
    if (!path) {
      throw new HttpException('Không tìm thấy yt-dlp', HttpStatus.BAD_REQUEST);
    }
    const IsVidAndAud: boolean = format.includes('+');

    const args = [
      url,
      '-f',
      format,
      '--sleep-interval',
      '5',
      '--max-sleep-interval',
      '10',
      '--retries',
      '10',
      '--fragment-retries',
      '10',
      '--geo-bypass',
      '--no-warnings',
      ...(IsVidAndAud
        ? [
            '--merge-output-format',
            ext,
            '--ffmpeg-location',
            ffmpegPath!,
            '--postprocessor-args',
            '-movflags +frag_keyframe+empty_moov+faststart',
          ]
        : []),
      '--no-check-certificate',
      '-o',
      '-',
    ];

    const proc = spawn(path, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.pipe(stream);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => stream.emit('error', err));
    proc.on('close', (code) => {
      if (code !== 0) {
        stream.emit('error', new Error(`ffmpeg exited ${code}\n${stderr}`));
      }
    });

    return stream;
  }
}
