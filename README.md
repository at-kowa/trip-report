# 出張報告システム（試作・検証版）

営業担当者の出張報告書を入力し、多段階の承認を経て管理する Web アプリの試作です。
Next.js（TypeScript）＋ supabase で作っています。**架空のデータのみ**を扱います。

設計資料は `C:\work\出張報告システム_基本設計\` にあります（画面モック、DB設計書、schema.sql など）。
要件定義書は `C:\work\以前の検討資料\出張報告システム_要件定義書_v2.0.html` です。

## 開発を始める手順

1. Node.js（LTS 版）をインストールする
2. このフォルダで部品をダウンロードする（PowerShell の場合）

   ```
   $env:NODE_OPTIONS = "--use-system-ca"; npm install
   ```

   Node.js は初期設定では Windows に登録された証明書を使わないため、この PC では
   `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` のエラーでダウンロードに失敗する。
   `--use-system-ca` で Windows の証明書を使うようにする（証明書のチェックを外す設定ではない）。
   `npm run dev` などの起動コマンドには、この設定を組み込み済み。

3. supabase の at-kowa プロジェクトを使う（研修中は他の人と共用。専用のスキーマ `trip_report` に作って分けている。スキーマ名は `src/lib/db.ts` で管理）
   1. SQL Editor で `check_01_at-kowa_名前の重複確認.sql` を実行し、名前が使われていないことを確認する
   2. SQL Editor で `schema_at-kowa.sql` を実行する
   3. Project Settings → Data API → Exposed schemas に `trip_report` を追加する（アプリから使えるようにする）
   4. Authentication → Users で、`seed_at-kowa.sql` の先頭に書いた10件のテスト用ユーザーを作成する
   5. SQL Editor で `seed_at-kowa.sql` を実行する（利用者・承認ルート・サンプルの報告書が入る）
   6. 検収が終わったら `drop_at-kowa_検収後の削除.sql` の手順で削除する
4. `.env.local.example` をコピーして `.env.local` を作り、at-kowa プロジェクトの値を入れる
   （値は supabase の管理画面で確認する。`.env.local` は共有しない）
5. 開発用のサーバを起動し、ブラウザ（Edge）で http://localhost:3000 を開く

   ```
   npm run dev
   ```

6. 利用者・承認ルートを CSV で追加・変更するときは、管理者（admin@example.com）でログインし、「利用者・承認ルート」で
   `テストデータ_利用者.csv` → `テストデータ_承認ルート.csv` の順に取り込む

## 作成済みの範囲

| 機能 | 状態 |
|---|---|
| ログイン／ログアウト、1時間の無操作で自動ログアウト | 作成済み |
| メニュー（役割に応じて表示）、承認待ち・差戻しの件数バッジ | 作成済み |
| 利用者 CSV の取り込み（認証ユーザーの自動作成・利用停止を含む） | 作成済み |
| 承認ルート CSV の取り込み | 作成済み |
| パスワード再設定（仮パスワードの発行） | 作成済み |
| 自分の報告書、入力・編集（写真を含む）、詳細・承認（承認・差戻し・取り下げ・PDF出力） | 作成済み（動作確認中） |
| 承認対応、ダッシュボード、全報告書 | 作成済み（動作確認中） |
| オフラインでの下書き保存・同期 | 未作成 |

## フォルダ構成

- `src/app/login` … ログイン画面
- `src/app/(app)` … ログイン後の画面（共通のメニューは `layout.tsx`）
- `src/app/api/admin` … 管理者向けのサーバ処理（管理者権限の接続キーを使う）
- `src/lib/supabase` … supabase への接続（`admin.ts` はサーバ側専用）
- `src/lib/csv.ts` … CSV の読み取りと内容チェック

## 注意

- 管理者権限の接続キー（`SUPABASE_SERVICE_ROLE_KEY`）はサーバ側の処理だけで使う。名前に `NEXT_PUBLIC_` を付けない
- 接続キーやパスワードをコードやチャットに書かない
- 担当者名欄は試作のみ（架空データ）。本番化の際は部署・役職に置き換えるか、保管場所を見直す
