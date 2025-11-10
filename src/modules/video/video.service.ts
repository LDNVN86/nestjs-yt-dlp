import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { FORMATS_CONFIG, Source } from 'src/constants';
import youtubeDl from 'yt-dlp-exec';
import { ConfigService } from '@nestjs/config';
import ffmpegPath from 'ffmpeg-static';
import { formatBytes } from 'src/utils/format-bytes';
import ytdl, { videoFormat, thumbnail } from 'ytdl-core';

export type FormatType = 'audio' | 'video' | 'audio+video';

interface FormatConfigEntry {
  label: string;
  format_id: string;
  ext: string;
  resolution: string;
  type: FormatType;
}

interface RawFormatEntry {
  format_id: string;
  format?: string;
  format_note?: string;
  ext: string;
  protocol?: string;
  manifest_url?: string;
  audio_ext?: string;
  video_ext?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  resolution?: string;
  dynamic_range?: string;
}

export interface ListFormatOption {
  label: string;
  format_id: string;
  ext: string;
  resolution: string;
  type: FormatType;
  sizeBytes?: number;
  sizeLabel?: string;
  fps?: number | null;
}

export interface ListFormatsPayload {
  title: string;
  thumbnail: string;
  duration?: number;
  uploader?: string;
  source: Source;
  options: ListFormatOption[];
}

interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration?: number;
  uploader?: string;
  formatsRaw: RawFormatEntry[];
}
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly metadataTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configuredTimeout =
      this.configService.get<number>('YTDL_METADATA_TIMEOUT');
    this.metadataTimeoutMs =
      typeof configuredTimeout === 'number' && configuredTimeout > 0
        ? configuredTimeout
        : 20000;
  }

  //check format_id
  async BanTumLum(url: string) {
    try {
      return await this.runMetadataExtraction(url);
    } catch (error) {
      throw new HttpException(
        'Lỗi Url Lấy Thông Tin Tên File',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async listFormats(url: string, source: Source): Promise<ListFormatsPayload> {
    const cfg = FORMATS_CONFIG[source];
    if (!cfg) {
      throw new HttpException(
        `Nguồn Không Được Hỗ Trợ`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const metadata = await this.fetchVideoMetadata(url, source);
    let options =
      cfg.source === 'tiktok'
        ? this.mapTikTokFormats(metadata.formatsRaw)
        : this.mapConfiguredFormats(
            cfg.formats as FormatConfigEntry[],
            metadata.formatsRaw,
          );

    if (!options.length) {
      options = this.buildFallbackFormats(metadata.formatsRaw);
      if (!options.length) {
        throw new HttpException(
          'Không tìm thấy định dạng nào phù hợp cho video này.',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.warn(
        `Applied fallback formats for ${source} at ${url} due to missing config matches`,
      );
    }

    return {
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      uploader: metadata.uploader,
      source,
      options,
    };
  }

  async mergeAndStream(
    url: string,
    format: string,
    ext: string,
  ): Promise<PassThrough> {
    const stream = new PassThrough();
    const binaryPath = this.resolveYtdlBinary();
    const spawnDownload = (
      formatSelector: string,
      useHlsWorkaround = false,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        const args = this.buildDownloadArgs(
          url,
          formatSelector,
          ext,
          useHlsWorkaround,
        );

        const proc = spawn(binaryPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        proc.stdout.pipe(stream, { end: false });
        let stderr = '';
        proc.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
          if (code === 0) {
            stream.end();
            resolve();
          } else if (!useHlsWorkaround && this.isHls403(stderr)) {
            this.logger.warn(
              `Detected HLS fragment 403; retrying with remux workaround (${formatSelector})`,
            );
            spawnDownload(formatSelector, true).then(resolve).catch(reject);
          } else {
            reject(new Error(`yt-dlp exited ${code}\n${stderr}`));
          }
        });
      });

    try {
      await spawnDownload(format, false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (this.isFormatUnavailable(message)) {
        const fallbackFormat = this.getFormatFallback(ext);
        this.logger.warn(
          `Format ${format} unavailable, falling back to ${fallbackFormat}`,
        );
        await spawnDownload(fallbackFormat, false);
      } else {
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      }
    }

    return stream;
  }

  private async fetchVideoMetadata(
    url: string,
    source: Source,
  ): Promise<VideoMetadata> {
    try {
      const raw = await this.runMetadataExtraction(url);
      return this.mapMetadataResponse(raw);
    } catch (error) {
      let lastError = this.extractErrorMessage(error);
      this.logger.warn(
        `yt-dlp metadata fetch failed for ${url}: ${lastError}`,
      );

      if (source === 'youtube' && this.isHls403(lastError)) {
        this.logger.warn(
          `Retrying metadata extraction with HLS workaround for ${url}`,
        );
        try {
          const raw = await this.runMetadataExtraction(url, true);
          return this.mapMetadataResponse(raw);
        } catch (retryError) {
          lastError = this.extractErrorMessage(retryError);
          this.logger.warn(
            `yt-dlp metadata retry failed for ${url}: ${lastError}`,
          );
        }
      }

      if (source === 'youtube') {
        return this.fetchWithYtdlCore(url);
      }
      throw new BadRequestException(
        'Không tìm thấy hoặc không thể lấy thông tin từ đường link bạn cung cấp.',
        lastError,
      );
    }
  }

  private async runMetadataExtraction(
    url: string,
    useHlsWorkaround = false,
  ): Promise<any> {
    return youtubeDl(
      url,
      this.buildMetadataFlags(useHlsWorkaround),
      {
        timeout: this.metadataTimeoutMs,
      },
    );
  }

  private buildMetadataFlags(useHlsWorkaround: boolean) {
    const flags: any = {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      noPlaylist: true,
      playlistItems: '1',
      skipUnavailableFragments: true,
      abortOnUnavailableFragment: false,
    };

    if (useHlsWorkaround) {
      flags.youtubeSkipDashManifest = true;
      flags.hlsPreferNative = true;
      flags.forceIpv4 = true;
    }

    return flags;
  }

  private mapMetadataResponse(raw: any): VideoMetadata {
    return {
      title: raw?.title ?? 'unknown',
      thumbnail: raw?.thumbnail ?? '',
      duration: raw?.duration,
      uploader: raw?.uploader,
      formatsRaw: (raw?.formats || []) as RawFormatEntry[],
    };
  }

  private async fetchWithYtdlCore(url: string): Promise<VideoMetadata> {
    try {
      const info = await ytdl.getInfo(url);
      return {
        title: info.videoDetails.title ?? 'unknown',
        thumbnail: this.pickBestThumbnail(info.videoDetails.thumbnails),
        duration: info.videoDetails.lengthSeconds
          ? Number(info.videoDetails.lengthSeconds)
          : undefined,
        uploader: info.videoDetails.author?.name,
        formatsRaw: info.formats.map((format) => this.mapYtdlFormat(format)),
      };
    } catch (error) {
      this.logger.error(
        `ytdl-core fallback failed for ${url}: ${this.extractErrorMessage(error)}`,
      );
      throw new BadRequestException(
        'Không tìm thấy hoặc không thể lấy thông tin từ đường link bạn cung cấp.',
        this.extractErrorMessage(error),
      );
    }
  }

  private mapConfiguredFormats(
    configs: FormatConfigEntry[],
    rawFormats: RawFormatEntry[],
  ): ListFormatOption[] {
    const options: ListFormatOption[] = [];

    configs.forEach((option) => {
      const segments = this.resolveFormatSegments(option.format_id, rawFormats);
      if (!segments) {
        return;
      }
      const videoSegment = segments.find((segment) => this.hasVideo(segment));
      const sizeBytes = this.calculateFilesize(segments);

      options.push({
        ...option,
        resolution: videoSegment
          ? this.composeResolution(videoSegment)
          : option.resolution,
        fps: videoSegment?.fps ?? null,
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
      });
    });

    return options;
  }

  private mapTikTokFormats(rawFormats: RawFormatEntry[]): ListFormatOption[] {
    const seen = new Set<string>();
    const options = rawFormats
      .filter((format) => !!format.format_id && !!format.ext)
      .map((format) => {
        const type = this.detectStreamType(format);
        const sizeBytes = this.calculateFilesize([format]);
        return {
          label:
            format.format ||
            format.format_note ||
            this.composeResolution(format),
          format_id: String(format.format_id),
          ext: format.ext,
          resolution: this.composeResolution(format),
          type,
          fps: format.fps ?? null,
          sizeBytes,
          sizeLabel: formatBytes(sizeBytes),
        };
      });

    return options.filter((option) => {
      if (seen.has(option.format_id)) {
        return false;
      }
      seen.add(option.format_id);
      return true;
    });
  }

  private resolveFormatSegments(
    formatId: string,
    rawFormats: RawFormatEntry[],
  ): RawFormatEntry[] | null {
    const ids = formatId.includes('+') ? formatId.split('+') : [formatId];
    const matched = ids
      .map((id) => rawFormats.find((format) => format.format_id === id))
      .filter(
        (format): format is RawFormatEntry => format !== undefined,
      );
    return matched.length === ids.length ? matched : null;
  }

  private calculateFilesize(formats: RawFormatEntry[]): number | undefined {
    const total = formats.reduce((acc, format) => {
      if (!format) return acc;
      const size = format.filesize ?? format.filesize_approx ?? 0;
      return acc + size;
    }, 0);
    return total > 0 ? total : undefined;
  }

  private composeResolution(format?: RawFormatEntry): string {
    if (!format) {
      return 'audio only';
    }
    if (format.resolution) {
      return format.resolution;
    }
    if (format.width && format.height) {
      return `${format.width}x${format.height}`;
    }
    return this.hasVideo(format) ? 'video' : 'audio only';
  }

  private detectStreamType(format: RawFormatEntry): FormatType {
    const hasVideo = this.hasVideo(format);
    const hasAudio = this.hasAudio(format);
    if (hasVideo && hasAudio) {
      return 'audio+video';
    }
    if (hasVideo) {
      return 'video';
    }
    return 'audio';
  }

  private hasVideo(format?: RawFormatEntry): boolean {
    if (!format) {
      return false;
    }
    return this.isHlsMuxed(format) || (!!format.vcodec && format.vcodec !== 'none');
  }

  private hasAudio(format?: RawFormatEntry): boolean {
    if (!format) {
      return false;
    }
    return this.isHlsMuxed(format) || (!!format.acodec && format.acodec !== 'none');
  }

  private resolveYtdlBinary(): string {
    const configured = this.configService.get<string>('YTDL_PATH');
    if (configured) {
      if (existsSync(configured)) {
        return configured;
      }
      this.logger.warn(
        `Configured YTDL_PATH "${configured}" không tồn tại, thử dùng binary cài cùng dự án.`,
      );
    }

    const bundled = this.getBundledYtdlPath();
    if (bundled) {
      return bundled;
    }

    const fallback = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    this.logger.warn(
      `Không tìm thấy binary yt-dlp trong node_modules. Sẽ gọi "${fallback}" từ PATH. Vui lòng cài yt-dlp global hoặc đặt YTDL_PATH.`,
    );
    return fallback;
  }

  private isHls403(stderr: string): boolean {
    return /HTTP Error 403/i.test(stderr) && /fragment/i.test(stderr);
  }

  private isFormatUnavailable(stderr: string): boolean {
    return /Requested format is not available/i.test(stderr);
  }

  private buildDownloadArgs(
    url: string,
    formatSelector: string,
    ext: string,
    useHlsWorkaround: boolean,
  ): string[] {
    const base = [
      url,
      '-f',
      formatSelector,
      '--no-playlist',
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
      ...(formatSelector.includes('+')
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

    if (!useHlsWorkaround) {
      return base;
    }

    return [
      ...base,
      '--remux-video',
      'mp4',
      '--extractor-args',
      'youtube:skip=hls,dash',
    ];
  }

  private getFormatFallback(ext: string): string {
    const audioExts = ['m4a', 'mp3', 'aac', 'opus', 'webm'];
    return audioExts.includes(ext.toLowerCase())
      ? 'bestaudio/best'
      : 'bv*+ba/best';
  }

  private getBundledYtdlPath(): string | null {
    const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const candidate = join(
      process.cwd(),
      'node_modules',
      'yt-dlp-exec',
      'bin',
      binName,
    );
    if (existsSync(candidate)) {
      return candidate;
    }
    return null;
  }

  private isPlayableFormat(format?: RawFormatEntry): boolean {
    if (!format) {
      return false;
    }
    const ext = format.ext?.toLowerCase();
    if (!ext || ext === 'mhtml') {
      return false;
    }
    return this.hasAudio(format) || this.hasVideo(format);
  }

  private isHlsMuxed(format: RawFormatEntry): boolean {
    const protocol = format.protocol?.toLowerCase();
    if (protocol && protocol.includes('m3u8')) {
      return true;
    }
    const manifest = format.manifest_url?.toLowerCase();
    if (manifest && manifest.includes('m3u8')) {
      return true;
    }
    return false;
  }

  private buildFallbackFormats(
    rawFormats: RawFormatEntry[],
  ): ListFormatOption[] {
    const seen = new Set<string>();
    const options: ListFormatOption[] = [];

    const playableFormats = rawFormats.filter((format) =>
      this.isPlayableFormat(format),
    );

    const progressiveFormats = playableFormats.filter(
      (format) => this.detectStreamType(format) === 'audio+video',
    );
    const audioOnlyFormats = playableFormats.filter(
      (format) => this.detectStreamType(format) === 'audio',
    );
    const videoOnlyFormats = playableFormats.filter(
      (format) => this.detectStreamType(format) === 'video',
    );

    const pushOption = (option: ListFormatOption) => {
      if (seen.has(option.format_id)) {
        return;
      }
      options.push(option);
      seen.add(option.format_id);
    };

    const limit = 12;

    // 1) Giữ lại các định dạng progressive (có sẵn audio + video)
    for (const format of this.sortByVideoQuality(progressiveFormats)) {
      if (options.length >= limit) {
        break;
      }
      if (!format.format_id || !format.ext) {
        continue;
      }
      const sizeBytes = this.calculateFilesize([format]);
      pushOption({
        label: this.composeFallbackLabel(format, 'audio+video'),
        format_id: format.format_id,
        ext: format.ext,
        resolution: this.composeResolution(format),
        type: 'audio+video',
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        fps: format.fps ?? null,
      });
    }

    // 2) Thêm các định dạng audio only
    for (const audio of this.sortByAudioQuality(audioOnlyFormats)) {
      if (options.length >= limit) {
        break;
      }
      if (!audio.format_id || !audio.ext) {
        continue;
      }
      const sizeBytes = this.calculateFilesize([audio]);
      pushOption({
        label: this.composeFallbackLabel(audio, 'audio'),
        format_id: audio.format_id,
        ext: audio.ext,
        resolution: this.composeResolution(audio),
        type: 'audio',
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        fps: audio.fps ?? null,
      });
    }

    // 3) Tạo định dạng audio+video bằng cách ghép video-only + audio-only tốt nhất
    const bestAudio = this.sortByAudioQuality(audioOnlyFormats)[0];
    if (bestAudio) {
      for (const video of this.sortByVideoQuality(videoOnlyFormats)) {
        if (options.length >= limit) {
          break;
        }
        if (!video.format_id || !video.ext) {
          continue;
        }
        const formatId = `${video.format_id}+${bestAudio.format_id}`;
        if (seen.has(formatId)) {
          continue;
        }
        const sizeBytes = this.calculateFilesize([video, bestAudio]);
        pushOption({
          label: this.composeCombinedLabel(video, bestAudio),
          format_id: formatId,
          ext: video.ext,
          resolution: this.composeResolution(video),
          type: 'audio+video',
          sizeBytes,
          sizeLabel: formatBytes(sizeBytes),
          fps: video.fps ?? null,
        });
      }
    }

    return options.slice(0, limit);
  }

  private composeFallbackLabel(
    format: RawFormatEntry,
    type: FormatType,
  ): string {
    const resolution = this.composeResolution(format);
    const fps = format.fps ? `${format.fps}fps` : null;
    const pieces = [resolution, fps].filter(Boolean).join(' · ');
    const typeLabel =
      type === 'audio'
        ? 'Audio'
        : type === 'audio+video'
          ? 'Audio + Video'
          : 'Video';

    return `${typeLabel} - ${pieces || format.ext.toUpperCase()}`;
  }

  private composeCombinedLabel(
    video: RawFormatEntry,
    audio: RawFormatEntry,
  ): string {
    const resolution = this.composeResolution(video);
    const fps = video.fps ? `${video.fps}fps` : null;
    const suffix = [resolution, fps]
      .filter(Boolean)
      .join(' · ')
      .trim();
    return `Video + Audio - ${suffix || video.ext.toUpperCase()}`;
  }

  private sortByVideoQuality(formats: RawFormatEntry[]): RawFormatEntry[] {
    return [...formats].sort((a, b) => {
      const heightDiff = (b.height ?? 0) - (a.height ?? 0);
      if (heightDiff !== 0) {
        return heightDiff;
      }
      return (b.fps ?? 0) - (a.fps ?? 0);
    });
  }

  private sortByAudioQuality(formats: RawFormatEntry[]): RawFormatEntry[] {
    return [...formats].sort(
      (a, b) =>
        (b.filesize ?? b.filesize_approx ?? 0) -
        (a.filesize ?? a.filesize_approx ?? 0),
    );
  }

  private pickBestThumbnail(thumbnails?: thumbnail[]): string {
    if (!thumbnails?.length) {
      return '';
    }
    return thumbnails[thumbnails.length - 1]?.url ?? thumbnails[0].url;
  }

  private mapYtdlFormat(format: videoFormat): RawFormatEntry {
    const { ext, codecs } = this.parseMimeType(format);
    const vcodec = format.hasVideo ? codecs[0] ?? 'video' : 'none';
    const acodec = format.hasAudio
      ? codecs[codecs.length - 1] ?? codecs[0] ?? 'audio'
      : 'none';
    const resolution =
      format.qualityLabel ??
      (format.hasAudio && !format.hasVideo ? 'audio only' : undefined);

    return {
      format_id: String(format.itag),
      format: format.qualityLabel ?? format.mimeType,
      format_note: format.qualityLabel ?? undefined,
      ext,
      protocol: (format as any).protocol,
      manifest_url: (format as any).manifest_url,
      width: format.width ?? undefined,
      height: format.height ?? undefined,
      fps: format.fps ?? undefined,
      vcodec,
      acodec,
      filesize: this.parseContentLength(format.contentLength),
      resolution,
      dynamic_range: undefined,
    };
  }

  private parseMimeType(
    format: videoFormat,
  ): { ext: string; codecs: string[] } {
    const fallbackExt =
      format.container || (format.hasVideo ? 'mp4' : 'm4a');
    if (!format.mimeType) {
      return { ext: fallbackExt, codecs: [] };
    }
    const [typePart] = format.mimeType.split(';');
    const ext = typePart?.split('/')[1] ?? fallbackExt;
    const codecsMatch = format.mimeType.match(/codecs="([^"]+)"/);
    const codecs = codecsMatch
      ? codecsMatch[1].split(',').map((codec) => codec.trim())
      : [];
    return { ext, codecs };
  }

  private parseContentLength(value?: string | number | null): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed =
      typeof value === 'string' ? parseInt(value, 10) : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) {
      return 'Unknown error';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      const stderr = (error as any)?.stderr;
      return stderr || error.message;
    }
    if (typeof error === 'object') {
      const err = error as Record<string, any>;
      if (err.stderr || err.message) {
        return err.stderr || err.message;
      }
      try {
        return JSON.stringify(err);
      } catch {
        return 'Unknown error';
      }
    }
    return 'Unknown error';
  }
}
