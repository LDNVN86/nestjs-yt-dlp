import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Res,
  UsePipes,
} from '@nestjs/common';
import { VideoService, FormatType } from './video.service';
import { Response } from 'express';
import { detectSource } from 'src/utils/detect-source';
import contentDisposition from 'content-disposition';
import { FORMATS_CONFIG } from 'src/constants';
import { UrlValidationPipe } from 'src/common/pipes/url-validation.pipe';

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
};

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('formats')
  @UsePipes(UrlValidationPipe)
  async format(@Query('url') url: string) {
    if (!url) throw new BadRequestException('Missing "url" query parameter');
    const source = detectSource(url);
    const decoded = this.safeDecode(url) ?? url;

    return await this.videoService.listFormats(decoded, source);
  }

  //check format_id example you need format_id X, printerest,....
  @Get('bantumlum')
  bantumlum(@Query('url') url: string) {
    return this.videoService.BanTumLum(url);
  }

  @Get('download')
  async mergeDownload(
    @Query('url') url: string,
    @Query('format') format: string,
    @Query('title') title: string,
    @Res() res: Response,
  ) {
    if (!url || !format) {
      throw new BadRequestException('Vui lòng nhập URL và chọn định dạng');
    }

    const decodedUrl = this.safeDecode(url) ?? url;
    const normalizedFormat = this.normalizeFormat(format);
    if (!normalizedFormat) {
      throw new BadRequestException('Định dạng không hợp lệ');
    }
    const providedTitle = this.safeDecode(title);
    const source = detectSource(decodedUrl);
    const cfg = FORMATS_CONFIG[source];
    if (!cfg) {
      throw new BadRequestException('Nguồn không được hỗ trợ');
    }

    let fileExt: string;
    let formatType: FormatType = 'video';
    let resolvedTitle = providedTitle;

    if (cfg.source === 'tiktok') {
      const list = await this.videoService.listFormats(decodedUrl, 'tiktok');
      const selected = list.options.find(
        (opt: any) => opt.format_id === normalizedFormat,
      );
      if (!selected) {
        throw new BadRequestException(
          `Định dạng ${normalizedFormat} không tồn tại`,
        );
      }
      fileExt = selected.ext;
      formatType = selected.type as FormatType;
      resolvedTitle = resolvedTitle ?? list.title;
    } else {
      const matched = cfg.formats.find(
        (f) => f.format_id === normalizedFormat,
      );
      if (matched) {
        fileExt = matched.ext;
        formatType = matched.type as FormatType;
      } else {
        const list = await this.videoService.listFormats(decodedUrl, source);
        const dynamic = list.options.find(
          (opt) => opt.format_id === normalizedFormat,
        );
        if (!dynamic) {
          throw new BadRequestException(
            `Định dạng ${normalizedFormat} không tồn tại`,
          );
        }
        fileExt = dynamic.ext;
        formatType = dynamic.type as FormatType;
        resolvedTitle = resolvedTitle ?? list.title;
      }
    }

    const safeName = this.buildSafeFileName(resolvedTitle);
    const fileName = `${safeName}.${fileExt}`;
    const contentType = this.resolveMimeType(fileExt, formatType);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition(fileName),
      'Transfer-Encoding': 'chunked',
    });
    res.flushHeaders();

    const stream = await this.videoService.mergeAndStream(
      decodedUrl,
      normalizedFormat,
      fileExt,
    );
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          message: 'Không tải được video!',
          detail: err.message,
        });
      } else {
        res.end();
      }
    });
  }

  private safeDecode(value?: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private normalizeFormat(value: string): string {
    const decoded = this.safeDecode(value) ?? value;
    return decoded.replace(/\s+/g, '+').trim();
  }

  private buildSafeFileName(rawTitle?: string): string {
    const fallback = rawTitle?.trim() || `video_${Date.now()}`;
    return fallback
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\/\\?%*:|"<>]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  }

  private resolveMimeType(ext: string, type: FormatType): string {
    const normalizedExt = ext.toLowerCase();
    const predefined = MIME_BY_EXTENSION[normalizedExt];
    if (predefined) {
      return predefined;
    }
    if (type === 'audio') {
      return `audio/${normalizedExt}`;
    }
    return `video/${normalizedExt}`;
  }
}
