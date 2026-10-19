// ログイン直後：役割に応じた最初の画面へ移す
import { redirect } from "next/navigation";
import { homePath, requireProfile } from "@/lib/auth";

export default async function Home() {
  const me = await requireProfile();
  redirect(homePath(me));
}
