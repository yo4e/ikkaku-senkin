// Neon Omatsuri Cabinet: core state stays framework-free so the visual frame never owns game rules.
export type GameSnapshot = {
  score: number;
  highScore: number;
  coins: number;
  combo: number;
  fever: number;
  isFever: boolean;
  muted: boolean;
  refillIn: number;
};

const SAVE_KEY = "ikkaku-senkin-save-v1";

type SaveData = Pick<GameSnapshot, "highScore" | "muted">;

export class GameState {
  private score = 0;
  private highScore = 0;
  private coins = 30;
  private combo = 0;
  private fever = 16;
  private feverSeconds = 0;
  private muted = false;
  private refillSeconds = 30;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}") as Partial<SaveData>;
      this.highScore = saved.highScore ?? 0;
      this.muted = saved.muted ?? false;
    } catch {
      // A malformed local save should never prevent a new arcade session.
    }
  }

  snapshot(): GameSnapshot {
    return {
      score: this.score,
      highScore: this.highScore,
      coins: this.coins,
      combo: this.combo,
      fever: this.fever,
      isFever: this.feverSeconds > 0,
      muted: this.muted,
      refillIn: Math.max(0, Math.ceil(this.refillSeconds)),
    };
  }

  spendCoin(): boolean {
    if (this.coins <= 0) return false;
    this.coins -= 1;
    return true;
  }

  collectCoin(multiplier = 1): { scoreGain: number; startedFever: boolean } {
    this.combo = Math.min(99, this.combo + 1);
    const scoreGain = 100 * multiplier + Math.min(900, this.combo * 12);
    this.score += scoreGain;
    this.coins = Math.min(99, this.coins + 1 + (this.feverSeconds > 0 ? 1 : 0));
    this.highScore = Math.max(this.highScore, this.score);
    this.fever = Math.min(100, this.fever + 11 + (this.combo > 7 ? 3 : 0));

    let startedFever = false;
    if (this.fever >= 100 && this.feverSeconds <= 0) {
      this.fever = 0;
      this.feverSeconds = 18;
      startedFever = true;
    }
    this.persist();
    return { scoreGain, startedFever };
  }

  update(deltaSeconds: number): boolean {
    let changed = false;
    this.refillSeconds -= deltaSeconds;
    if (this.refillSeconds <= 0) {
      this.refillSeconds = 30;
      this.coins = Math.min(99, this.coins + 5);
      this.combo = 0;
      changed = true;
    }
    if (this.feverSeconds > 0) {
      this.feverSeconds = Math.max(0, this.feverSeconds - deltaSeconds);
      changed = true;
    }
    return changed;
  }

  toggleMuted() {
    this.muted = !this.muted;
    this.persist();
  }

  reset() {
    this.score = 0;
    this.coins = 30;
    this.combo = 0;
    this.fever = 16;
    this.feverSeconds = 0;
    this.refillSeconds = 30;
  }

  private persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ highScore: this.highScore, muted: this.muted } satisfies SaveData));
  }
}
