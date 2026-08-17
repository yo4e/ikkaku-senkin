# Structure: 一攫千金

## 層の分離

| 層 | 役割 | 主なファイル |
|---|---|---|
| React UI | HUD、PUSH、設定、モバイル案内、アクセシビリティ | `client/src/App.tsx`, `client/src/components/GameCanvas.tsx` |
| Scene lifecycle | Engine初期化、リサイズ、入力の開始と破棄 | `client/src/components/GameCanvas.tsx`, `client/src/game/scene.ts` |
| GameWorld | 台、押し板、コインプール、更新ループ、当たり判定 | `client/src/game/GameWorld.ts` |
| Core state | 所持コイン、スコア、連鎖、フィーバー、イベント発火 | `client/src/game/GameState.ts` |
| Visual utilities | コインメッシュ、粒子、看板、照明、招き猫Sprite | `client/src/game/scene.ts` |

## Data Flow

`GameCanvas`が`createGameScene`を一度だけ呼び、戻る`GameHandle`から`dropCoin`、`toggleMuted`、`reset`を提供する。`GameWorld`がイベントを発行し、`GameCanvas`はReactのHUD状態へ変換する。Reactコンポーネントは描画ループに直接依存しない。

## Asset Hints

- ロゴ、招き猫、提灯はHTMLの`img`要素で重ねるため、スクリーンサイズに対するpx基準で扱う。
- コインの主表示はBabylonの共有円柱と金属マテリアルで描画し、生成した肉球コインはHUDのアイコンに使う。
- 背景の青海波、枠、看板はCSSとBabylonの線・平面を組み合わせ、実行時の負荷を抑える。

## Lifecycle Rules

- EngineはReact StrictModeで二重初期化しない。
- すべてのwindowイベントとゲームループはdisposeで解除する。
- 画面サイズ変更時にEngineをresizeし、縦画面のままでも安全に描画を維持する。
