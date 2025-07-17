import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Res,
  UsePipes,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { Response } from 'express';
import { detectSource } from 'src/utils/detect-source';
import contentDisposition from 'content-disposition';
import { FORMATS_CONFIG } from 'src/constants';
import { UrlValidationPipe } from 'src/common/pipes/url-validation.pipe';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('formats')
  @UsePipes(UrlValidationPipe)
  async format(@Query('url') url: string) {
    if (!url) throw new BadRequestException('Missing "url" query parameter');
    const source = detectSource(url);
    const decoded: string = decodeURIComponent(url);

    return this.videoService.listFormats(decoded, source);
  }

  //check format_id example you need format_id X, printerest,
  @Get('bantumlum')
  bantumlum(@Query('url') url: string) {
    return this.videoService.BanTumLum(url);
  }

  @Get('download')
  async mergeDownload(
    @Query('url') url: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    if (!url || !format) {
      throw new BadRequestException('Vui lòng nhập URL và chọn định dạng');
    }

    const decodedUrl = decodeURIComponent(url);
    const decodedFormat = format.replace(/\s+/g, '+');
    const source = detectSource(decodedUrl);
    const cfg = FORMATS_CONFIG[source];
    if (!cfg) {
      throw new BadRequestException('Nguồn không được hỗ trợ');
    }
    if (!cfg.formats.some((f) => f.format_id === decodedFormat)) {
      throw new BadRequestException(`Định dạng ${decodedFormat} không tồn tại`);
    }

    const ext = cfg.formats.find((f) => f.format_id === decodedFormat)!.ext;
    const { title } = await this.videoService.metaData(url);
    const safeName = `${title || `video_${Date.now()}`} `
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\/\\?%*:|"<>]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const filename = `${safeName}.${ext}`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    const stream = await this.videoService.mergeAndStream(
      decodedUrl,
      decodedFormat,
      ext,
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
}
