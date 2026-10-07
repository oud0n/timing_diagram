# タイミングチャートエディタ刷新計画 (Tauri + React 19 + SVG)

## 概要
`timing_diagram` の高機能 SVG 描画エンジンをベースに、不要な AI 関連機能を完全削除し、バックエンドを **Tauri (Rust)** に置き換えて軽量・高速なデスクトップアプリとして再構築します。さらに、旧 `timing_chart_editor` の強みである **「ワンクリック・ドラッグによる直感的な波形編集」** を統合します。

---

## 実装アイテム & TODO リスト

### 1. 環境セットアップ
- [x] **1.1** Rust ツールチェーン (`rustup`, `cargo`, `rustc`) のセットアップ
- [x] **1.2** 作業ブランチの作成 (`feat/tauri-timing-diagram`) と旧 Electron コードの退避 (`legacy-electron-app`)

### 2. 基盤統合 & AI 関連の完全削除
- [ ] **2.1** `/tmp/timing_diagram` の最新アセット（`src/`, `package.json`, `vite.config.ts`, Tailwind 設定）を本プロジェクトへ移植
- [ ] **2.2** AI 関連コード・依存の完全除去
  - `server.ts`（Express / Gemini API 呼び出し）の削除
  - `package.json` から `@google/genai`, `express`, `tsx` を削除
  - `metadata.json` などの AI Studio 設定を削除
- [ ] **2.3** 純粋な Vite + React 19 SPA としての起動確認 (`npm run dev`)

### 3. Tauri (Rust) 基盤の構築
- [ ] **3.1** Tauri CLI / 依存パッケージの導入 (`@tauri-apps/cli`, `@tauri-apps/api`)
- [ ] **3.2** `src-tauri` ディレクトリの初期化と設定 (`tauri.conf.json`, `Cargo.toml`)
- [ ] **3.3** ネイティブファイル I/O の実装
  - JSON ファイルの保存ダイアログ (`Save` / `Save As`)
  - JSON ファイルの開くダイアログ (`Open`)
  - SVG ベクター画像のエクスポートダイアログ (`Export SVG`)
- [ ] **3.4** React フロントエンドと Tauri コマンドの接続

### 4. クリックによる波形修正機能の移植・強化
- [ ] **4.1** `WaveformCanvas` への直接クリックトグル実装
  - Binary/Clock 信号: セルクリックで `0` ↔ `1` 即時反転
  - Bus/その他信号: セルクリックで `0` → `1` → `=` → `z` → `x` の循環切り替え
- [ ] **4.2** マウスドラッグによる連続塗りつぶし (Paint-on-drag)
  - マウスを押しながら横になぞることで、複数サイクルを素早く同値に設定
- [ ] **4.3** バス値（データラベル）のインライン編集
  - バスセル（`=`）のダブルクリックでラベル編集ポップアップ/入力
- [ ] **4.4** キーボード操作 & Undo / Redo 対応
  - `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` での波形修正履歴管理
  - `0` / `1` キーによる選択セルの素早い値変更

### 5. UI/UX 改善 & 互換性
- [ ] **5.1** 旧 `timing_chart_editor` 形式 JSON の自動インポート機能
- [ ] **5.2** デスクトップ用メニューバー・キーボードショートカット (`Cmd+S`, `Cmd+O`, `Cmd+E`) の設定
- [ ] **5.3** テーマ設定やレイアウトの最適化

### 6. ビルド検証 & 配布パッケージ作成
- [ ] **6.1** `npm run tauri build` による macOS アプリ（`.dmg` / `.app`）のビルド確認
- [ ] **6.2** 配布パッケージサイズ・起動速度の検証
