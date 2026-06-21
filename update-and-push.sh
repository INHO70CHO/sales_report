#!/usr/bin/env bash
# =============================================================
# 실적 데이터 갱신 + GitHub 자동 업데이트 (한 번에)
#  사용법: 엑셀(영업실적-PRD용(260608).xlsx) 교체 후
#    ! bash "100-practice skill/유통점-현황조회-webapp/update-and-push.sh"
#  동작: ① ETL 재실행(JSON 재생성) → ② 변경 커밋 → ③ GitHub push
# =============================================================
set -e
cd "$(dirname "$0")"

echo "[1/3] ETL 실행 (JSON 재생성)..."
PYTHONIOENCODING=utf-8 python etl/build_data.py

echo "[2/3] 변경사항 커밋..."
git add -A
if git diff --cached --quiet; then
  echo "  변경 없음 — 푸시 생략하고 종료."
  exit 0
fi
git commit -m "data: 실적 갱신 ($(date '+%Y-%m-%d %H:%M'))"

echo "[3/3] GitHub 푸시..."
git push

echo "완료: GitHub(INHO70CHO/sales_report)에 반영되었습니다."
