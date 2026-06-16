# 유통점 현황조회 — 웹앱 (MVP)

로얄앤컴퍼니 영업본부 직원이 **외근 중 거래처 방문 직전, 핸드폰에서** 해당 유통점의
판매·재고·할인율 현황을 빠르게 조회하기 위한 모바일 우선 웹앱.

- 기획: [`webapp-prd.md`](./webapp-prd.md)
- 디자인 원본: claude.ai/design 핸드오프 (5개 화면 React 프로토타입) → Next.js로 포팅
- 구현체: [`web/`](./web) — Next.js(App Router) + TypeScript

## 빠른 실행

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

로그인 화면에서 **아무 이메일/비밀번호나 입력하면 통과**합니다(MVP 통과형 인증).

### 핵심 사용 흐름
1. `/login` → 로그인(통과형)
2. `/` 검색창에 **"제일도기"** 또는 **"101014"** → 자동완성 선택
3. `/distributors/101014` 상세 → **기간 선택**(시작월~종료월) → KPI 4개 + 탭 5개
   (판매실적 · 주요품목 · 판매주기 · 보관품 · 할인율)
4. 주요품목에서 품목 탭 → 품목 드릴다운
5. 하단 네비(모바일)/사이드바(데스크톱) → 조직별 둘러보기

> 발주 공백 경고 예시: **101079(우성종합건재)** → 판매주기 KPI 경고 + 알럿 표시.

## 화면 / 라우팅

| URL | 화면 |
|-----|------|
| `/login` | 로그인 (통과형) |
| `/` | 홈 / 유통점 검색 + 최근 본 유통점 |
| `/distributors/[code]` | ⭐ 유통점 상세 (기간·탭 URL 동기화: `?s=202501&e=202605&tab=disc`) |
| `/distributors/[code]/items/[sku]` | 품목 드릴다운 |
| `/org` | 조직별 둘러보기 |
| `/me` | 내정보 |

## 기술 구성

- **Next.js 14 (App Router) + TypeScript** — 실제 URL 라우팅, 기간·탭 상태를 URL 쿼리로 공유
- **차트**: 손수 작성한 SVG(막대/꺾은선/스파크라인) — 외부 차트 라이브러리 불필요
- **스타일**: `app/globals.css` (디자인 시스템 직접 포팅, Pretendard)
- **상태**: 인증/최근목록은 localStorage, 기간·탭은 URL
- 외부 DB·백엔드 없음 — 엑셀을 사전집계한 정적 JSON을 fetch (월 1회 갱신)

```
web/
├── app/                       # 라우트(페이지) + layout + globals.css
├── components/                # charts · ui · icons · nav(셸) · period-picker · detail-tabs
└── lib/
    ├── data.ts   ★ 데이터 레이어 — 정적 JSON fetch + 캐시 + 집계(aggregate)
    ├── hooks.ts  # useIndex / useDist (데이터 로딩 훅)
    ├── months.ts # 기간 상수(2023-01~2026-05)
    ├── format.ts # 통화/숫자/날짜 포맷
    ├── util.ts   # cx, 발주공백 상태 계산
    └── recent.ts # 최근 본 유통점(localStorage)

web/public/data/   ← ETL 산출(아래 참조)
etl/build_data.py  ← 엑셀 → JSON 변환 스크립트
```

## 데이터 — 실데이터 (영업실적-PRD용 엑셀)

`영업실적-PRD용(260608).xlsx`(약 31만 건)를 **Python ETL로 사전집계**해 정적 JSON으로 적재합니다.
DB 없이 정적 파일만으로 동작합니다.

```
web/public/data/index.json        # 거래처 429개 마스터 + 요약(검색/홈/조직)  ≈100KB
web/public/data/dist/<코드>.json   # 거래처별 월별/품목/발주/보관품 (상세 진입 시 1개만 fetch)
```

### 월 1회 데이터 갱신 절차
1. `영업실적-PRD용(260608).xlsx`를 최신 파일로 교체 (경로/이름이 바뀌면 `etl/build_data.py`의 `SRC` 수정)
2. 재집계:
   ```bash
   python "etl/build_data.py"
   ```
   → `web/public/data/` 가 갱신됩니다. 화면 코드는 수정 불필요.
3. 배포: `cd web && npx vercel`

> ETL은 4개 실적시트(23~26년) + 보관품현황을 거래처별로 집계합니다.
> **매출이익·판매시점공장단가 등 원가성 컬럼은 읽지 않아** JSON에 포함되지 않습니다.
> 기준일(`asof`, "마지막 발주 N일 전")은 ETL 실행일입니다.

### 데이터 레이어 (`web/lib/data.ts`)
- `fetchIndex()` — 거래처 목록 + 요약 (검색/홈/조직)
- `fetchDist(code)` — 거래처 상세 데이터 (캐시)
- `aggregate(dist, startYM, endYM)` — 기간 집계 (5개 지표)
- `searchList(list, q)` — 코드/거래처명/사원/사업부 검색

5개 지표 계산식은 `aggregate()`에 구현:
① 월별/누계 판매액 ② 품목별 랭킹 ③ 판매주기(평균간격·마지막발주 경과일)
④ 보관품(최신 보관월) ⑤ 월별/누계 할인율 `(Σ공장도−Σ판매액)/Σ공장도`.

> 향후 거래처가 매우 많아지거나 입력 기능이 필요하면 `lib/data.ts`의 fetch 구현을
> Supabase(Postgres + Auth) 호출로 교체하면 됩니다. 화면 코드는 그대로입니다.

### 화면에서 직접 데이터 추가 (관리자 업로드)
홈 상단 **"＋ 데이터 추가"** → 관리자 비밀번호(`2003@#`) → 동일 스키마 엑셀 업로드 → 미리보기 → "기존 데이터에 추가 반영".
- **병합 규칙(upsert)**: 기존 데이터는 유지하고, **겹치는 (거래처+출고월)은 업로드값으로 교체**, 새 월·새 거래처·새 품목은 추가. (중복 합산 없음)
- **반영 범위**: 업로드한 **이 기기(브라우저)** 한정. 오버레이는 IndexedDB에 저장, 화면(`lib/data.ts`)이 기본 JSON과 자동 병합.
- **되돌리기**: 업로드 화면의 "추가 데이터 초기화" → 기본 데이터로 복귀.
- 관련 파일: `lib/ingest.ts`(엑셀 파싱·집계, SheetJS), `lib/overlay.ts`(저장·병합), `app/data-add/page.tsx`.
- ⚠ **모든 사용자에게 영구 반영**하려면 이 임시 업로드가 아니라 위의 **월 1회 ETL 절차**(엑셀 교체 → `build_data.py` → 재배포)를 사용하세요.
- ⚠ 비밀번호(`2003@#`)는 클라이언트에 포함되어 소스에서 노출될 수 있는 **약한 보안**입니다(내부 MVP). 강한 통제가 필요하면 Supabase Auth로 승격하세요.

## 배포

```bash
cd web
npx vercel        # 프리뷰 배포 → 핸드폰에서 접속 확인
```

정적 호스팅도 가능(조회 전용 특성). 사내 전용이므로 Vercel/Cloudflare 비밀번호 보호 권장.

## 다음 단계 (MVP 범위 밖)

- 진짜 개인 로그인/회원가입 (Supabase Auth) — 현재는 통과형
- 입력 기능(방문 메모·재고 실사)
- ETL 자동화(스케줄) + 타입 strict 전환

## 보안 메모

- 거래처·할인율은 **회사 내부 정보** → 외부 공유 주의.
- **매출이익·공장단가 등 원가성 정보는 보안 정책상 표시하지 않습니다** (데이터에도 미포함).
