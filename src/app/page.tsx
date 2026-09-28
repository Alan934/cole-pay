import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor } from "@/lib/session";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(homeFor(session.user.role));
}
