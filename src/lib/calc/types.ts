/** Data shapes shared by the calculations. They mirror the objects of the original single-file app. */
export type Level = "K" | "A" | "R";
export type QType = "mc" | "tf" | "fix" | "match" | "mcj" | "compare" | "fig" | "essay";

export interface Skill {
  id: string;
  subj?: string;
  ch: string;
  chNo?: number;
  lesson?: string;
  level: Level;
  name: string;
}

export interface Question {
  id: string;
  skill: string;
  type: QType;
  text: string;
  opts?: string[];
  ans?: number;
  key?: string;
  pairs?: { a: string; b: string }[];
  x?: string;
  y?: string;
  crit?: string[];
  parts?: string[];
  ul?: string;
  max?: number;
  img?: number | boolean;
  src?: string;
  adapted?: boolean;
  v?: number;
}

export interface Student {
  id: string;
  no: number;
  name: string;
  cls: string;
}

export interface Test {
  id: string;
  name: string;
  type: string;
  date: string;
  dur?: string | number;
  qs: Question[];
  /** student id → mark per question */
  results: Record<string, number[]>;
  demo?: boolean;
}

export interface Improvement {
  id: string;
  base: string;
  crit: "lost" | "80" | "50" | string;
  date: string;
  round?: number;
  qs: Question[];
  /** student id → indexes into qs */
  items: Record<string, number[]>;
  /** student id → 0/1 per item */
  results: Record<string, number[]>;
}

/** Everything the calculations need to look up. */
export interface Ctx {
  skills: Skill[];
  roster: Student[];
  imps: Improvement[];
  bank?: Question[];
}
