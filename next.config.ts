import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// 画面に表示するアプリのバージョン（ビルドした時点で決まる）
//   バージョン：package.json の version
//   コミット  ：Vercel が Git から作るときはその値、手元では git の値。未コミットの変更があれば「+変更あり」を付ける
//   ビルド日時：日本時間
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || [git("rev-parse --short HEAD"), git("status --porcelain") ? "+変更あり" : ""].join("");
const buildTime = new Date().toLocaleString("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_COMMIT: commit,
    NEXT_PUBLIC_APP_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
