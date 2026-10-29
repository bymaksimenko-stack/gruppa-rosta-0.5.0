import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateState, saveState } from "@/lib/state-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Нужен вход в ChatGPT" }, { status: 401 });
  return NextResponse.json(await getOrCreateState(user));
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Нужен вход в ChatGPT" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      state?: unknown;
      revision?: number;
      reason?: string;
    };
    const saved = await saveState(
      user,
      body.state,
      body.reason || "dashboard_update",
      body.revision,
    );
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить данные";
    const status = message.includes("ревизия") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
