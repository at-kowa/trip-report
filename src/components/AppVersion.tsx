// アプリのバージョン表示（画面の下部。印刷しない）
//   値はビルドした時点で next.config.ts が決める。どの版が公開されているかの確認に使う
export default function AppVersion() {
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT;
  return (
    <div className="app-version no-print">
      出張報告システム v{process.env.NEXT_PUBLIC_APP_VERSION}
      {commit && `（${commit}）`}
      　ビルド {process.env.NEXT_PUBLIC_APP_BUILD_TIME}
    </div>
  );
}
