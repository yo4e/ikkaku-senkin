// Neon Omatsuri Cabinet: a compact pseudo-physics world prioritizes readable, satisfying coin motion.
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import { GameState, type GameSnapshot } from "./GameState";

type Coin = {
  mesh: Mesh;
  velocity: Vector3;
  active: boolean;
  spawnDelay: number;
  age: number;
};

export type WorldEvents = {
  onState: (state: GameSnapshot) => void;
  onDrop: () => void;
  onCollect: (points: number, x: number) => void;
  onFever: () => void;
  onRefill: () => void;
};

export class GameWorld {
  private readonly state = new GameState();
  private readonly coins: Coin[] = [];
  private readonly petals: Mesh[] = [];
  private readonly pusher: Mesh;
  private readonly coinMaterial: StandardMaterial;
  private elapsed = 0;
  private lastEmit = 0;
  private demoTimer = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly events: WorldEvents,
    private readonly isDemo: boolean,
  ) {
    this.coinMaterial = new StandardMaterial("coin-gold", scene);
    this.coinMaterial.diffuseColor = Color3.FromHexString("#DCAE36");
    this.coinMaterial.specularColor = Color3.FromHexString("#FFF1A8");
    this.coinMaterial.emissiveColor = Color3.FromHexString("#422307");

    this.pusher = this.createCabinet();
    this.createCoinPool();
    this.createPetals();
    this.seedTable();
    if (this.isDemo) this.demoTimer = 0.82;
    this.events.onState(this.state.snapshot());
  }

  dropAt(normalizedX: number) {
    if (!this.state.spendCoin()) return;
    const coin = this.coins.find((candidate) => !candidate.active) ?? this.coins.find((candidate) => candidate.mesh.position.z < -3.8);
    if (!coin) return;

    coin.active = true;
    coin.spawnDelay = 0;
    coin.age = 0;
    coin.mesh.isVisible = true;
    coin.mesh.position.set(Math.max(-2.8, Math.min(2.8, normalizedX * 2.8)), 1.95, 3.05);
    coin.mesh.rotation.set(0, Math.random() * Math.PI, Math.random() * 0.15 - 0.075);
    coin.velocity.set((Math.random() - 0.5) * 0.12, 0, -0.42);
    this.events.onDrop();
    this.emitState();
  }

  update(delta: number) {
    if (this.disposed) return;
    this.elapsed += delta;
    const cycle = (this.elapsed % 4.4) / 4.4;
    const forward = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
    const pushingForward = cycle < 0.5;
    const pusherZ = 3.52 - forward * 6.66;
    this.pusher.position.z = pusherZ;

    for (const coin of this.coins) {
      if (!coin.active) continue;
      this.updateCoin(coin, delta, pusherZ, pushingForward);
    }
    this.resolveCoinContacts();
    this.updatePetals(delta);

    const wasRefill = this.state.snapshot().refillIn <= 1;
    const stateChanged = this.state.update(delta);
    if (stateChanged && wasRefill && this.state.snapshot().refillIn >= 29) this.events.onRefill();

    if (this.isDemo) {
      this.demoTimer += delta;
      if (this.demoTimer > (this.state.snapshot().isFever ? 0.38 : 0.82)) {
        this.demoTimer = 0;
        this.dropAt(Math.sin(this.elapsed * 1.7) * 0.86);
      }
    }

    if (this.elapsed - this.lastEmit > 0.12 || stateChanged) this.emitState();
  }

  snapshot() {
    return this.state.snapshot();
  }

  toggleMuted() {
    this.state.toggleMuted();
    this.emitState();
  }

  reset() {
    this.state.reset();
    for (const coin of this.coins) {
      coin.active = false;
      coin.mesh.isVisible = false;
      coin.velocity.setAll(0);
      coin.age = -1;
    }
    this.seedTable();
    this.emitState();
  }

  dispose() {
    this.disposed = true;
  }

  private createCabinet() {
    const cabinetMaterial = new StandardMaterial("cabinet", this.scene);
    cabinetMaterial.diffuseColor = Color3.FromHexString("#0E1734");
    cabinetMaterial.specularColor = Color3.FromHexString("#1E3B73");
    cabinetMaterial.emissiveColor = Color3.FromHexString("#081026");

    const gold = new StandardMaterial("gold-frame", this.scene);
    gold.diffuseColor = Color3.FromHexString("#A86D14");
    gold.specularColor = Color3.FromHexString("#FFF5A8");
    gold.emissiveColor = Color3.FromHexString("#3F2406");

    const red = new StandardMaterial("vermilion-pusher", this.scene);
    red.diffuseColor = Color3.FromHexString("#A9171E");
    red.specularColor = Color3.FromHexString("#FFC3AA");
    red.emissiveColor = Color3.FromHexString("#4A000D");

    const bed = MeshBuilder.CreateBox("coin-bed", { width: 7.38, depth: 8.75, height: 0.24 }, this.scene);
    bed.position.y = 0;
    bed.material = cabinetMaterial;

    const upperShelf = MeshBuilder.CreateBox("upper-shelf", { width: 7.08, depth: 2.35, height: 0.18 }, this.scene);
    upperShelf.position.set(0, 0.37, 2.8);
    upperShelf.material = cabinetMaterial;

    const railData = [
      { x: -3.74, z: 0, width: 0.2, depth: 8.9 },
      { x: 3.74, z: 0, width: 0.2, depth: 8.9 },
      { x: 0, z: 4.31, width: 7.65, depth: 0.2 },
    ];
    railData.forEach((data, index) => {
      const rail = MeshBuilder.CreateBox(`gold-rail-${index}`, { width: data.width, depth: data.depth, height: 0.68 }, this.scene);
      rail.position.set(data.x, 0.4, data.z);
      rail.material = gold;
    });

    const collectionLip = MeshBuilder.CreateBox("collection-lip", { width: 7.45, depth: 0.36, height: 0.28 }, this.scene);
    collectionLip.position.set(0, 0.24, -4.16);
    collectionLip.material = gold;

    const collectorGlow = new StandardMaterial("collector-glow", this.scene);
    collectorGlow.diffuseColor = Color3.FromHexString("#2A092B");
    collectorGlow.emissiveColor = Color3.FromHexString("#C828B5");
    const collector = MeshBuilder.CreateBox("collection-slot", { width: 5.95, depth: 0.52, height: 0.05 }, this.scene);
    collector.position.set(0, 0.17, -4.32);
    collector.material = collectorGlow;

    const pusher = MeshBuilder.CreateBox("pusher", { width: 6.85, depth: 0.62, height: 0.6 }, this.scene);
    pusher.position.set(0, 0.67, 3.52);
    pusher.material = red;

    const pusherTrim = MeshBuilder.CreateBox("pusher-trim", { width: 6.97, depth: 0.12, height: 0.18 }, this.scene);
    pusherTrim.parent = pusher;
    pusherTrim.position.set(0, 0.27, -0.27);
    pusherTrim.material = gold;

    for (let i = 0; i < 5; i += 1) {
      const lamp = MeshBuilder.CreateSphere(`lamp-${i}`, { diameter: 0.18, segments: 8 }, this.scene);
      lamp.position.set(-2.7 + i * 1.35, 0.48, -4.02);
      const lampMaterial = new StandardMaterial(`lamp-material-${i}`, this.scene);
      lampMaterial.emissiveColor = i % 2 === 0 ? Color3.FromHexString("#F547B7") : Color3.FromHexString("#35E8EE");
      lamp.material = lampMaterial;
    }

    return pusher;
  }

  private createCoinPool() {
    for (let index = 0; index < 96; index += 1) {
      const coin = MeshBuilder.CreateCylinder(`coin-${index}`, { height: 0.14, diameter: 0.42, tessellation: 12 }, this.scene);
      coin.material = this.coinMaterial;
      coin.isVisible = false;
      this.coins.push({ mesh: coin, velocity: Vector3.Zero(), active: false, spawnDelay: 0, age: -1 });
    }
  }

  private seedTable() {
    let cursor = 0;
    for (let row = 0; row < 7; row += 1) {
      const count = row < 3 ? 7 : 5;
      for (let column = 0; column < count; column += 1) {
        const coin = this.coins[cursor++];
        coin.active = true;
        coin.mesh.isVisible = true;
        coin.mesh.position.set((column - (count - 1) / 2) * 0.72 + (row % 2 ? 0.16 : 0), 0.34 + (row < 2 ? 0.18 : 0), 2.85 - row * 0.88);
        coin.mesh.rotation.set(0, Math.random() * Math.PI, Math.random() * 0.08 - 0.04);
        coin.velocity.set((Math.random() - 0.5) * 0.03, 0, 0);
        coin.age = -1;
      }
    }
  }

  private createPetals() {
    const petalMaterial = new StandardMaterial("petal-material", this.scene);
    petalMaterial.diffuseColor = Color3.FromHexString("#FF86D9");
    petalMaterial.emissiveColor = Color3.FromHexString("#7A164C");
    petalMaterial.alpha = 0.72;
    for (let index = 0; index < 28; index += 1) {
      const petal = MeshBuilder.CreateSphere(`petal-${index}`, { diameter: 0.055 + (index % 4) * 0.012, segments: 4 }, this.scene);
      petal.position.set((Math.random() - 0.5) * 8.2, 0.8 + Math.random() * 5, (Math.random() - 0.5) * 8);
      petal.material = petalMaterial;
      this.petals.push(petal);
    }
  }

  private updatePetals(delta: number) {
    const fever = this.state.snapshot().isFever;
    for (let index = 0; index < this.petals.length; index += 1) {
      const petal = this.petals[index];
      petal.position.y -= delta * (fever ? 1.55 : 0.32);
      petal.position.x += Math.sin(this.elapsed * 1.4 + index) * delta * (fever ? 0.7 : 0.12);
      petal.rotation.z += delta * (1.1 + (index % 3));
      petal.isVisible = fever || index % 5 === 0;
      if (petal.position.y < 0.12) {
        petal.position.y = 4.5 + Math.random() * 2.2;
        petal.position.x = (Math.random() - 0.5) * 8.2;
      }
    }
  }

  private updateCoin(coin: Coin, delta: number, pusherZ: number, pushingForward: boolean) {
    const { mesh, velocity } = coin;
    if (coin.age >= 0) coin.age += delta;
    const onUpperShelf = mesh.position.z > 1.72;
    const floorY = onUpperShelf ? 0.55 : 0.34;
    if (mesh.position.y > floorY) mesh.position.y = Math.max(floorY, mesh.position.y - delta * 3.6);

    if (pushingForward && mesh.position.z < pusherZ - 0.08 && mesh.position.z > pusherZ - 1.82 && mesh.position.y <= 0.57) {
      velocity.z -= delta * (this.state.snapshot().isFever ? 8.4 : 5.4);
      velocity.x += Math.sin(this.elapsed * 2.5 + mesh.position.x) * delta * 0.26;
    }
    if (pushingForward && pusherZ < -2.45 && mesh.position.z < -2.18) {
      velocity.z -= delta * (this.state.snapshot().isFever ? 12.5 : 8.2);
    }
    if (coin.age > 5.2 && mesh.position.z < 0.75) {
      velocity.z -= delta * (this.state.snapshot().isFever ? 16 : 11);
    }

    velocity.z *= 0.985;
    velocity.x *= 0.978;
    mesh.position.x += velocity.x * delta;
    mesh.position.z += velocity.z * delta;
    mesh.rotation.x += velocity.z * delta * 3.8;
    mesh.rotation.z += velocity.x * delta * 4.2;

    if (Math.abs(mesh.position.x) > 3.27) {
      mesh.position.x = Math.sign(mesh.position.x) * 3.27;
      velocity.x *= -0.48;
    }

    if (mesh.position.z < -3.18) {
      coin.active = false;
      mesh.isVisible = false;
      coin.age = -1;
      const { scoreGain, startedFever } = this.state.collectCoin(this.state.snapshot().isFever ? 2 : 1);
      this.events.onCollect(scoreGain, mesh.position.x);
      if (startedFever) this.events.onFever();
    }
  }

  private resolveCoinContacts() {
    const activeCoins = this.coins.filter((coin) => coin.active && coin.mesh.isVisible);
    const minDistance = 0.37;
    for (let i = 0; i < activeCoins.length; i += 1) {
      const a = activeCoins[i];
      for (let j = i + 1; j < activeCoins.length; j += 1) {
        const b = activeCoins[j];
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared === 0 || distanceSquared > minDistance * minDistance) continue;
        const distance = Math.sqrt(distanceSquared);
        const push = (minDistance - distance) * 0.5;
        const nx = dx / distance;
        const nz = dz / distance;
        a.mesh.position.x -= nx * push;
        a.mesh.position.z -= nz * push;
        b.mesh.position.x += nx * push;
        b.mesh.position.z += nz * push;
        a.velocity.x -= nx * 0.04;
        a.velocity.z -= nz * 0.04;
        b.velocity.x += nx * 0.04;
        b.velocity.z += nz * 0.04;
      }
    }
  }

  private emitState() {
    this.lastEmit = this.elapsed;
    this.events.onState(this.state.snapshot());
  }
}
