import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { migrateGrowthState } from "@/lib/growth-state";
import { getOrCreateState, mutateState, saveState } from "@/lib/state-store";

export const dynamic = "force-dynamic";

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: unknown };
};

const tools = [
  {
    name: "gruppa_rosta_v1_get_nord_context",
    description: "ГР - НОРД: в начале каждого нового чата прочитать курс, Паспорт роста, цель и сохраненную память продолжения. История задач и отчетов не загружается целиком.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "gruppa_rosta_v1_save_nord_memory",
    description: "ГР - НОРД: сохранить подтвержденный краткий итог работы, этап, открытые вопросы и следующий шаг. Требует confirm=true и актуальную revision из чтения контекста.",
    inputSchema: {
      type: "object",
      required: ["summary", "stage", "next_step", "open_questions", "source", "expected_revision", "confirm"],
      properties: {
        summary: { type: "string", maxLength: 6000 },
        stage: { type: "string", maxLength: 160 },
        next_step: { type: "string", maxLength: 1000 },
        open_questions: { type: "array", maxItems: 12, items: { type: "string", maxLength: 500 } },
        source: { type: "string", maxLength: 500 },
        expected_revision: { type: "integer", minimum: 1 },
        confirm: { type: "boolean", const: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_get_dashboard",
    description: "Прочитать весь актуальный личный контекст: маяк, Паспорт роста, годовую цель, 12 недель, текущую неделю, отчеты и колесо жизни.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "gruppa_rosta_v1_save_beacon",
    description: "Сохранить личный курс на 3–5 лет. Не выдумывай формулировки без подтверждения участника.",
    inputSchema: {
      type: "object",
      required: ["title", "desired_future"],
      properties: {
        title: { type: "string" },
        desired_future: { type: "string" },
        undesired_future: { type: "string" },
        horizon: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_save_growth_passport",
    description: "Сохранить подтвержденный Паспорт роста после распаковки с НОРДом.",
    inputSchema: {
      type: "object",
      required: ["point_a", "three_year_vision"],
      properties: {
        point_a: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        constraints: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "string" } },
        three_year_vision: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_set_annual_goal",
    description: "Сохранить реалистичную годовую цель и критерий результата.",
    inputSchema: {
      type: "object",
      required: ["title", "success_metric"],
      properties: {
        title: { type: "string" },
        success_metric: { type: "string" },
        target_date: { type: "string" },
        progress: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_set_sprint",
    description: "Создать или обновить текущий 12-недельный спринт.",
    inputSchema: {
      type: "object",
      required: ["title", "outcome"],
      properties: {
        title: { type: "string" },
        outcome: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        week_number: { type: "integer", minimum: 1, maximum: 12 },
        progress: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_plan_week",
    description: "Сохранить фокус, нагрузку и проверяемые задачи текущей недели.",
    inputSchema: {
      type: "object",
      required: ["focus", "capacity", "tasks"],
      properties: {
        focus: { type: "string" },
        capacity: { type: "string", enum: ["light", "normal", "intensive"] },
        tasks: {
          type: "array",
          items: {
            type: "object",
            required: ["title"],
            properties: {
              title: { type: "string" },
              priority: { type: "string", enum: ["main", "support"] },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_complete_task",
    description: "Изменить статус одной задачи по ее id.",
    inputSchema: {
      type: "object",
      required: ["task_id", "done"],
      properties: { task_id: { type: "string" }, done: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_submit_week_report",
    description: "Сохранить недельный отчет: сделано, вывод и изменение следующего шага.",
    inputSchema: {
      type: "object",
      required: ["week", "completed", "insight", "next_change"],
      properties: {
        week: { type: "integer", minimum: 1, maximum: 12 },
        completed: { type: "string" },
        insight: { type: "string" },
        next_change: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_check_course",
    description: "Зафиксировать четырехнедельную сверку текущих действий с долгосрочным курсом.",
    inputSchema: {
      type: "object",
      required: ["course_still_fits", "note"],
      properties: {
        course_still_fits: { type: "boolean" },
        note: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gruppa_rosta_v1_export_snapshot",
    description: "Выгрузить переносимую копию всех личных данных в JSON.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "gruppa_rosta_v1_restore_snapshot",
    description: "Восстановить личные данные из совместимого JSON-снимка. Требует явного confirm=true; предыдущая версия сохраняется в истории.",
    inputSchema: {
      type: "object",
      required: ["snapshot", "confirm"],
      properties: {
        snapshot: { type: "object" },
        confirm: { type: "boolean", const: true },
      },
      additionalProperties: false,
    },
  },
] as const;

const stringArray = z.array(z.string()).default([]);

async function callTool(user: ChatGPTUser, name: string, rawArgs: unknown) {
  const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;

  switch (name) {
    case "gruppa_rosta_v1_get_nord_context": {
      const { state, revision, updatedAt } = await getOrCreateState(user);
      return {
        specialist: "ГР - НОРД", schemaVersion: state.schemaVersion, revision, updatedAt,
        beacon: state.beacon, passport: state.passport, annualGoal: state.annualGoal,
        memory: state.nordMemory, latestCourseCheck: state.checkpoints[0] ?? null,
      };
    }
    case "gruppa_rosta_v1_save_nord_memory": {
      const value = z.object({
        summary: z.string().max(6000), stage: z.string().min(1).max(160),
        next_step: z.string().max(1000), open_questions: z.array(z.string().max(500)).max(12),
        source: z.string().min(1).max(500), expected_revision: z.number().int().min(1), confirm: z.literal(true),
      }).strict().parse(args);
      const current = await getOrCreateState(user);
      const state = { ...current.state, nordMemory: {
        summary: value.summary, stage: value.stage, nextStep: value.next_step,
        openQuestions: value.open_questions, source: value.source, updatedAt: new Date().toISOString(),
      } };
      const saved = await saveState(user, state, "mcp:save_nord_memory", value.expected_revision);
      return { revision: saved.revision, memory: saved.state.nordMemory };
    }
    case "gruppa_rosta_v1_get_dashboard":
      return getOrCreateState(user);
    case "gruppa_rosta_v1_save_beacon": {
      const value = z.object({
        title: z.string(),
        desired_future: z.string(),
        undesired_future: z.string().default(""),
        horizon: z.string().default("3–5 лет"),
      }).parse(args);
      return mutateState(user, "mcp:save_beacon", (state) => ({
        ...state,
        beacon: {
          title: value.title,
          desiredFuture: value.desired_future,
          undesiredFuture: value.undesired_future,
          horizon: value.horizon,
        },
      }));
    }
    case "gruppa_rosta_v1_save_growth_passport": {
      const value = z.object({
        point_a: z.string(),
        strengths: stringArray,
        constraints: stringArray,
        values: stringArray,
        three_year_vision: z.string(),
      }).parse(args);
      return mutateState(user, "mcp:save_growth_passport", (state) => ({
        ...state,
        passport: {
          pointA: value.point_a,
          strengths: value.strengths,
          constraints: value.constraints,
          values: value.values,
          threeYearVision: value.three_year_vision,
        },
      }));
    }
    case "gruppa_rosta_v1_set_annual_goal": {
      const value = z.object({
        title: z.string(),
        success_metric: z.string(),
        target_date: z.string().default(""),
        progress: z.number().min(0).max(100).default(0),
      }).parse(args);
      return mutateState(user, "mcp:set_annual_goal", (state) => ({
        ...state,
        annualGoal: {
          title: value.title,
          successMetric: value.success_metric,
          targetDate: value.target_date,
          progress: value.progress,
        },
      }));
    }
    case "gruppa_rosta_v1_set_sprint": {
      const value = z.object({
        title: z.string(),
        outcome: z.string(),
        start_date: z.string().default(""),
        end_date: z.string().default(""),
        week_number: z.number().int().min(1).max(12).default(1),
        progress: z.number().min(0).max(100).default(0),
      }).parse(args);
      return mutateState(user, "mcp:set_sprint", (state) => ({
        ...state,
        sprint: {
          title: value.title,
          outcome: value.outcome,
          startDate: value.start_date,
          endDate: value.end_date,
          weekNumber: value.week_number,
          progress: value.progress,
        },
      }));
    }
    case "gruppa_rosta_v1_plan_week": {
      const value = z.object({
        focus: z.string(),
        capacity: z.enum(["light", "normal", "intensive"]),
        tasks: z.array(z.object({
          title: z.string(),
          priority: z.enum(["main", "support"]).default("main"),
        })).max(50),
      }).parse(args);
      return mutateState(user, "mcp:plan_week", (state) => ({
        ...state,
        currentWeek: {
          focus: value.focus,
          capacity: value.capacity,
          tasks: value.tasks.map((task) => ({
            id: crypto.randomUUID(),
            title: task.title,
            done: false,
            priority: task.priority,
          })),
        },
      }));
    }
    case "gruppa_rosta_v1_complete_task": {
      const value = z.object({ task_id: z.string(), done: z.boolean() }).parse(args);
      return mutateState(user, "mcp:complete_task", (state) => ({
        ...state,
        currentWeek: {
          ...state.currentWeek,
          tasks: state.currentWeek.tasks.map((task) =>
            task.id === value.task_id ? { ...task, done: value.done } : task,
          ),
        },
      }));
    }
    case "gruppa_rosta_v1_submit_week_report": {
      const value = z.object({
        week: z.number().int().min(1).max(12),
        completed: z.string(),
        insight: z.string(),
        next_change: z.string(),
      }).parse(args);
      return mutateState(user, "mcp:submit_week_report", (state) => ({
        ...state,
        reports: [
          {
            id: crypto.randomUUID(),
            week: value.week,
            completed: value.completed,
            insight: value.insight,
            nextChange: value.next_change,
            createdAt: new Date().toISOString(),
          },
          ...state.reports,
        ].slice(0, 100),
      }));
    }
    case "gruppa_rosta_v1_check_course": {
      const value = z.object({ course_still_fits: z.boolean(), note: z.string() }).parse(args);
      return mutateState(user, "mcp:check_course", (state) => ({
        ...state,
        checkpoints: [
          {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            courseStillFits: value.course_still_fits,
            note: value.note,
          },
          ...state.checkpoints,
        ].slice(0, 50),
      }));
    }
    case "gruppa_rosta_v1_export_snapshot": {
      const envelope = await getOrCreateState(user);
      return {
        format: "gruppa-rosta-snapshot",
        exportedAt: new Date().toISOString(),
        ...envelope,
      };
    }
    case "gruppa_rosta_v1_restore_snapshot": {
      const value = z.object({ snapshot: z.unknown(), confirm: z.literal(true) }).parse(args);
      const snapshot = value.snapshot as { state?: unknown };
      const state = migrateGrowthState(snapshot?.state ?? snapshot);
      return saveState(user, state, "mcp:restore_snapshot");
    }
    default:
      throw new Error(`Неизвестный инструмент: ${name}`);
  }
}

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

export async function POST(request: Request) {
  let rpc: RpcRequest;
  try {
    rpc = await request.json();
  } catch {
    return rpcError(null, -32700, "Некорректный JSON");
  }

  if (rpc.method === "server/discover" || rpc.method === "initialize") {
    return rpcResult(rpc.id, {
      protocolVersion: "2026-07-28",
      supportedVersions: ["2026-07-28"],
      capabilities: { tools: {} },
      serverInfo: { name: "ГРУППА РОСТА | МОИ ДАННЫЕ", version: "1.1.0" },
    });
  }

  if (rpc.method === "tools/list") return rpcResult(rpc.id, { tools });

  if (rpc.method === "tools/call") {
    const user = await getChatGPTUser();
    if (!user) return rpcError(rpc.id, -32001, "Нужен подтвержденный пользователь ChatGPT");
    const name = rpc.params?.name;
    if (!name) return rpcError(rpc.id, -32602, "Не указано имя инструмента");

    try {
      const data = await callTool(user, name, rpc.params?.arguments);
      return rpcResult(rpc.id, {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка инструмента";
      return rpcResult(rpc.id, {
        isError: true,
        content: [{ type: "text", text: message }],
      });
    }
  }

  return rpcError(rpc.id, -32601, `Метод не поддерживается: ${rpc.method ?? ""}`);
}
