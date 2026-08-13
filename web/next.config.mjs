/** @type {import('next').NextConfig} */
const BASE_PATH = "/sales_report"; // GitHub Pages 리포지토리 경로 (INHO70CHO.github.io/sales_report)

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
};

export default nextConfig;
