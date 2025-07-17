import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class UrlValidationPipe implements PipeTransform {
  transform(value: any) {
    try {
      new URL(value);
      return value;
    } catch {
      throw new BadRequestException('URL không hợp lệ');
    }
  }
}
