/**
 * 테스트용 MIDI 짓기 — 진짜 .mid 를 저장소에 넣지 않기 위한 것.
 *
 * 바이트를 직접 짜면 무엇을 시험하는지가 테스트 안에 다 보이고, 어느 바이트가
 * 문제인지도 바로 안다. 빌드 산출물에는 들어가지 않는다(`*.fixture.ts` 는 제외된다).
 */

/** 가변 길이 정수로. */
export function varInt(value: number): number[] {
  const out = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return out;
}

/** 4분음표당 tick. 헤더에 적는 값이자 테스트가 시간을 계산할 때 쓰는 값. */
export const TPQ = 480;

function chunk(id: string, body: number[]): number[] {
  const size = body.length;
  return [...id].map((c) => c.charCodeAt(0)).concat(
    [(size >> 24) & 0xff, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff], body);
}

/**
 * `[delta, midi]` 목록으로 파일을 짓는다. `delta` 는 **앞 음이 시작한 뒤 흐른 tick** 이다.
 * 음은 다음 음이 시작할 때 꺼진다(레가토). 마지막 음도 한 박을 차지한다 —
 * 그래야 진짜 악보처럼 곡 길이에 마지막 음이 들어간다.
 *
 * `tempos` 는 `[tick, BPM]`. 규격의 format 1 처럼 **전용 트랙**에 넣는다.
 * 음과 같은 트랙에 넣으면 델타 시계를 나눠 쓰게 돼 음의 자리가 밀린다.
 */
export function buildMidi(tracks: [number, number][][], tempos: [number, number][] = []): Uint8Array {
  const chunks: number[][] = [];

  if (tempos.length) {
    const body: number[] = [];
    let last = 0;
    for (const [tick, bpm] of tempos) {
      const us = Math.round(60_000_000 / bpm);
      body.push(...varInt(tick - last), 0xff, 0x51, 3,
        (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff);
      last = tick;
    }
    body.push(0, 0xff, 0x2f, 0);
    chunks.push(chunk('MTrk', body));
  }

  for (const track of tracks) {
    const body: number[] = [];
    let previous: number | null = null;
    let lastGap = TPQ;
    for (const [delta, midi] of track) {
      if (previous == null) {
        body.push(...varInt(delta), 0x90, midi, 64);
      } else {
        body.push(...varInt(delta), 0x80, previous, 0);  // 앞 음을 끄고
        body.push(0, 0x90, midi, 64);                    // 곧바로 다음 음
        lastGap = delta;
      }
      previous = midi;
    }
    if (previous != null) body.push(...varInt(lastGap), 0x80, previous, 0);
    body.push(0, 0xff, 0x2f, 0);
    chunks.push(chunk('MTrk', body));
  }

  const count = chunks.length;
  const header = chunk('MThd', [
    0, count > 1 ? 1 : 0, (count >> 8) & 0xff, count & 0xff, (TPQ >> 8) & 0xff, TPQ & 0xff,
  ]);
  return new Uint8Array([...header, ...chunks.flat()]);
}
