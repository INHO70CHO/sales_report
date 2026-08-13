# -*- coding: utf-8 -*-
"""
영업실적-PRD용(260608).xlsx → 거래처별 사전집계 JSON ETL

산출:
  web/public/data/index.json         거래처 마스터 + 요약(검색/홈/조직용)
  web/public/data/dist/<코드>.json   거래처별 월별/품목/발주/보관품 (상세 화면용)

보안: 매출이익·판매시점공장단가 등 원가성 컬럼은 읽지 않음(제외).
월 1회 엑셀 교체 후 이 스크립트를 다시 실행하면 됩니다.
"""
import os, json, math, re
from datetime import date, datetime
import pandas as pd

# 신품번: 품번 끝의 '-N'만 제거 (RBS5010-N→RBS5010, RWT607-H-N→RWT607-H, RKST40→RKST40)
_CLEAN = re.compile(r"-N$", re.IGNORECASE)
def clean_pn(s):
    return _CLEAN.sub("", str(s).strip())

# 대분류 강제 '비데' 처리 — 아래 베이스 품번(및 -MP·-EG 등 접미사 변형) 전부 비데로 집계
BIDET_BASES = {"RWC3500", "RWC2400", "RWC2500", "RWC2600", "RWC3600", "RWC7000", "RWC3100", "RWC3000"}
def is_bidet(품번):
    return str(품번).split("-")[0].upper() in BIDET_BASES

BASE = r"F:\claude\do-better-workspace-v2\100-practice skill"
SRC = os.path.join(BASE, "영업실적-PRD용(260608).xlsx")
OUT_DIR = os.path.join(BASE, "유통점-현황조회-webapp", "web", "public", "data")
DIST_DIR = os.path.join(OUT_DIR, "dist")
os.makedirs(DIST_DIR, exist_ok=True)

ASOF = date.today()  # "마지막 발주 N일 전" 기준일 (ETL 실행일)

USE_SALES = ["거래처", "거래처명", "출고일", "출고월", "품번", "품명",
             "대분류명", "시리즈명", "수량", "단가", "판매액", "판매시점공장도",
             "본부", "사업부", "영업팀", "영업사원", "구분2"]

print("엑셀 로딩...")
xl = pd.ExcelFile(SRC, engine="openpyxl")
sales_sheets = [s for s in xl.sheet_names if "실적" in s]

# 사용자(로그인 허용 명단) → users.json
if "사용자" in xl.sheet_names:
    _udf = xl.parse("사용자", header=None)
    _users = [str(x).strip() for x in _udf.iloc[:, 0].dropna().tolist() if str(x).strip()]
    with open(os.path.join(OUT_DIR, "users.json"), "w", encoding="utf-8") as f:
        json.dump({"users": _users}, f, ensure_ascii=False)
    print(f"사용자 명단: {len(_users)}명 → users.json")

frames = []
for sh in sales_sheets:
    df = xl.parse(sh, usecols=USE_SALES)
    frames.append(df)
    print(f"  {sh}: {len(df)}행")
sales = pd.concat(frames, ignore_index=True)

# 숫자 정리
for c in ["수량", "단가", "판매액", "판매시점공장도", "출고일", "출고월", "거래처"]:
    sales[c] = pd.to_numeric(sales[c], errors="coerce").fillna(0)
sales["거래처"] = sales["거래처"].astype("int64")
sales["출고월"] = sales["출고월"].astype("int64")
sales["출고일"] = sales["출고일"].astype("int64")
for c in ["거래처명", "품번", "품명", "대분류명", "시리즈명", "본부", "사업부", "영업팀", "영업사원", "구분2"]:
    sales[c] = sales[c].astype("string").fillna("")
sales["품번"] = sales["품번"].map(clean_pn)  # 유통점별 실적을 신품번 기준으로 집계
sales.loc[sales["품번"].str.split("-").str[0].str.upper().isin(BIDET_BASES), "대분류명"] = "비데"  # 비데 재분류

# 실적 정제: 판매액 0원 행 제외, 사업부 '기타' 제외
_before = len(sales)
sales = sales[(sales["판매액"] != 0) & (sales["사업부"] != "기타")].copy()
print(f"정제: {_before} → {len(sales)}행 (판매액0·사업부'기타' 제외)")

# 유통/납품 분리 (구분2) — 판매액 + 판매시점공장도
sales["du"] = sales["판매액"].where(sales["구분2"] == "유통", 0)  # 유통 판매액
sales["np"] = sales["판매액"].where(sales["구분2"] == "납품", 0)  # 납품 판매액
sales["duf"] = sales["판매시점공장도"].where(sales["구분2"] == "유통", 0)  # 유통 공장도
sales["npf"] = sales["판매시점공장도"].where(sales["구분2"] == "납품", 0)  # 납품 공장도

print(f"총 {len(sales)}행 / 거래처 {sales['거래처'].nunique()}개")


def ymd_to_iso(n: int) -> str:
    s = str(int(n))
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def yymmdd_to_iso(n: int) -> str:
    """보관월(YYMMDD, 6자리) → ISO 날짜 'YYYY-MM-DD' (보관 조사일)"""
    if not n:
        return ""
    s = f"{int(n):06d}"
    return f"20{s[0:2]}-{s[2:4]}-{s[4:6]}"


def ord_to_iso(n: int) -> str:
    """주문작성일(보관 잡은 날) → ISO. 8자리(YYYYMMDD)/6자리(YYMMDD) 모두 처리"""
    n = int(n)
    if n <= 0:
        return ""
    return ymd_to_iso(n) if n >= 19000000 else yymmdd_to_iso(n)


def days_between(iso_a: str, d_b: date) -> int:
    a = datetime.strptime(iso_a, "%Y-%m-%d").date()
    return (d_b - a).days


def order_status(days_since, avg_gap):
    if days_since is None:
        return "none"
    t = avg_gap * 2 if avg_gap else 30
    if days_since > max(30, t):
        return "warn"
    if days_since > (avg_gap if avg_gap else 15):
        return "watch"
    return "ok"


# ---- 거래처 마스터 (최신 출고일 기준 조직/거래처명) ----
sales_sorted = sales.sort_values("출고일")
master = sales_sorted.groupby("거래처").agg(
    name=("거래처명", "last"),
    bon=("본부", "last"),
    bu=("사업부", "last"),
    team=("영업팀", "last"),
    rep=("영업사원", "last"),
).reset_index()

# 담당자/조직 수동 보정 (거래처코드 → {필드:값}). 필드: name/bon/bu/team/rep
OVERRIDES = {
    104000: {"rep": "하헌영"},  # 로얄림 담당자
}
for _code, _ov in OVERRIDES.items():
    _mask = master["거래처"] == _code
    for _k, _v in _ov.items():
        master.loc[_mask, _k] = _v

master_map = {int(r.거래처): r for r in master.itertuples()}

# ---- 보관품현황 ----
inv = xl.parse("보관품현황", header=1)
inv["거래처"] = pd.to_numeric(inv["거래처"], errors="coerce").fillna(0).astype("int64")
inv["보관월"] = pd.to_numeric(inv["보관월"], errors="coerce").fillna(0).astype("int64")
for c in ["단가", "입고수량", "출고수량", "보관수량", "보관금액", "주문작성일"]:
    inv[c] = pd.to_numeric(inv[c], errors="coerce").fillna(0)
for c in ["품번", "품명", "대분류"]:
    inv[c] = inv[c].astype("string").fillna("")
inv["품번"] = inv["품번"].map(clean_pn)  # 보관품도 신품번 기준
inv.loc[inv["품번"].str.split("-").str[0].str.upper().isin(BIDET_BASES), "대분류"] = "비데"  # 비데 재분류

# 보관월(YYMMDD) → 월(YYYYMM)
inv["mon"] = ((2000 + inv["보관월"] // 10000) * 100 + (inv["보관월"] // 100) % 100).astype("int64")
# 주문작성일(YYYYMMDD) → 보관 잡힌 월(YYYYMM). (혹시 6자리면 YYMMDD 처리)
_om8 = (inv["주문작성일"] // 100).astype("int64")
_om6 = ((2000 + inv["주문작성일"] // 10000) * 100 + (inv["주문작성일"] // 100) % 100).astype("int64")
inv["omon"] = _om8.where(inv["주문작성일"] >= 19000000, _om6)

# 월별 보관금액: 각 (거래처,월)의 '최신 스냅샷' 합계 + 당월 신규보관(주문작성일 년월=보관월)
_latest_in_mon = inv.groupby(["거래처", "mon"])["보관월"].transform("max")
_snap = inv[inv["보관월"] == _latest_in_mon].copy()
_snap["cur_amt"] = _snap["보관금액"].where(_snap["omon"] == _snap["mon"], 0)
# snap = 그 (거래처,월)의 최종 보관월(YYMMDD) = 보관 조사일
invmon = _snap.groupby(["거래처", "mon"]).agg(amt=("보관금액", "sum"), qty=("보관수량", "sum"), cur=("cur_amt", "sum"), snap=("보관월", "max")).reset_index()
invmon_by_code = {code: g.sort_values("mon") for code, g in invmon.groupby("거래처")}

# 전체 보관월(YYYYMM) 목록 + 각 월의 글로벌 조사일 — 보관 없는 달은 0원으로 채우기 위함
_gmon_max = inv.groupby("mon")["보관월"].max()
GLOBAL_MONTHS = sorted(int(m) for m in _gmon_max.index if int(m) > 0)
GMON_DATE = {int(m): yymmdd_to_iso(int(d)) for m, d in _gmon_max.items()}
print(f"전체 보관월: {len(GLOBAL_MONTHS)}개 ({GLOBAL_MONTHS[0]}~{GLOBAL_MONTHS[-1]})")

# 월별 품목 내역 (거래처 → {YYYYMM: [품목들(보관금액 내림차순)]})
invitem_by_code = {}
for _code, _g in _snap.groupby("거래처"):
    _bym = {}
    for _mon, _gg in _g.groupby("mon"):
        _gg = _gg.sort_values("보관금액", ascending=False)
        _bym[str(int(_mon))] = [{
            "품번": str(r.품번), "품명": str(r.품명), "대분류": str(r.대분류) or "기타",
            "단가": int(r.단가), "입고": int(r.입고수량), "출고": int(r.출고수량),
            "보관수량": int(r.보관수량), "보관금액": int(r.보관금액),
            "보관일": ord_to_iso(int(r.주문작성일)),  # 보관 잡은 날(주문작성일)
        } for r in _gg.itertuples()]
    invitem_by_code[int(_code)] = _bym

# 보관조사일 = 보관품현황 전체의 마지막 날짜(글로벌 최신 보관월). 그 날짜 스냅샷만 '현재 보관'으로 인정.
# → 그 날짜에 보관품목이 없는 거래처는 inv_by_code에 없음(=현재 보관 현황 미표기).
GLOBAL_INV_YM = int(inv["보관월"].max())
print(f"보관조사일(전체 마지막 보관월): {yymmdd_to_iso(GLOBAL_INV_YM)}")
inv_latest = inv[inv["보관월"] == GLOBAL_INV_YM]
inv_by_code = {code: g for code, g in inv_latest.groupby("거래처")}
print(f"  → 해당 보관조사일에 보관품 있는 거래처: {len(inv_by_code)}개")

# ---- 거래처별 집계 ----
index_rows = []
codes = sorted(sales["거래처"].unique().tolist())
print(f"거래처 {len(codes)}개 처리...")

for code in codes:
    g = sales[sales["거래처"] == code]
    m = master_map[code]

    # 월별
    mg = g.groupby("출고월").agg(
        sales=("판매액", "sum"),
        factory=("판매시점공장도", "sum"),
        qty=("수량", "sum"),
        du=("du", "sum"),
        np=("np", "sum"),
        duf=("duf", "sum"),
        npf=("npf", "sum"),
    ).reset_index().sort_values("출고월")
    monthly = [
        {"ym": int(r.출고월), "sales": int(r.sales), "factory": int(r.factory), "qty": int(r.qty),
         "du": int(r.du), "np": int(r.np), "duf": int(r.duf), "npf": int(r.npf)}
        for r in mg.itertuples()
    ]

    # 품목 (품번별 메타 + 월별 + 발주일)
    items = []
    for 품번, ig in g.groupby("품번"):
        im = ig.groupby("출고월").agg(amount=("판매액", "sum"), qty=("수량", "sum"), factory=("판매시점공장도", "sum"), du=("du", "sum"), np=("np", "sum"), duf=("duf", "sum"), npf=("npf", "sum")).reset_index().sort_values("출고월")
        last = ig.sort_values("출고일").iloc[-1]
        item_days = sorted(int(x) for x in ig["출고일"].unique() if x > 0)
        items.append({
            "품번": str(품번),
            "품명": str(last["품명"]),
            "대분류": str(last["대분류명"]) or "기타",
            "시리즈": str(last["시리즈명"]) or "",
            "단가": int(pd.to_numeric(last["단가"], errors="coerce") or 0),
            "monthly": [{"ym": int(r.출고월), "amount": int(r.amount), "qty": int(r.qty), "factory": int(r.factory), "du": int(r.du), "np": int(r.np), "duf": int(r.duf), "npf": int(r.npf)} for r in im.itertuples()],
            "orders": [ymd_to_iso(x) for x in item_days],
            "_total": int(ig["판매액"].sum()),
        })
    items.sort(key=lambda x: x["_total"], reverse=True)
    for it in items:
        del it["_total"]

    # 발주일 (distinct 출고일)
    order_days = sorted(int(x) for x in g["출고일"].unique() if x > 0)
    orders = [ymd_to_iso(x) for x in order_days]
    avg_gap = None
    if len(orders) >= 2:
        diffs = []
        for i in range(1, len(orders)):
            diffs.append(days_between(orders[i - 1], datetime.strptime(orders[i], "%Y-%m-%d").date()))
        avg_gap = round(sum(diffs) / len(diffs))
    last_order = orders[-1] if orders else None
    days_since = days_between(last_order, ASOF) if last_order else None

    # 보관품
    inventory = []
    if code in inv_by_code:
        ig = inv_by_code[code].sort_values("보관금액", ascending=False)
        for r in ig.itertuples():
            inventory.append({
                "품번": str(r.품번), "품명": str(r.품명), "대분류": str(r.대분류) or "기타",
                "단가": int(r.단가), "입고": int(r.입고수량), "출고": int(r.출고수량),
                "보관수량": int(r.보관수량), "보관금액": int(r.보관금액),
                "보관일": ord_to_iso(int(r.주문작성일)),  # 보관 잡은 날(주문작성일)
            })
    inv_ym = int(inv_by_code[code]["보관월"].iloc[0]) if code in inv_by_code else None

    # 월별 보관금액 (YYYYMM) — 전체 보관월에 대해, 보관 없는 달은 0원으로 채움
    inv_monthly = []
    if code in invmon_by_code:
        cur_map = {int(r.mon): r for r in invmon_by_code[code].itertuples()}
        for gm in GLOBAL_MONTHS:
            if gm in cur_map:
                r = cur_map[gm]
                inv_monthly.append({"ym": gm, "amt": int(r.amt), "qty": int(r.qty), "cur": int(r.cur), "date": yymmdd_to_iso(int(r.snap))})
            else:
                inv_monthly.append({"ym": gm, "amt": 0, "qty": 0, "cur": 0, "date": GMON_DATE.get(gm, "")})

    dist = {
        "code": int(code),
        "name": str(m.name),
        "본부": str(m.bon), "사업부": str(m.bu), "팀": str(m.team), "사원": str(m.rep),
        "region": str(m.bu),  # 지역 컬럼 없음 → 사업부로 대체
        "asof": ASOF.isoformat(),
        "invYM": inv_ym,
        "invDate": yymmdd_to_iso(inv_ym) if inv_ym else None,
        "monthly": monthly,
        "items": items,
        "orders": orders,
        "inventory": inventory,
        "invMonthly": inv_monthly,
        "invByMonth": invitem_by_code.get(int(code), {}),
    }
    with open(os.path.join(DIST_DIR, f"{int(code)}.json"), "w", encoding="utf-8") as f:
        json.dump(dist, f, ensure_ascii=False, separators=(",", ":"))

    # 인덱스 요약 (최근 6개월 + 발주 상태)
    last6 = monthly[-6:]
    sales6 = sum(x["sales"] for x in last6)
    s6du = sum(x["du"] for x in last6)
    s6np = sum(x["np"] for x in last6)
    spark = [x["sales"] for x in last6]
    inv_amt = sum(x["보관금액"] for x in inventory)  # 보관조사일 기준 보관금액
    index_rows.append({
        "code": int(code), "name": str(m.name),
        "본부": str(m.bon), "사업부": str(m.bu), "팀": str(m.team), "사원": str(m.rep),
        "region": str(m.bu),
        "sales6": int(sales6), "s6du": int(s6du), "s6np": int(s6np),
        "days": days_since, "gap": avg_gap,
        "lvl": order_status(days_since, avg_gap),
        "spark": spark,
        "inv": int(inv_amt), "invn": len(inventory),  # 보관조사일 보관금액·품목수
    })

index_rows.sort(key=lambda x: x["sales6"], reverse=True)

# 데이터 기간(월 범위): 판매(출고월)·보관(보관월-월) 통틀어 최소~최대 → 자동 산출
_sale_ymmax = int(sales["출고월"].max()); _sale_ymmin = int(sales["출고월"].min())
_inv_ymmax = GLOBAL_MONTHS[-1] if GLOBAL_MONTHS else _sale_ymmax
_inv_ymmin = GLOBAL_MONTHS[0] if GLOBAL_MONTHS else _sale_ymmin
YM_MAX_OUT = max(_sale_ymmax, _inv_ymmax)
YM_MIN_OUT = min(_sale_ymmin, _inv_ymmin)
print(f"데이터 월범위: {YM_MIN_OUT} ~ {YM_MAX_OUT} (판매 최대 {_sale_ymmax}, 보관 최대 {_inv_ymmax})")

index = {
    "ymMin": YM_MIN_OUT, "ymMax": YM_MAX_OUT, "asof": ASOF.isoformat(),
    "count": len(index_rows),
    "invDate": yymmdd_to_iso(GLOBAL_INV_YM),  # 전체 보관조사일(최신 보관월)
    "distributors": index_rows,
}
with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

# months.ts 자동 생성 (YM_MIN/YM_MAX를 데이터에 맞춰 갱신 — 매달 수동 수정 불필요)
_months_ts = os.path.join(os.path.dirname(OUT_DIR), "..", "lib", "months.ts")
_months_ts = os.path.normpath(_months_ts)
with open(_months_ts, "w", encoding="utf-8") as f:
    f.write(
        "/* 데이터 기간 상수 — ETL(build_data.py)이 자동 생성. 수동 편집 금지 */\n"
        f"export const YM_MIN = {YM_MIN_OUT};\n"
        f"export const YM_MAX = {YM_MAX_OUT};\n\n"
        "export const MONTHS: number[] = (() => {\n"
        "  const a: number[] = [];\n"
        "  const y0 = Math.floor(YM_MIN / 100), y1 = Math.floor(YM_MAX / 100);\n"
        "  for (let y = y0; y <= y1; y++) {\n"
        "    for (let m = 1; m <= 12; m++) {\n"
        "      const ym = y * 100 + m;\n"
        "      if (ym < YM_MIN || ym > YM_MAX) continue;\n"
        "      a.push(ym);\n"
        "    }\n"
        "  }\n"
        "  return a;\n"
        "})();\n\n"
        "export function ymList(startYM: number, endYM: number): number[] {\n"
        "  return MONTHS.filter((m) => m >= startYM && m <= endYM);\n"
        "}\n"
    )
print(f"months.ts 갱신: YM_MIN={YM_MIN_OUT}, YM_MAX={YM_MAX_OUT}")

# 크기 리포트
total = 0
for root, _, files in os.walk(OUT_DIR):
    for fn in files:
        total += os.path.getsize(os.path.join(root, fn))
idx_size = os.path.getsize(os.path.join(OUT_DIR, "index.json"))
print(f"\n완료: 거래처 {len(index_rows)}개")
print(f"index.json: {idx_size/1024:.1f} KB")
print(f"data 폴더 총합: {total/1024/1024:.2f} MB ({len(codes)} dist 파일)")
print("상위 5 거래처(최근6개월):")
for r in index_rows[:5]:
    print(f"  {r['code']} {r['name']}: {r['sales6']:,}원, 마지막 {r['days']}일 전, 평균 {r['gap']}일, {r['lvl']}")
