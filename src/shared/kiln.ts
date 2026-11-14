/**
 * The whole game, as pure functions.
 *
 * Nothing in this file touches the network, the DOM, Redis or the clock directly:
 * the server, the client and the tests all call these same functions, which is why
 * a piece fired in the tests is the same piece the server accepts.
 *
 * Units: temperatures are °C inside the kiln (cone-like scale, not literal).
 */

export type Zone = 'mouth' | 'body' | 'tail';

export type Grade = 'transmuted' | 'fine' | 'sound' | 'under' | 'over';

export type Variant = 'clear' | 'rain' | 'wind';

export type WareForm =
  | 'bowl'
  | 'plate'
  | 'cup'
  | 'basin'
  | 'jar'
  | 'gourd'
  | 'vase'
  | 'meiping'
  | 'egg';

export type Ware = {
  id: string;
  name: string;
  ideal: number;
  form: WareForm;
  glaze: string;
  line: string;
};

export type Slot = {
  id: string;
  zone: Zone;
  row: number;
  base: number;
};

export type Kiln = {
  day: string;
  seed: number;
  variant: Variant;
  variantLine: string;
  slots: Slot[];
  wares: Ware[];
};

export type CommitInput = {
  kiln: Kiln;
  wareId: string;
  slotId: string;
  taps: readonly number[];
  crowd: number;
  userId: string;
};

export type CommitResult = {
  ware: Ware;
  slot: Slot;
  stoke: number;
  temp: number;
  ideal: number;
  delta: number;
  grade: Grade;
  transmuted: boolean;
  score: number;
};

export const ZONES: readonly Zone[] = ['mouth', 'body', 'tail'];

export const ZONE_LABEL: Record<Zone, string> = {
  mouth: 'Fire mouth',
  body: 'Kiln body',
  tail: 'Kiln tail',
};

export const ZONE_BASE: Record<Zone, number> = {
  mouth: 1312,
  body: 1266,
  tail: 1214,
};

export const ROW_OFFSET: readonly number[] = [10, 0, -10];

/** Every extra piece in a zone pulls that zone down by this much. */
export const CROWD_PENALTY = 7;

/** One stoke is worth this much, from a dead tap to a perfect one. */
export const STOKE_MIN = -6;
export const STOKE_MAX = 12;

export const FINE_BAND = 7;
export const SOUND_BAND = 20;

export const WARE_LIB: readonly Ware[] = [
  {
    id: 'plate',
    name: 'Foliate dish',
    ideal: 1194,
    form: 'plate',
    glaze: '#D8C9AE',
    line: 'The coolest shelf in the kiln. Nothing to prove, and it knows it.',
  },
  {
    id: 'bowl',
    name: 'Celadon bowl',
    ideal: 1208,
    form: 'bowl',
    glaze: '#8FB3A4',
    line: 'Wants the cool end. Forgiving, but boring when it is perfect.',
  },
  {
    id: 'cup',
    name: 'Persimmon tea bowl',
    ideal: 1220,
    form: 'cup',
    glaze: '#BE6A46',
    line: 'Iron glaze. It turns from rust to blood between two strokes.',
  },
  {
    id: 'basin',
    name: 'Lotus basin',
    ideal: 1230,
    form: 'basin',
    glaze: '#9DB4C6',
    line: 'A wide mouth cools faster than it fills. Watch the near edge.',
  },
  {
    id: 'jar',
    name: 'Blue-and-white jar',
    ideal: 1246,
    form: 'jar',
    glaze: '#7E9BD1',
    line: 'The middle of the kiln. Cobalt runs if you push it.',
  },
  {
    id: 'gourd',
    name: 'Double gourd',
    ideal: 1262,
    form: 'gourd',
    glaze: '#A8BE72',
    line: 'Two bellies, two chances to slump. The waist goes first.',
  },
  {
    id: 'vase',
    name: 'Shadow-blue vase',
    ideal: 1282,
    form: 'vase',
    glaze: '#A9C6E8',
    line: 'Wants real heat. Miss low and it stays chalky.',
  },
  {
    id: 'meiping',
    name: 'Plum-blossom vase',
    ideal: 1300,
    form: 'meiping',
    glaze: '#5F8298',
    line: 'A narrow mouth and a heavy shoulder. It drinks the heat.',
  },
  {
    id: 'egg',
    name: 'Dragon-egg bottle',
    ideal: 1320,
    form: 'egg',
    glaze: '#C9A227',
    line: 'Only the fire mouth will do. Overfire and it slumps.',
  },
];

export const VARIANT_LINE: Record<Variant, string> = {
  clear: 'Dry night. The kiln holds its heat.',
  rain: 'Wet night. Everything runs 14° cold.',
  wind: 'Wind off the river. The mouth runs hot, the tail loses 12°.',
};

export const GRADE_LABEL: Record<Grade, string> = {
  transmuted: 'Kiln transmutation',
  fine: 'Fine piece',
  sound: 'Sound piece',
  under: 'Underfired',
  over: 'Overfired',
};

export const GRADE_LINE: Record<Grade, string> = {
  transmuted: 'The reduction caught it. This colour will not repeat.',
  fine: 'Glaze melted clean through. This is why you came.',
  sound: 'It holds water and it holds its shape. Nothing more.',
  under: 'The glaze never opened. Chalky, and it will craze.',
  over: 'It leaned in the heat and touched its neighbour.',
};

/* ------------------------------------------------------------------ *
 * Deterministic helpers
 * ------------------------------------------------------------------ */

export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function hoursUntilNextDay(date: Date): number {
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, (next - date.getTime()) / 3_600_000);
}

export function previousDayKey(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  return dayKeyOf(new Date(t - 86_400_000));
}

/* ------------------------------------------------------------------ *
 * The daily kiln
 * ------------------------------------------------------------------ */

function variantOf(roll: number): Variant {
  if (roll < 0.5) return 'clear';
  if (roll < 0.82) return 'rain';
  return 'wind';
}

function variantMod(variant: Variant, zone: Zone): number {
  if (variant === 'rain') return -14;
  if (variant === 'wind') return zone === 'mouth' ? 12 : zone === 'tail' ? -12 : 0;
  return 0;
}

export function makeKiln(day: string): Kiln {
  const seed = hash32(`kiln:${day}`);
  const rng = mulberry32(seed);
  const variant = variantOf(rng());

  const slots: Slot[] = [];
  for (const zone of ZONES) {
    for (let row = 0; row < 3; row += 1) {
      const jitter = Math.round(rng() * 8) - 4;
      const offset = ROW_OFFSET[row] ?? 0;
      slots.push({
        id: `${zone}-${row}`,
        zone,
        row,
        base: ZONE_BASE[zone] + offset + variantMod(variant, zone) + jitter,
      });
    }
  }

  // The dragon-egg bottle only comes out on dry nights: on a wet night even the
  // fire mouth cannot hold it, and a ware nobody can fire is a lie on the shelf.
  const pool = WARE_LIB.filter((ware) => {
    if (variant !== 'rain') return true;
    return ware.ideal <= 1300;
  });
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = pool[i];
    const b = pool[j];
    if (a && b) {
      pool[i] = b;
      pool[j] = a;
    }
  }
  const wares = pool.slice(0, 3);

  return {
    day,
    seed,
    variant,
    variantLine: VARIANT_LINE[variant],
    slots,
    wares,
  };
}

export function findWare(kiln: Kiln, wareId: string): Ware {
  const ware = kiln.wares.find((w) => w.id === wareId);
  if (!ware) throw new Error(`unknown ware: ${wareId}`);
  return ware;
}

export function findSlot(kiln: Kiln, slotId: string): Slot {
  const slot = kiln.slots.find((s) => s.id === slotId);
  if (!slot) throw new Error(`unknown slot: ${slotId}`);
  return slot;
}

/* ------------------------------------------------------------------ *
 * Firing
 * ------------------------------------------------------------------ */

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Three taps, each worth STOKE_MIN..STOKE_MAX depending on how centred it was. */
export function stokeOf(taps: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < 3; i += 1) {
    const tap = clamp01(taps[i] ?? 0);
    sum += STOKE_MIN + (STOKE_MAX - STOKE_MIN) * tap;
  }
  return Math.round(sum);
}

export function gradeOf(delta: number): Grade {
  const abs = Math.abs(delta);
  if (abs <= FINE_BAND) return 'fine';
  if (abs <= SOUND_BAND) return 'sound';
  return delta < 0 ? 'under' : 'over';
}

export function pointsOf(grade: Grade): number {
  switch (grade) {
    case 'transmuted':
      return 160;
    case 'fine':
      return 100;
    case 'sound':
      return 60;
    case 'under':
      return 25;
    case 'over':
      return 20;
  }
}

export function commitPiece(input: CommitInput): CommitResult {
  const ware = findWare(input.kiln, input.wareId);
  const slot = findSlot(input.kiln, input.slotId);
  const crowd = Math.max(0, Math.floor(input.crowd));
  const stoke = stokeOf(input.taps);
  const temp = slot.base + stoke - CROWD_PENALTY * crowd;
  const delta = temp - ware.ideal;
  const grade = gradeOf(delta);
  const transmuted =
    grade === 'fine' &&
    slot.zone === 'body' &&
    hash32(`transmute:${input.kiln.day}:${input.userId}`) % 100 < 6;

  return {
    ware,
    slot,
    stoke,
    temp,
    ideal: ware.ideal,
    delta,
    grade: transmuted ? 'transmuted' : grade,
    transmuted,
    score: pointsOf(transmuted ? 'transmuted' : grade),
  };
}

/* ------------------------------------------------------------------ *
 * What the potter can see before committing
 * ------------------------------------------------------------------ */

export type Forecast = 'fine' | 'sound' | 'far';

/**
 * A slot is "fine" if some honest stoke lands inside the fine band.
 * This is what the placement screen shows, so the hint can never lie:
 * it uses the same numbers the server will use.
 */
export function forecast(
  ware: Ware,
  slot: Slot,
  crowd: number
): { forecast: Forecast; low: number; high: number } {
  const low = slot.base + STOKE_MIN * 3 - CROWD_PENALTY * crowd;
  const high = slot.base + STOKE_MAX * 3 - CROWD_PENALTY * crowd;
  const idealLow = ware.ideal - FINE_BAND;
  const idealHigh = ware.ideal + FINE_BAND;
  const soundLow = ware.ideal - SOUND_BAND;
  const soundHigh = ware.ideal + SOUND_BAND;

  let result: Forecast = 'far';
  if (high >= idealLow && low <= idealHigh) result = 'fine';
  else if (high >= soundLow && low <= soundHigh) result = 'sound';

  return { forecast: result, low, high };
}

/** The stoke a perfect potter would need for this ware in this slot. */
export function idealStoke(ware: Ware, slot: Slot, crowd: number): number {
  return Math.max(
    STOKE_MIN * 3,
    Math.min(STOKE_MAX * 3, Math.round(ware.ideal - slot.base + CROWD_PENALTY * crowd))
  );
}

/* ------------------------------------------------------------------ *
 * The shared kiln
 * ------------------------------------------------------------------ */

export type ZoneCounts = Record<Zone, number>;

export function emptyCounts(): ZoneCounts {
  return { mouth: 0, body: 0, tail: 0 };
}

export type Collective = {
  balanced: boolean;
  total: number;
  counts: ZoneCounts;
  line: string;
};

export function collectiveOf(counts: ZoneCounts): Collective {
  const total = counts.mouth + counts.body + counts.tail;
  const spread = Math.max(counts.mouth, counts.body, counts.tail) - Math.min(counts.mouth, counts.body, counts.tail);
  const balanced = total >= 3 && spread <= 1;
  const line = balanced
    ? 'The load is spread. Heat is even end to end.'
    : total < 3
      ? 'The kiln is still mostly empty.'
      : counts.mouth > counts.body + counts.tail
        ? 'Too many pieces at the fire mouth. The tail is going cold.'
        : counts.tail > counts.mouth + counts.body
          ? 'The tail is packed. Nothing back there will see real heat.'
          : 'The load is lopsided. Somebody will lose their glaze.';
  return { balanced, total, counts, line };
}

export const COLLECTIVE_BONUS = 80;

export function streakBonus(streakDays: number): number {
  return Math.min(Math.max(0, streakDays), 7) * 6;
}

export function finalScore(result: CommitResult, balanced: boolean, streakDays: number): number {
  return result.score + (balanced ? COLLECTIVE_BONUS : 0) + streakBonus(streakDays);
}

/* ------------------------------------------------------------------ *
 * Text the server and the client both show
 * ------------------------------------------------------------------ */

export function explain(result: CommitResult, crowd: number): string {
  const parts = [
    `${ZONE_LABEL[result.slot.zone]} row ${result.slot.row + 1} sits at ${result.slot.base}°C.`,
    `Your stoking moved it ${result.stoke >= 0 ? '+' : ''}${result.stoke}°C.`,
  ];
  if (crowd > 0) {
    parts.push(`${crowd} ${crowd === 1 ? 'piece' : 'pieces'} already there cost you ${crowd * CROWD_PENALTY}°C.`);
  }
  parts.push(`${result.ware.name} wants ${result.ideal}°C; it saw ${result.temp}°C.`);
  return parts.join(' ');
}

export function shortDelta(delta: number): string {
  if (delta === 0) return 'dead on';
  return `${delta > 0 ? '+' : ''}${delta}°C`;
}
