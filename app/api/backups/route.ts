import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { listBackups } from "@/lib/state-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Нужен вход в ChatGPT" }, { status: 401 });
  return NextResponse.json({ backups: await listBackups(user) });
}
