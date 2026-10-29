import { z } from "zod";

const textValue = z.string().max(10_000);

export const growthStateSchema = z.object({
  schemaVersion: z.literal(2),
  nordMemory: z.object({
    summary: z.string().max(6000),
    stage: z.string().max(160),
    nextStep: z.string().max(1000),
    openQuestions: z.array(z.string().max(500)).max(12),
    source: z.string().max(500),
    updatedAt: z.string().max(64),
  }),
  beacon: z.object({
    title: textValue,
    horizon: textValue,
    desiredFuture: textValue,
    undesiredFuture: textValue,
  }),
  passport: z.object({
    pointA: textValue,
    strengths: z.array(textValue).max(30),
    constraints: z.array(textValue).max(30),
    values: z.array(textValue).max(30),
    threeYearVision: textValue,
  }),
  annualGoal: z.object({
    title: textValue,
    successMetric: textValue,
    targetDate: z.string().max(64),
    progress: z.number().min(0).max(100),
  }),
  sprint: z.object({
    title: textValue,
    outcome: textValue,
    startDate: z.string().max(64),
    endDate: z.string().max(64),
    weekNumber: z.number().int().min(1).max(12),
    progress: z.number().min(0).max(100),
  }),
  currentWeek: z.object({
    focus: textValue,
    capacity: z.enum(["light", "normal", "intensive"]),
    tasks: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          title: textValue,
          done: z.boolean(),
          priority: z.enum(["main", "support"]),
        }),
      )
      .max(50),
  }),
  reports: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        week: z.number().int().min(1).max(12),
        completed: textValue,
        insight: textValue,
        nextChange: textValue,
        createdAt: z.string().max(64),
      }),
    )
    .max(100),
  wheel: z
    .array(
      z.object({
        area: z.string().min(1).max(128),
        score: z.number().min(0).max(10),
      }),
    )
    .min(1)
    .max(16),
  checkpoints: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        date: z.string().max(64),
        courseStillFits: z.boolean(),
        note: textValue,
      }),
    )
    .max(50),
});

export type GrowthState = z.infer<typeof growthStateSchema>;

export type StateEnvelope = {
  state: GrowthState;
  revision: number;
  updatedAt: string;
};

export function createDefaultGrowthState(): GrowthState {
  return {
    schemaVersion: 2,
    nordMemory: { summary: "", stage: "Знакомство", nextStep: "", openQuestions: [], source: "", updatedAt: "" },
    beacon: {
      title: "Мой курс",
      horizon: "3–5 лет",
      desiredFuture: "",
      undesiredFuture: "",
    },
    passport: {
      pointA: "",
      strengths: [],
      constraints: [],
      values: [],
      threeYearVision: "",
    },
    annualGoal: {
      title: "",
      successMetric: "",
      targetDate: "",
      progress: 0,
    },
    sprint: {
      title: "Первый 12-недельный цикл",
      outcome: "",
      startDate: "",
      endDate: "",
      weekNumber: 1,
      progress: 0,
    },
    currentWeek: {
      focus: "",
      capacity: "normal",
      tasks: [],
    },
    reports: [],
    wheel: [
      { area: "Здоровье и энергия", score: 5 },
      { area: "Дело и доход", score: 5 },
      { area: "Отношения", score: 5 },
      { area: "Окружение", score: 5 },
      { area: "Развитие", score: 5 },
      { area: "Отдых", score: 5 },
      { area: "Финансы", score: 5 },
      { area: "Смысл и вклад", score: 5 },
    ],
    checkpoints: [],
  };
}

export function parseGrowthState(value: unknown): GrowthState {
  return growthStateSchema.parse(value);
}

export function migrateGrowthState(value: unknown): GrowthState {
  if (!value || typeof value !== "object") return createDefaultGrowthState();
  const source = value as Record<string, unknown>;
  if (source.schemaVersion === 1) {
    return parseGrowthState({ ...source, schemaVersion: 2, nordMemory: createDefaultGrowthState().nordMemory });
  }
  if (source.schemaVersion !== 2) {
    throw new Error("Неподдерживаемая версия данных. Нужна миграция.");
  }
  return parseGrowthState(value);
}
