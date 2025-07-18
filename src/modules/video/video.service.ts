import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { FORMATS_CONFIG, Source } from 'src/constants';
// import { ytdlp } from 'youtube-dl-exec';
import ytdlp from 'yt-dlp-exec';
import { ConfigService } from '@nestjs/config';
import ffmpegPath from 'ffmpeg-static';
@Injectable()
export class VideoService {
  constructor(private readonly configService: ConfigService) {}

  // private getBaseYtdlpOptions() {
  //   const agent = this.configService.get<string>('USER_AGENT');
  //   const cookieFile = this.configService.get<string>('YTDLP_COOKIE_FILE');
  //   const referer = this.configService.get<string>('TIKTOK_REFERER');

  //   return {
  //     dumpSingleJson: true,
  //     noCheckCertificate: true,
  //     noWarnings: true,
  //     preferFreeFormats: true,
  //     addHeader: [`User-Agent: ${agent}`, `Referer: ${referer}`],
  //     extractorArgs: {
  //       tiktok: {
  //         cookiefile: cookieFile,
  //       },
  //     },
  //   } as const;
  // }

  async metaData(url: string): Promise<{ title: string }> {
    try {
      const { title }: any = await ytdlp(url, {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      return { title };
    } catch (error) {
      throw new HttpException(
        'Lỗi Url Lấy Thông Tin Tên File',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getThumbnails(url: string) {
    try {
      const raw: any = await ytdlp(url, {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      return raw.thumbnail;
    } catch (error) {
      throw new HttpException(
        'Lỗi Url Lấy Thông Tin Tên File',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  //check format_id
  async BanTumLum(url: string) {
    try {
      const raw: any = await ytdlp(url, {
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

  async getDirectUrl(url: string, format: string): Promise<string> {
    try {
      const direct: any = await ytdlp(url, {
        format,
        getUrl: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      return direct.trim();
    } catch (err) {
      throw new HttpException(
        'Không thể lấy direct URL',
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
      raw = await ytdlp(url, {
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

    if (cfg.source === 'tiktok') {
      return {
        title,
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
    const mapped = cfg.formats
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
      options: mapped,
    };
  }

  async mergeAndStream(
    url: string,
    format: string,
    ext: string,
  ): Promise<PassThrough> {
    const stream = new PassThrough();

    let videoUrl: string;
    let audioUrl: string | null = null;

    if (format.includes('+')) {
      const [vid, adu] = format.split('+');
      [videoUrl, audioUrl] = await Promise.all([
        this.getDirectUrl(url, vid),
        this.getDirectUrl(url, adu),
      ]);
    } else {
      videoUrl = await this.getDirectUrl(url, format);
    }

    const args: string[] = [];
    args.push('-i', videoUrl);
    if (audioUrl) {
      args.push('-i', audioUrl);
    }
    args.push(
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-f',
      ext,
      '-movflags',
      '+frag_keyframe+empty_moov+faststart',
      'pipe:1',
    );

    const proc = spawn(ffmpegPath!, args, {
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
