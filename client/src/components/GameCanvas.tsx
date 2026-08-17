// Neon Omatsuri Cabinet: React is the ornate arcade cabinet, while Babylon remains the playable coin tray.
import { useEffect, useMemo, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Expand, RotateCcw, Sparkles, Volume2, VolumeX } from "lucide-react";
import { createGameScene, type GameHandle } from "@/game/scene";
import type { GameSnapshot } from "@/game/GameState";

const assetBase = `${import.meta.env.BASE_URL}assets/`;
const assets = {
  logo: `${assetBase}ikkaku-brand-mark.png`,
  mascot: `${assetBase}ikkaku-maneki-neko.png`,
  coin: `${assetBase}ikkaku-paw-coin.png`,
  lantern: `${assetBase}ikkaku-lantern.png`,
};

const defaultSnapshot: GameSnapshot = {
  score: 0,
  highScore: 0,
  coins: 30,
  combo: 0,
  fever: 16,
  isFever: false,
  muted: false,
  refillIn: 30,
};

type FloatBurst = { id: number; points: number; x: number };

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const startedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const burstIdRef = useRef(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(defaultSnapshot);
  const [bursts, setBursts] = useState<FloatBurst[]>([]);
  const [message, setMessage] = useState("好きな場所を狙って投入");
  const [shake, setShake] = useState(false);

  const scoreText = useMemo(() => snapshot.score.toLocaleString("ja-JP"), [snapshot.score]);

  const playTone = (frequency: number, duration = 0.06) => {
    if (snapshot.muted) return;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  const showBurst = (points: number, x: number) => {
    const id = ++burstIdRef.current;
    setBursts((current) => [...current, { id, points, x }]);
    window.setTimeout(() => setBursts((current) => current.filter((burst) => burst.id !== id)), 900);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let handle: GameHandle | null = null;

    void createGameScene(engine, canvas, {
      onState: setSnapshot,
      onDrop: () => {
        setMessage("コイン投入！ 押し板を待て");
        playTone(480, 0.045);
      },
      onCollect: (points, x) => {
        showBurst(points, x);
        setMessage("回収口へストン！ 運気上昇");
        playTone(760, 0.09);
        setShake(true);
        window.setTimeout(() => setShake(false), 180);
      },
      onFever: () => {
        setMessage("開運フィーバー突入！ 獲得コイン2倍");
        playTone(960, 0.24);
        setShake(true);
        window.setTimeout(() => setShake(false), 420);
      },
      onRefill: () => setMessage("無料補充 +5枚！ もう一度いこう"),
    }).then((created) => {
      handle = created;
      handleRef.current = created;
      engine.runRenderLoop(() => created.scene.render());
    });

    const onResize = () => engine.resize();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleRef.current?.dropAtCenter();
      }
      if (event.key.toLowerCase() === "m") handleRef.current?.toggleMuted();
      if (event.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      handle?.dispose();
      engine.dispose();
      handleRef.current = null;
      startedRef.current = false;
      void audioContextRef.current?.close();
    };
  }, []);

  const dropAtCenter = () => {
    playTone(480, 0.045);
    handleRef.current?.dropAtCenter();
  };

  const toggleMuted = () => handleRef.current?.toggleMuted();
  const reset = () => {
    handleRef.current?.reset();
    setMessage("盤面を整えました。狙って落とそう");
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return (
    <main className={`game-shell ${snapshot.isFever ? "is-fever" : ""} ${shake ? "is-shaking" : ""}`}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="一攫千金の3Dコイン落としゲーム台"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          playTone(480, 0.045);
          handleRef.current?.dropAtClientX(event.clientX, window.innerWidth);
        }}
      />

      <section className="game-hud" aria-label="ゲーム情報">
        <header className="marquee-frame">
          <img className="brand-mark" src={assets.logo} alt="一攫千金の肉球紋章" />
          <div className="brand-copy">
            <p>NEON OMATSURI COIN PUSHER</p>
            <h1>一攫千金</h1>
          </div>
          <div className="jackpot-panel" aria-label={`現在のスコア ${scoreText}`}>
            <span>本日の大当たり</span>
            <strong>{scoreText}</strong>
          </div>
        </header>

        <aside className="hud-left">
          <div className="display-panel coin-panel">
            <span className="panel-kicker">所持コイン</span>
            <div className="stat-line"><img src={assets.coin} alt="" /><strong>{snapshot.coins}</strong><small>枚</small></div>
          </div>
          <div className="display-panel compact-panel">
            <span className="panel-kicker">連続獲得</span>
            <strong className="combo-number">× {snapshot.combo}</strong>
          </div>
          <img className="mascot" src={assets.mascot} alt="片手を上げて招く白い招き猫" />
        </aside>

        <aside className="hud-right">
          <img className="lantern lantern-top" src={assets.lantern} alt="" />
          <div className="fever-panel">
            <span className="panel-kicker">開運ゲージ</span>
            <div className="meter-track"><span style={{ height: `${snapshot.fever}%` }} /></div>
            <strong>{snapshot.isFever ? "FEVER" : `${snapshot.fever}%`}</strong>
          </div>
          <button className="push-button" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={dropAtCenter} aria-label="中央へコインを投入">
            <span>肉球</span><b>PUSH</b><small>中央へ投入</small>
          </button>
          <img className="lantern lantern-bottom" src={assets.lantern} alt="" />
        </aside>

        <div className="floating-layer" aria-live="polite">
          {bursts.map((burst) => <span key={burst.id} className="score-burst" style={{ left: `${50 + burst.x * 7}%` }}>+{burst.points}</span>)}
          {snapshot.isFever && <span className="fever-banner"><Sparkles size={20} /> 開運フィーバー <i>COIN ×2</i></span>}
        </div>

        <footer className="control-deck">
          <p>{message} <span>無料補充まで {snapshot.refillIn}秒</span></p>
          <div className="utility-actions">
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleMuted} aria-label={snapshot.muted ? "音をオンにする" : "音をミュートする"}>{snapshot.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleFullscreen} aria-label="全画面表示"><Expand size={17} /></button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={reset} aria-label="ゲームをリセット"><RotateCcw size={17} /></button>
          </div>
        </footer>
      </section>

      <div className="orientation-notice" role="status"><img src={assets.logo} alt="" /><p>端末を横にして<br />大当たりを狙おう</p></div>
    </main>
  );
}
