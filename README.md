# API yt-dlp (NestJS)

Backend NestJS gói yt-dlp/ffmpeg để lấy metadata, liệt kê định dạng và stream tải video/audio trực tiếp từ YouTube, Facebook, Instagram, TikTok.

## Điểm nổi bật
- Tự nhận diện nguồn từ URL và đọc config định dạng theo từng nền tảng.
- Trả về danh sách format đã chuẩn hóa (có kích thước ước tính, fps, loại stream) và fallback tự động khi config không khớp.
- Stream tải xuống qua `PassThrough`, hỗ trợ gộp audio+video, đặt `Content-Disposition` an toàn và MIME động.
- Xử lý lỗi nguồn: retry HLS 403, fallback `ytdl-core` cho YouTube, cảnh báo khi format không có sẵn.
- Linh hoạt binary: ưu tiên `YTDL_PATH`, sau đó binary đóng gói của `yt-dlp-exec`, cuối cùng là `yt-dlp` trong PATH; dùng `ffmpeg-static` khi cần merge.
- CORS bật sẵn, có `ValidationPipe` và pipe kiểm tra URL.

## Cấu trúc nhanh
```
src/
  main.ts
  app.module.ts
  common/          # pipe, filter dùng chung
  configs/         # config định dạng từng nguồn (JSON)
  constants/       # FORMATS_CONFIG + type Source
  modules/
    video/         # controller + service chính
  utils/           # detect source, format byte
test/
```

## Yêu cầu hệ thống
- Node.js 18+ (khuyến nghị).
- `yt-dlp` binary: đã kèm trong `yt-dlp-exec`, hoặc cài global và/hoặc trỏ bằng `YTDL_PATH`.
- `ffmpeg`: dùng bản đi kèm (`ffmpeg-static`) hoặc cài hệ thống (`apt-get install ffmpeg`).

## Thiết lập nhanh
```bash
npm install
cp .env.example .env
# Sửa PORT, YTDL_PATH (nếu muốn dùng binary riêng), TIKTOK_MS_TOKEN (nếu cần cookie).
npm run start:dev
```

## Biến môi trường
- `PORT`: cổng chạy API (mặc định 8081).
- `YTDL_PATH`: đường dẫn tới binary yt-dlp tùy chỉnh. Nếu bỏ trống sẽ ưu tiên binary kèm package, sau đó đến yt-dlp trong PATH.
- `YTDL_METADATA_TIMEOUT`: timeout lấy metadata (ms), mặc định 20000.
- `TIKTOK_MS_TOKEN`: dự phòng cho token TikTok; hiện code chưa sử dụng.

## Cấu hình định dạng tải xuống
- Các preset lưu tại `src/configs/*.formats.config.json`. Mỗi item: `label`, `format_id`, `ext`, `resolution`, `type` (`audio` | `video` | `audio+video`).
- Mỗi nền tảng có thể tùy chỉnh danh sách format riêng. Nếu format_id không tồn tại trong metadata thực tế, service tự sinh danh sách fallback (progressive, audio-only, ghép audio+video tốt nhất).
- `FORMATS_CONFIG` tập hợp các file config trên và được controller/service dùng để dựng options.

## API
- `GET /video/formats?url={VIDEO_URL}`
  - Trả metadata + danh sách format khả dụng.
  - Ví dụ phản hồi rút gọn:
```json
{
  "title": "Sample title",
  "thumbnail": "https://...",
  "duration": 123,
  "uploader": "Channel",
  "source": "youtube",
  "options": [
    {
      "label": "720p mp4 (audio+video)",
      "format_id": "136+140",
      "ext": "mp4",
      "resolution": "1280x720",
      "type": "audio+video",
      "sizeLabel": "35.1 MB",
      "fps": 30
    }
  ]
}
```

- `GET /video/download?url={VIDEO_URL}&format={FORMAT_ID}[&title=CustomName]`
  - Stream file về client, merge audio+video nếu cần. `format` lấy từ `options` của `/video/formats`.
  - Tiêu đề được sanitize, MIME tự động theo đuôi hoặc loại stream.

- `GET /video/bantumlum?url={VIDEO_URL}`
  - Trả metadata raw từ yt-dlp (dùng để debug format_id).

## Ghi chú vận hành
- URL được decode an toàn và validate trước khi xử lý.
- Với nguồn YouTube HLS 403, service tự retry với flags remux; nếu vẫn lỗi sẽ fallback sang `ytdl-core`.
- Khi định dạng không tồn tại, service thử fallback (`bestaudio/best` hoặc `bv*+ba/best`) để giảm lỗi tải xuống.

## Lệnh hữu ích
- `npm run start:dev` - chạy dev có watch.
- `npm run build` rồi `npm run start:prod` - chạy production.
- `npm run lint` - ESLint + Prettier.
- `npm test`, `npm run test:e2e`, `npm run test:cov` - bộ lệnh kiểm thử.

## Giấy phép
- `package.json` đang để `UNLICENSED`. Cập nhật trường `license` hoặc thêm file LICENSE nếu muốn phân phối công khai.
