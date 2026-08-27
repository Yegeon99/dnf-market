// 브리핑 텍스트 하이라이트: 등락 수치(+26.9% 등)는 등락색, 품목명은 bold.
// 데이터 텍스트를 훑어 읽기 좋게 만드는 표시 전용 헬퍼 (내용 변형 없음)

const PCT_RE = /([+-]\d+(?:[.,]\d+)?%)/g;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 수치 토큰에 등락색, names에 있는 품목명에 bold를 입힌 조각 배열 반환.
 *  colorNums: false면 수치는 색·굵기 없이 표기만 정렬한다 (첫 문장 밖에서 사용) */
export function highlight(text, names = [], { colorNums = true } = {}) {
  if (!text) return [text];
  const nameRe = names.length
    ? new RegExp(`(${[...names].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})`, "g")
    : null;

  const out = [];
  let key = 0;
  for (const part of text.split(PCT_RE)) {
    if (PCT_RE.test(part) && /^[+-]/.test(part)) {
      PCT_RE.lastIndex = 0;
      out.push(
        colorNums ? (
          <b key={key++} className="num" style={{ color: part.startsWith("+") ? "var(--up)" : "var(--down)" }}>
            {part}
          </b>
        ) : (
          <span key={key++} className="num">{part}</span>
        )
      );
      continue;
    }
    PCT_RE.lastIndex = 0;
    if (!nameRe) { out.push(part); continue; }
    for (const seg of part.split(nameRe)) {
      if (seg && names.includes(seg)) out.push(<b key={key++}>{seg}</b>);
      else out.push(seg);
    }
  }
  return out;
}

/** 브리핑 문장용: 품목명 후보 목록 (전체명 + 축약명) */
export function itemNamePool(items) {
  const pool = new Set();
  for (const it of items) {
    if (it.name) pool.add(it.name);
    if (it.shortName) pool.add(it.shortName);
  }
  return [...pool];
}
