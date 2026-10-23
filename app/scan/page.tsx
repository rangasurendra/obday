import { redirect } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { getSession } from "@/lib/auth";
import Scanner from "./Scanner";

export default async function ScanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <AppHeader session={session} current="scan" />
      <Scanner username={session.username} />
    </div>
  );
}
