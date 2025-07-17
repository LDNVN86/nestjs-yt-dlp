import { IsOptional, IsString } from 'class-validator';

export class CreateVideoDto {
  @IsOptional()
  @IsString({ message: 'Url Phải Là 1 Chuỗi' })
  url: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString({ message: 'Format Không Đúng Định Dạng' })
  format?: string;
}
