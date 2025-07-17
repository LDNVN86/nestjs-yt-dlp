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
import { ConfigService } from '@nestjs/config';
import ffmpegPath from 'ffmpeg-static';
@Injectable()
export class VideoService {
  constructor(private readonly configService: ConfigService) {}

  async metaData(url: string): Promise<{ title: string }> {
    try {
      const { title }: any = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      console.log(title);
      return { title };
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

  download(url: string, format: string, ext: string): PassThrough {
    const stream = new PassThrough();
    const path = this.configService.get<string>('YTDL_PATH') || 'yt-dlp';
    if (!path) {
      throw new HttpException('Không tìm thấy yt-dlp', HttpStatus.BAD_REQUEST);
    }
    const args = [
      url,
      '-f',
      format,
      '-o',
      '-',
      '--no-check-certificates',
      '--no-warnings',
      '--prefer-free-formats',
    ];
    if (format.includes('+')) {
      args.push(
        '--merge-output-format',
        ext,
        '--ffmpeg-location',
        ffmpegPath!,
        '--postprocessor-args',
        '-movflags +frag_keyframe+empty_moov+faststart',
      );
    }
    console.log('Spawning yt-dlp with args:', args);
    const proc = spawn(path, args);

    let stderr = '';
    proc.stdout.pipe(stream);
    proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      stderr += msg;
      console.warn('[yt-dlp stderr]', msg.trim());
    });

    proc.on('error', (err) => {
      stream.emit('error', new Error(`Spawn process failed: ${err.message}`));
    });

    proc.on('close', (code) => {
      console.log(`yt-dlp exited with code ${code}`);
      if (code !== 0) {
        stream.emit(
          'error',
          new Error(`yt-dlp exited with code ${code}\n${stderr}`),
        );
      }
    });

    return stream;
  }
}
