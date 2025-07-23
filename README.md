# nestjs-yt-dlp

<!-- Bilingual README: Vietnamese / English -->

## Cấu trúc thư mục (độ sâu 2)

````bash
nestjs-yt-dlp/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── app.controller.ts
│   └── app.service.ts
├── yt-dlp/
│   ├── yt-dlp.module.ts
│   ├── yt-dlp.controller.ts
│   └── yt-dlp.service.ts
├── test/
│   └── app.e2e-spec.ts
├── .env.example
├── .gitignore
├── .prettierrc
├── Aptfile
├── README.md
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── package-lock.json
├── tsconfig.build.json
├── tsconfig.json
```bash
nestjs-yt-dlp/
├── src/                  # Mã nguồn chính của ứng dụng
│   ├── main.ts           # Entry point (thiết lập NestFactory)
│   ├── app.module.ts     # Module gốc
│   ├── app.controller.ts # Controller ví dụ (nếu có)
│   └── app.service.ts    # Service ví dụ (nếu có)
├── yt-dlp/               # Module xử lý yt-dlp
│   ├── yt-dlp.module.ts      # Đăng ký module
│   ├── yt-dlp.controller.ts  # Định nghĩa API endpoints
│   └── yt-dlp.service.ts     # Logic tương tác với yt-dlp
├── test/                 # Unit & e2e tests
│   └── app.e2e-spec.ts   # Ví dụ kiểm thử end-to-end
├── .env.example          # Mẫu biến môi trường
├── .gitignore            # Loại trừ file khi commit
├── .prettierrc           # Cấu hình Prettier
├── Aptfile               # (Vercel) cài đặt gói hệ thống
├── README.md             # File README này
├── eslint.config.mjs     # Cấu hình ESLint
├── nest-cli.json         # Cấu hình Nest CLI
├── package.json          # Dependencies & scripts
├── package-lock.json     # Khóa phiên bản npm
├── tsconfig.json         # Cấu hình TypeScript
└── tsconfig.build.json   # Cấu hình build cho Nest
````

## 🇻🇳 Giới thiệu

`nestjs-yt-dlp` là backend API chuyên nghiệp cho yt-dlp, xây dựng trên nền tảng NestJS, hỗ trợ tải video từ YouTube, Facebook, Instagram, TikTok…

## 🇬🇧 Introduction

`nestjs-yt-dlp` is a professional backend API for yt-dlp, built with NestJS framework, supporting video downloads from YouTube, Facebook, Instagram, TikTok, and more.

---

## 🇻🇳 Tính năng chính

* **Đa nền tảng**: Hỗ trợ YouTube, Facebook, Instagram, TikTok, v.v.
* **RESTful API**: Định nghĩa rõ ràng, dễ tích hợp với frontend.
* **Xử lý song song**: Tối ưu hiệu suất khi có nhiều yêu cầu đồng thời.
* **Cấu hình linh hoạt**: Sử dụng biến môi trường để tùy chỉnh.
* **Logging & Error Handling**: Ghi log đầy đủ, thông báo lỗi rõ ràng.

## 🇬🇧 Key Features

* **Cross-platform**: Supports YouTube, Facebook, Instagram, TikTok, etc.
* **RESTful API**: Clear endpoints for easy frontend integration.
* **Concurrency**: Efficient handling of multiple download requests.
* **Configurable**: Environment variables for customization.
* **Logging & Error Handling**: Comprehensive logs and clear error responses.

---

## 🇻🇳 Công nghệ sử dụng

* **NestJS** (v10.x)
* **TypeScript**
* **yt-dlp** (thông qua child\_process)
* **dotenv** (quản lý biến môi trường)
* **Swagger** (tài liệu API)
* **Jest** (kiểm thử)

## 🇬🇧 Tech Stack

* **NestJS** (v10.x)
* **TypeScript**
* **yt-dlp** (via child\_process)
* **dotenv**
* **Swagger**
* **Jest**

---

## 🇻🇳 Cài đặt & Chạy dự án

```bash
# Clone repository
git clone https://github.com/LDNVN86/nestjs-yt-dlp.git
cd nestjs-yt-dlp

# Cài đặt dependencies
npm install
# hoặc yarn
\ n# Tạo file môi trường
cp .env.example .env
# Điền các biến: PORT, YTDLP_OPTIONS...

# Chạy ứng dụng (dev)
npm run start:dev
```

## 🇬🇧 Installation & Running

```bash
# Clone repository
git clone https://github.com/LDNVN86/nestjs-yt-dlp.git
cd nestjs-yt-dlp

# Install dependencies
npm install
# or yarn

# Setup environment
cp .env.example .env
# Fill in: PORT, YTDLP_OPTIONS...

# Run application (dev)
npm run start:dev
```

---

## 🇻🇳 Sử dụng

* GET `/yt-dlp/info?url=<VIDEO_URL>`: Lấy metadata video. (tùy chỉnh url của bạn)
* GET `/yt-dlp/download`: Tải xuống video/audio.  (tùy chỉnh url của bạn)

## 🇬🇧 Usage

* GET `/yt-dlp/info?url=<VIDEO_URL>`: Fetch video metadata.  (customize your url)
* GET `/yt-dlp/download`: Download video/audio. (customize your url)

---

## 🇻🇳 Kiểm thử

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## 🇬🇧 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

---

## 🇻🇳 Triển khai & Docker

```bash
# Build
npm run build

# Chạy production
npm run start:prod

# Docker
docker build -t nestjs-yt-dlp .
docker run -p 3000:3000 --env-file .env nestjs-yt-dlp
```

## 🇬🇧 Deployment & Docker

```bash
# Build
npm run build

# Run production
npm run start:prod

# Docker
docker build -t nestjs-yt-dlp .
docker run -p 3000:3000 --env-file .env nestjs-yt-dlp
```

---

## 🇻🇳 Contributing

1. Fork repo.
2. Tạo branch: `git checkout -b feature/your-feature`.
3. Commit: `git commit -m "feat: thêm tính năng XXX"`.
4. Push & PR.

## 🇬🇧 Contributing

1. Fork this repo.
2. Create branch: `git checkout -b feature/your-feature`.
3. Commit: `git commit -m "feat: add feature XXX"`.
4. Push & open a PR.

---

## 🇻🇳 License

Phát hành theo **MIT License**. Xem tại [LICENSE](./LICENSE).

## 🇬🇧 License

Released under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

## 🇻🇳 Tác giả

**LDNVN86** – [GitHub](https://github.com/LDNVN86)

## 🇬🇧 Author

**LDNVN86** – [GitHub](https://github.com/LDNVN86)


<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
