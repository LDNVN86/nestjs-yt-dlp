import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { FORMATS_CONFIG, Source } from 'src/constants';
import { youtubeDl } from 'youtube-dl-exec';
// import youtubeDl from 'yt-dlp-exec';
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
        noCheckCertificates: true,
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
      const direct: any = await youtubeDl(url, {
        format,
        getUrl: true,
        noCheckCertificates: true,
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
      raw = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
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

    const commonFlags: string[] = [];
    if (url.includes('tiktok.com')) {
      commonFlags.push(
        '-user_agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/115.0.0.0 Safari/537.36',
        '-referer',
        'https://www.tiktok.com/',
        '-http_persistent',
        '0',
      );
    }

    const args: string[] = [];
    args.push(...commonFlags, '-i', videoUrl);
    if (audioUrl) {
      args.push(...commonFlags, '-i', audioUrl);
    }

    if (ext === 'm4a') {
      args.push(
        '-map',
        '0:a:0',
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+frag_keyframe+empty_moov+default_base_moof+separate_moof',
        '-f',
        'mp4',
        'pipe:1',
      );
    } else {
      args.push(
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-movflags',
        '+frag_keyframe+empty_moov+faststart',
        '-f',
        ext,
        'pipe:1',
      );
    }

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
