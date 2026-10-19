"use client";

// 操作しないまま1時間たったら自動でログアウトする
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 60 * 60 * 1000;
const EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

export default function IdleLogout() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    EVENTS.forEach((ev) => document.addEventListener(ev, touch, true));
    const timer = setInterval(async () => {
      if (Date.now() - last < IDLE_MS) return;
      clearInterval(timer);
      await createClient().auth.signOut();
      router.replace("/login?reason=idle");
      router.refresh();
    }, 10_000);
    return () => {
      clearInterval(timer);
      EVENTS.forEach((ev) => document.removeEventListener(ev, touch, true));
    };
  }, [router]);

  return null;
}
