/**
 * MIDI 시계 — tick 을 초로 옮긴다.
 *
 * tick 은 파일마다 뜻이 다르다. 헤더의 division 이 "4분음표 하나가 몇 tick 인가"를 정하고,
 * tempo 메타가 "4분음표 하나가 몇 마이크로초인가"를 정한다. 둘을 곱해야 실제 시간이 된다.
 *
 * tempo 는 곡 도중에 바뀔 수 있다(느려지는 마무리 등). tick 비율만 보고 시간을 매기면
 * 그런 곡에서 음 길이가 실제와 어긋난다. 그래서 구간마다 따로 센다.
 */
/** tempo 메타가 하나도 없으면 MIDI 규격의 기본값 — 120 BPM. */
const DEFAULT_US_PER_QUARTER = 500_000;
/** division 이 0 인 깨진 파일에 쓰는 값. */
const FALLBACK_TICKS_PER_QUARTER = 480;
/** @returns tick 을 초로 바꾸는 함수. 곡 시작이 0초다. */
export function createMidiClock(division, tempos) {
    // 최상위 비트가 서 있으면 SMPTE — 초당 tick 수가 고정이라 tempo 와 무관하다.
    if (division & 0x8000) {
        const framesPerSecond = 256 - ((division >> 8) & 0xff); // 상위 바이트는 음수로 적힌다
        const ticksPerFrame = division & 0xff;
        const perSecond = framesPerSecond * ticksPerFrame;
        return (tick) => (perSecond > 0 ? tick / perSecond : 0);
    }
    const ticksPerQuarter = division || FALLBACK_TICKS_PER_QUARTER;
    const changes = [...tempos].sort((a, b) => a.tick - b.tick);
    // 곡 첫머리에 tempo 가 없으면 규격 기본값으로 시작한 것이다.
    if (!changes[0] || changes[0].tick > 0) {
        changes.unshift({ tick: 0, usPerQuarter: DEFAULT_US_PER_QUARTER });
    }
    // 구간이 바뀌는 자리마다 "여기까지 몇 초"를 미리 쌓아둔다.
    const marks = [];
    for (const change of changes) {
        const previous = marks[marks.length - 1];
        const seconds = previous
            ? previous.seconds + spanSeconds(change.tick - previous.tick, previous.usPerQuarter, ticksPerQuarter)
            : 0;
        marks.push({ tick: change.tick, seconds, usPerQuarter: change.usPerQuarter });
    }
    return (tick) => {
        let mark = marks[0];
        for (const candidate of marks) {
            if (candidate.tick > tick)
                break;
            mark = candidate;
        }
        return mark.seconds + spanSeconds(tick - mark.tick, mark.usPerQuarter, ticksPerQuarter);
    };
}
function spanSeconds(ticks, usPerQuarter, ticksPerQuarter) {
    return (ticks * usPerQuarter) / (ticksPerQuarter * 1_000_000);
}
//# sourceMappingURL=midi-clock.js.map