/**
 * 내장 예제 그림 — 떨어뜨릴 파일이 없어도 바로 시작할 수 있어야 한다.
 * 처음 화면에서 할 게 없으면 아무도 만지지 않는다.
 *
 * 셋의 성격이 서로 다르다: 제자리로 돌아오는 것, 오르내리는 것, 윤곽선 하나.
 * 원은 `<circle>` 이라서 path 가 하나도 없는 SVG 도 악보가 된다는 것을 겸해서 보여준다.
 */

export interface BuiltInScore {
  readonly label: string;
  readonly svg: string;
}

export const SAMPLES: readonly BuiltInScore[] = [
  {
    label: '원',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="70"/></svg>`,
  },
  {
    label: '물결',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M10 100 Q35 40 60 100 T110 100 T160 100 T190 60"/></svg>`,
  },
  {
    label: '고양이',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M60 70 L45 35 L80 55 Q100 48 120 55 L155 35 L140 70
          Q160 95 155 125 Q145 165 100 170 Q55 165 45 125 Q40 95 60 70 Z"/></svg>`,
  },
];
