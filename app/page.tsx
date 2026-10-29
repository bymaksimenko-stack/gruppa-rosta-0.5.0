import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { GrowthDashboard } from "@/components/growth-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <GrowthDashboard displayName={user.displayName} />;
}
