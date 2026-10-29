import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { growthStateHistory, growthStates } from "@/db/schema";
import {
  createDefaultGrowthState,
  migrateGrowthState,
  parseGrowthState,
  type GrowthState,
  type StateEnvelope,
} from "@/lib/growth-state";

function nowIso() {
  return new Date().toISOString();
}

export async function getOrCreateState(user: ChatGPTUser): Promise<StateEnvelope> {
  const db = getDb();
  const existing = await db
    .select()
    .from(growthStates)
    .where(eq(growthStates.userId, user.userId))
    .limit(1);

  if (existing[0]) {
    return {
      state: migrateGrowthState(JSON.parse(existing[0].stateJson)),
      revision: existing[0].revision,
      updatedAt: existing[0].updatedAt,
    };
  }

  const state = createDefaultGrowthState();
  const updatedAt = nowIso();
  await db.insert(growthStates).values({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    schemaVersion: state.schemaVersion,
    revision: 1,
    stateJson: JSON.stringify(state),
    createdAt: updatedAt,
    updatedAt,
  });
  return { state, revision: 1, updatedAt };
}

export async function saveState(
  user: ChatGPTUser,
  nextState: unknown,
  reason: string,
  expectedRevision?: number,
): Promise<StateEnvelope> {
  const current = await getOrCreateState(user);
  if (
    typeof expectedRevision === "number" &&
    expectedRevision !== current.revision
  ) {
    throw new Error(
      `Данные уже изменились. Ожидалась ревизия ${expectedRevision}, актуальная — ${current.revision}.`,
    );
  }

  const state = parseGrowthState(nextState);
  const revision = current.revision + 1;
  const updatedAt = nowIso();

  const binding = env.DB;
  if (!binding) throw new Error("Личное хранилище DB недоступно");
  const [changed] = await binding.batch([
    binding.prepare(`UPDATE growth_states SET email = ?, display_name = ?, schema_version = ?, revision = ?, state_json = ?, updated_at = ?
      WHERE user_id = ? AND revision = ? RETURNING revision`)
      .bind(user.email, user.displayName, state.schemaVersion, revision, JSON.stringify(state), updatedAt, user.userId, current.revision),
    binding.prepare(`INSERT INTO growth_state_history (user_id, revision, reason, state_json, created_at)
      SELECT ?, ?, ?, ?, ? WHERE changes() > 0`)
      .bind(user.userId, current.revision, reason.slice(0, 240), JSON.stringify(current.state), updatedAt),
  ]);
  if (!changed.results.length) throw new Error("Данные уже изменились: ревизия устарела. Перечитайте контекст перед сохранением.");

  return { state, revision, updatedAt };
}

export async function mutateState(
  user: ChatGPTUser,
  reason: string,
  mutation: (state: GrowthState) => GrowthState,
): Promise<StateEnvelope> {
  const current = await getOrCreateState(user);
  const cloned = structuredClone(current.state);
  return saveState(user, mutation(cloned), reason, current.revision);
}

export async function listBackups(user: ChatGPTUser) {
  const db = getDb();
  return db
    .select({
      revision: growthStateHistory.revision,
      reason: growthStateHistory.reason,
      createdAt: growthStateHistory.createdAt,
    })
    .from(growthStateHistory)
    .where(eq(growthStateHistory.userId, user.userId))
    .orderBy(desc(growthStateHistory.id))
    .limit(20);
}
