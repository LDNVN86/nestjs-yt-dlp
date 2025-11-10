import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class UrlValidationPipe implements PipeTransform {
  transform(value: unknown) {
    if (typeof value !== 'string') {
      throw new BadRequestException('URL không hợp lệ');
    }

    const decoded = this.safeDecode(value.trim());

    try {
      new URL(decoded);
      return decoded;
    } catch {
      throw new BadRequestException('URL không hợp lệ');
    }
  }

  private safeDecode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}
