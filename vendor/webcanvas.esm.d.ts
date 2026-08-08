/**
 * ThorVG WebCanvas 타입 선언 — 손으로 쓴 것이다.
 *
 * 배포되는 `webcanvas.esm.js` 는 미니파이된 번들이고 `.d.ts` 가 딸려 오지 않는다.
 * 그래서 **이 앱이 실제로 쓰는 것만** 선언한다. 라이브러리 전체를 옮겨 적지 않는다 —
 * 쓰지 않는 API 를 추측으로 선언해두면 그게 곧 거짓말이 된다.
 *
 * 새 API 를 쓰게 되면 여기 먼저 추가하고, 그때 번들에서 실제 시그니처를 확인한다.
 */

export type Color = readonly [r: number, g: number, b: number, a?: number];

export const StrokeCap: {
  readonly Square: number;
  readonly Round: number;
  readonly Butt: number;
};

export const StrokeJoin: {
  readonly Bevel: number;
  readonly Round: number;
  readonly Miter: number;
};

export interface StrokeOptions {
  width?: number;
  color?: Color;
  cap?: number;
  join?: number;
  miterLimit?: number;
  dash?: readonly number[];
  dashOffset?: number;
}

/** 그려지는 것의 밑바탕. 이 앱은 Shape 만 쓴다. */
export class Paint {
  opacity(value: number): this;
}

export class Shape extends Paint {
  /** 경로를 비운다. 매 프레임 다시 그리기 전에 부른다. */
  reset(): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  cubicTo(cx1: number, cy1: number, cx2: number, cy2: number, x: number, y: number): this;
  close(): this;
  appendCircle(cx: number, cy: number, rx: number, ry?: number, clockwise?: boolean): this;
  appendRect(
    x: number, y: number, w: number, h: number,
    options?: { rx?: number; ry?: number; clockwise?: boolean },
  ): this;
  /** 숫자를 주면 굵기만 바뀐다. */
  stroke(options: StrokeOptions | number): this;
  fill(r: number, g: number, b: number, a?: number): this;
}

export class Canvas {
  constructor(selector: string, size: { width: number; height: number });
  add(paint: Paint): this;
  remove(paint?: Paint): this;
  clear(): this;
  update(): this;
  render(): this;
  resize(width: number, height: number): this;
}

export interface InitOptions {
  /** 'gl' 이 실패하면 'sw' 로 내려간다. */
  renderer?: 'gl' | 'sw';
  /** thorvg.wasm 을 어디서 받아올지 알려준다. */
  locateFile?: (path: string) => string;
}

export interface ThorVG {
  Canvas: typeof Canvas;
  Shape: typeof Shape;
  StrokeCap: typeof StrokeCap;
  StrokeJoin: typeof StrokeJoin;
}

export function init(options?: InitOptions): Promise<ThorVG>;
