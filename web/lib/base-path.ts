/* GitHub Pages 서브경로 배포 대응 — next.config.mjs의 basePath와 동일한 값을 client fetch에도 적용 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
