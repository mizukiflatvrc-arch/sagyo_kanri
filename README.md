# hibi — 図書館作業記録

図書館での作業時間とその日の状態、翌日の反動をユーザーごとに記録するWebアプリです。記録と振り返りの補助を目的としており、医療的な診断や復学可否の判定は行いません。

今回の実装範囲は要件のPhase 1・2です。Googleログイン、ユーザーごとのデータ分離、機微な自由記述のクライアント側暗号化、図書館CRUD、作業記録CRUD、翌日の状態の追加入力、入力検証、Firestore Security Rulesまで実装しています。

## 1. 推奨ディレクトリ構成

```text
.
├── public/
│   └── robots.txt
├── src/
│   ├── components/       共通UIとフォーム
│   ├── contexts/         認証・購読データ・通知
│   ├── lib/              Firebase初期化
│   ├── pages/            画面単位のコンポーネント
│   ├── services/         Firestoreアクセス
│   ├── styles/           アプリ全体のスタイル
│   ├── types/            ドメイン型・フォーム型
│   └── utils/            JST日時・表示・検証
├── tests/
│   └── firestore.rules.test.ts
├── .env.example
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

UI、型、検証、Firebase初期化、Firestore処理を分離しています。Firestore内の保存先は次のとおりです。

```text
users/{uid}/libraries/{libraryId}
users/{uid}/sessions/{sessionId}
users/{uid}/sessions/{sessionId}/revisions/{revisionId}
```

編集時はトランザクションを使い、更新前のセッション全体を`revisions`へ保存してから本体を更新します。更新履歴の表示画面はPhase 3で追加する想定です。

図書館の「削除」は内部的には論理削除です。過去の記録から図書館名やマップ情報が失われないようFirestore上には保持し、新規記録や管理画面の候補から除外します。

## 2. 使用パッケージ

実行時:

- `react` / `react-dom`
- `react-router-dom`
- `firebase`（モジュラーAPI）
- `lucide-react`

開発時:

- `typescript`
- `vite` / `@vitejs/plugin-react`
- `vitest` / `jsdom`
- `@firebase/rules-unit-testing`

Firebase CLIはプロジェクト依存へ固定していません。2026年7月時点の現行CLIはNode.js 20以上を必要とするため、デプロイとEmulator Suiteの実行環境にはNode.js 22 LTSを推奨します。アプリのビルド自体はNode.js 18以上で動作します。

### 初回インストール

```bash
npm install
```

確認:

```bash
npm test
npm run build
```

## 3. Firebaseの設定

### 3-1. プロジェクトとWebアプリを作る

1. Firebaseコンソールでプロジェクトを作成します。
2. 「アプリを追加」からWebアプリを登録します。
3. 「プロジェクトの設定 > マイアプリ」に表示されるFirebase構成値を控えます。
4. Cloud Firestoreを本番モードで作成します。ロケーションは利用地域に近いものを選びます。

### 3-2. Googleログインを有効にする

1. Firebase Authenticationの「Sign-in method」を開きます。
2. Googleプロバイダを有効にします。
3. Firebase Hosting以外の独自ドメインを使う場合は、Authenticationの承認済みドメインへ追加します。

### 3-3. ローカル環境変数を作る

```bash
cp .env.example .env.local
```

`.env.local`へ次を設定します。

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_USE_FIREBASE_EMULATORS=false
```

`.env.local`はGit管理対象外です。FirebaseのWeb構成値そのものはクライアントへ配信される識別情報ですが、認可は必ずAuthenticationとSecurity Rulesで行います。

### 3-4. Security Rulesをデプロイする

`firestore.rules`は、認証済みユーザー本人の`users/{uid}`配下だけを許可します。固定UIDや事前の利用者登録は不要です。Googleログインに成功したユーザーは、その時点から自分専用のデータ領域を利用できます。

```bash
firebase deploy --only firestore:rules
```

フロントエンドはログイン中ユーザーのUIDを保存先に使いますが、データ保護の最終判断はFirestore Security Rulesが担います。

## 4. TypeScriptのデータ型

中心となる型は`src/types/index.ts`にあります。

- `Library`
- `LibrarySession`
- `CompletionStatus`
- `NextDayReaction`
- `SessionFormValues`
- `LibraryFormValues`
- `SessionRevision`

ドメイン層の日付は`Date`へ統一し、Firestoreとの境界で`Timestamp`へ変換します。`datetime-local`はブラウザのタイムゾーンに依存させず、日本時間として明示的に変換します。

確認:

```bash
npm run build
```

このコマンドはstrict TypeScript検査の後に本番バンドルを作成します。

## 5. Authenticationとユーザー分離

`src/contexts/AuthContext.tsx`が次を担当します。

- Googleポップアップログイン
- 共有端末に認証を残しにくいセッション単位のログイン保持
- 認証状態の購読
- 未ログイン、ログイン済み、設定不足の画面分岐
- ログアウト

Googleログイン済みのユーザーは管理者の承認なしで利用を開始できます。アプリは`user.uid`を使って各ユーザー自身のパスだけを購読し、Firestore Rulesでも他人のパスへの読み書きを拒否します。

### 5-1. 自由記述のクライアント側暗号化

次の4項目はブラウザ内で暗号化してからFirestoreへ保存します。

- 予定タスク
- 実際の作業内容
- 翌日メモ
- 自由メモ

滞在時間、作業時間、集中度、焦り、疲労、翌日の反動など、集計に使う数値・日時・選択項目は通常のFirestoreデータとして保存します。

暗号鍵はユーザーが設定する12文字以上の暗号化パスフレーズから、ユーザーごとのランダムsaltとPBKDF2-HMAC-SHA-256（600,000回）で導出します。本文の暗号化はランダムな96-bit IVを使うAES-256-GCMです。パスフレーズと復号鍵はFirestoreやブラウザストレージへ保存せず、解除中のメモリだけに保持します。再読み込み、ロック、ログアウト後は再入力が必要です。

Firestoreにはsaltと暗号化済みの鍵確認値だけを`users/{uid}/settings/encryption`へ保存するため、同じパスフレーズを使えば別端末でも復号できます。パスフレーズを忘れた場合に運営者が自由記述を復元する仕組みはありません。

旧バージョンで平文保存された4項目は、最初の暗号化解除時に本体と`revisions`内の履歴スナップショットを自動移行します。Rulesは新規の平文保存を拒否し、既存データについては自由記述だけを暗号文へ置き換える一度限りの移行を許可します。

利用者向けには次の範囲を明示します。

> 記録はユーザーごとに分離され、運営者は通常、個別記録を閲覧しません。ただし、サービス運用上の権限を持つ管理者は、暗号化されていない数値・日時・選択項目へ技術的にアクセスできる場合があります。自由記述欄は端末側で暗号化され、暗号化パスフレーズなしには内容を復号できません。

これは保存済みデータの漏えいリスクを下げる仕組みです。配信中のフロントエンド自体が改ざんされた場合や、弱いパスフレーズへのオフライン推測、解除中の端末侵害までは防げません。Hosting、依存関係、管理者権限の保護も併せて行ってください。

確認:

1. `npm run dev`で起動します。
2. 未ログイン時にログイン画面が表示されることを確認します。
3. 任意のGoogleアカウントでログインし、ホームが表示されることを確認します。
4. 別のGoogleアカウントでは最初のアカウントの記録が表示されないことを確認します。

## 6. Firestoreアクセス関数

Firestore処理は画面から分離しています。

- `src/services/libraries.ts`: 図書館の購読、追加、編集、削除
- `src/services/sessions.ts`: 記録の購読、追加、編集、削除、翌日追記
- `src/services/firestoreMappers.ts`: Firestoreデータとドメイン型の変換
- `src/services/encryption.ts`: 鍵導出、AES-GCM暗号化・復号、暗号化設定

セッション編集と翌日追記では、更新前スナップショットの保存と本体更新を1つのトランザクションで実行します。Rules側でも対応する履歴が同じコミットに含まれない更新を拒否します。編集画面は読み込み時刻を使った同時編集検知を行い、別タブの新しい内容を無言で上書きしません。セッション削除時は本体を削除処理中としてロックしてから、配下の更新履歴も削除します。

暗号化導入時は、新しいアプリと`firestore.rules`を同じリリースでデプロイしてください。新Rulesだけを先に長時間公開すると旧アプリの平文書き込みが拒否され、旧アプリだけを先に公開すると暗号化設定の作成が拒否されます。

## 7. 図書館CRUD

`/libraries`から次の操作ができます。

- 図書館名、GoogleマップURL、任意の緯度・経度を登録
- 一覧表示
- 編集
- Googleマップを別タブで表示
- 未使用の図書館を削除

記録で使用中の図書館はUIとFirestore処理の両方で削除を拒否します。未使用の図書館も物理削除せず論理削除するため、同時操作が起きても既存記録の参照先は失われません。

確認:

1. 図書館を登録します。
2. 一覧から編集し、表示へ反映されることを確認します。
3. 未使用の図書館を削除します。
4. 記録で使用中の図書館が削除できないことを確認します。

## 8. セッションCRUD

`/sessions`、`/sessions/new`、`/sessions/:id`から次の操作ができます。

- 図書館、入退室日時、実作業時間を記録
- 集中度、焦り、疲労を0〜10で記録
- 自己否定していた時間、予定タスク、実際の作業、終了状況、メモを記録
- 新しい順の一覧、詳細、編集、削除
- 期間、図書館、翌日の反動、終了状況で絞り込み

主な入力検証:

- 入室日時より退室日時が後
- 滞在時間が1分以上
- 実作業時間と自己否定時間が滞在時間以内
- 各スコアが0〜10の整数
- 図書館が必須
- URL、緯度、経度の形式と範囲

確認:

1. 正常な記録を追加します。
2. 実作業時間を滞在時間より長くして、保存が止まりエラーが表示されることを確認します。
3. 詳細から編集し、変更が反映されることを確認します。
4. 削除確認をキャンセルした場合は残り、確定した場合だけ削除されることを確認します。

## 9. 翌日の反動の追加入力

新規記録では`pending`（翌日確認待ち）として保存します。ホームの「翌日確認待ち」または記録詳細から専用画面を開き、次のいずれかと補足メモを追記できます。

- なし
- 弱い
- 強い

追記も通常の編集と同様に、更新前スナップショットを保存します。

## 10. Firestore Security Rulesとテスト

ルールは次を強制します。

- 未認証ユーザーは全拒否
- 認証済みユーザーでも他ユーザーのパスは拒否
- 認証済み本人の`libraries`、`sessions`、`revisions`だけ許可
- 保存データのキー、型、値域、Timestampを検証
- セッション更新と更新前スナップショットの同時書き込みを強制
- 論理削除済み図書館への新しい参照を拒否
- その他のコレクションは全拒否

### ルールテストの準備

Firebase CLIとJava 11以上が必要です。Node.js 22 LTS環境で次を実行します。

```bash
npm install --global firebase-tools
firebase --version
java -version
```

テスト:

```bash
npm run test:rules
```

`test:rules`は実在プロジェクトへ接続せず、`demo-library-work-log-rules`というデモ用プロジェクトIDでローカルFirestore Emulatorだけを起動します。

Rulesテストでは、未認証ユーザー、認証済み本人、他人のパスを検証します。

アプリ全体をEmulator Suiteへ接続する場合は、`.env.local`の
`VITE_USE_FIREBASE_EMULATORS=true`を設定し、別のターミナルで次を起動します。

```bash
firebase emulators:start --only auth,firestore
```

Auth Emulatorは`127.0.0.1:9099`、Firestore Emulatorは
`127.0.0.1:8080`を使用します。

## 11. Firebase Hostingへのデプロイ

初回だけFirebase CLIへログインし、対象プロジェクトを関連付けます。

```bash
firebase login
firebase use --add
```

`firebase use --add`では、作成済みのFirebaseプロジェクトを`default`として選択します。`.firebaserc.example`をコピーし、プロジェクトIDを手動で設定する方法でも構いません。

デプロイ前:

```bash
npm run check:deploy
npm test
npm run test:rules
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

デプロイ後に確認する項目:

1. Hosting URLでログイン画面が表示される
2. 任意のGoogleアカウントでログインしてホームへ進める
3. 図書館と記録を追加・編集・削除できる
4. 別アカウントから他人のデータを読み書きできない
5. `/sessions/...`を直接開いても404にならずアプリが表示される
6. `robots.txt`が`Disallow: /`を返す

## 開発コマンド

```bash
npm run dev        # 開発サーバー
npm test           # バリデーション等のユニットテスト
npm run build      # strict型検査 + 本番ビルド
npm run preview    # distのローカル確認
npm run test:rules # Firestore Emulatorでルールテスト
npm run check:deploy # Firebase環境変数のデプロイ前確認
```

## MVP外

次は今回のPhase 1・2には含めていません。

- CSV・Markdown書き出し
- 更新履歴の一覧・過去バージョン詳細画面
- グラフ
- PWA、通知
- Firebase App Check
- 利用規約、プライバシーポリシー、問い合わせ先
- アカウント削除、ユーザー自身による全データ削除
- 利用量監視、課金アラート
- Google Maps APIによる検索や地図埋め込み

更新前データの保存構造は実装済みなので、Phase 3で履歴表示を追加できます。
