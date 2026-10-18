# Timing Diagram

タイミングチャートを SVG で作成・編集する React 19 + TypeScript + Vite アプリです。
ブラウザ版と Tauri 2 のデスクトップ版を提供します。旧 Electron 版は `legacy-electron-app` ブランチに保持しています。

## 起動・検証

Node.js 24 以降と npm を使用します。

```sh
npm ci
npm run dev
```

表示されたローカル URL をブラウザで開いてください。

```sh
npm test          # JSON、履歴、反復検出、SVG、画面操作の回帰テスト
npm run lint     # TypeScript 型チェック
npm run build    # 型チェックと本番ビルド（dist/）
npm run preview  # ビルド済み Web アプリの確認
```

デスクトップ版は Rust / Cargo と各 OS のネイティブ開発環境も必要です。

```sh
npm run desktop:dev    # Tauri + Vite の開発起動
npm run desktop:build  # 配布パッケージ生成
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

macOS の成果物は `src-tauri/target/release/bundle/macos/Timing Diagram.app` と `src-tauri/target/release/bundle/dmg/` に生成します。GitHub Actions は Web のテスト・ビルドに加え、手動実行またはバージョンタグで macOS / Windows パッケージを生成する定義があります。GitHub 上での実行と Windows 実機動作は未確認です。Release 公開は自動化していません。

## 実装済みの操作

- 信号の追加・削除・並べ替え、波形文字列・色・線幅の設定
- Binary セルのクリック反転、バス等の `0 → 1 → = → z → x` 切替、ドラッグ塗り、選択セルの `0` / `1` キー編集
- Segment Painter で `0` / `1` / `z` / `x` / `=` を設定。継続記法を解決して編集し、後続セルの値を保持
- 周期・デューティ比・位相からのクロック生成。直接編集する場合は Convert clock to Binary で変換
- バスセルのダブルクリックでラベル編集、Enter で確定、Escape でキャンセル
- 波形文字列が終端を超えると時間軸を自動延長。`+100 cycles` で追加し、`Go to end` で末尾へ移動
- バスの値・表示形式・ビット幅の編集、ビット展開
- マーカー、信号間のタイミング制約、繰り返し検出・範囲指定、時間の折り畳み
- ダーク／ライトテーマ切替
- Undo / Redo ボタン、`Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`
- JSON のクリップボードコピーと貼り付け読込
- New / Open / Save / Save As と未保存変更の保存・破棄・キャンセル確認
- デスクトップメニューと `Ctrl/Cmd+S`、`Ctrl/Cmd+Shift+S`、`Ctrl/Cmd+O`、`Ctrl/Cmd+E`
- 単体で表示できる SVG のコピー・ダウンロード

信号、設定、マーカー、制約、繰り返し、折り畳みの変更は共通の履歴に入ります。入力欄の編集はフォーカスを離れた時に1件にまとめます。入力欄内のショートカットは通常の文字編集を優先します。テーマと選択セルは図の履歴に含めません。

信号を削除すると、その信号を参照する制約も削除します。サイクル数を減らすと波形とバス値を切り詰め、マーカー・制約・範囲を新しい時間軸に収めます。これらも Undo で復元できます。

初期の終端140nsは14サイクル × 10nsの設定値です。Settings の Total Cycles でも延長できます。現在は最大100,000サイクル（10ns刻みで1ms）に対応します。SVGの横幅とメモリ使用量を考慮した上限があり、完全な無制限ではありません。長い図では目盛りを間引き、補助目盛りを省略します。SVG出力は表示中の範囲だけでなく全時間軸を含みます。

## JSON 形式と未保存状態

書き出しは現行 SVG エディタ形式に `formatVersion: 1` を付けます。必須の `config`、`signals`、`markers`、`constraints` と、任意の `repeatRanges`、`folds` を持ちます。省略した任意リストは空配列に正規化します。

現行形式のバージョンなし JSON も読込可能です。旧 Electron 形式は対応しません。未知のバージョン、不正な値、重複 ID、存在しない信号への参照は拒否し、現在の図を保持します。カラーは `#RGB` または `#RRGGBB`、波形記法は `0 1 z x = . ~ - h l`（大文字も可）です。

未保存表示は起動時、読込時、またはデスクトップ版の保存成功時の図との比較です。Undo で同じ図に戻ると表示が解除されます。Copy JSON や SVG 出力は保存済み状態を変更しません。デスクトップ版は同じディレクトリの一時ファイルから置換して保存します。JSON の読込上限は16 MiBです。ブラウザ版の Save はダウンロードとなり、保存済み扱いにはしません。自動保存はありません。

## 構成と今後

- `src/App.tsx`: 画面と操作の接続
- `src/components/WaveformCanvas.tsx`: SVG 波形描画
- `src/components/`: 信号・マーカー・制約・繰り返しの編集 UI
- `src/document.ts`: JSON の検証・正規化・書き出し
- `src/history.ts` / `src/hooks/useDiagramHistory.ts`: 編集履歴と保存済み状態
- `src/svgExport.ts`: SVG のスタイル埋め込み・書き出し
- `src/waveformEditing.ts`: 継続記法を保持したセル編集・クロック変換
- `src/fileGateway.ts` / `src/hooks/useDocumentFiles.ts`: Web / ネイティブのファイル操作と未保存確認
- `src-tauri/`: ネイティブメニュー、ファイルダイアログ、保存処理、配布設定
- `src/utils.ts`: 波形解析・折り畳み座標・繰り返し検証
- `tests/`: 回帰テスト

2026-10-10 に macOS 27.0.1 / arm64 で配布 `.app` の起動・編集・保存・再起動後の読込・SVG 出力を確認しました。アプリは約10.45 MiB、DMGは約2.93 MiBです。Developer ID署名・公証は未対応で、実機検証はこのMacのみです。配布版の起動時間、最小ウィンドウでの配置、Windows、DMGからのインストール検証と、マーカーの単位表記・ラベル重なりの修正は残っています。[TODO.md](./TODO.md) に検証範囲と残項目を記録しています。
