import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// 画面に表示するアプリのバージョン（ビルドした時点で決まる）
//   バージョン：package.json の version
//   コミット  ：Vercel が Git から作るときはその値、手元では git の値。未コミットの変更があれば「+変更あり」を付ける
//   ビルド日時：日本時間
//   開発サーバ（npm run dev）では固定の値にする。設定は開発中に何度も読み直されるため、
//   git の実行（管理ファイルが更新される）や時刻の変化で「作り直し → 再読み込み」が繰り返されるのを防ぐ
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  const commit = dev
    ? "開発中"
    : process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
      || [git("rev-parse --short HEAD"), git("status --porcelain") ? "+変更あり" : ""].join("");
  const buildTime = dev
    ? "－"
    : new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });

  return {
    env: {
      NEXT_PUBLIC_APP_VERSION: version,
      NEXT_PUBLIC_APP_COMMIT: commit,
      NEXT_PUBLIC_APP_BUILD_TIME: buildTime,
    },
  };
}
