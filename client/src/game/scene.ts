// Neon Omatsuri Cabinet: Babylon owns the illuminated coin tray; React supplies the cabinet-style HUD.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { GameWorld } from "./GameWorld";
import type { GameSnapshot } from "./GameState";

export type GameHandle = {
  scene: Scene;
  dropAtClientX: (clientX: number, viewportWidth: number) => void;
  dropAtCenter: () => void;
  toggleMuted: () => void;
  reset: () => void;
  dispose: () => void;
};

export type SceneCallbacks = {
  onState: (state: GameSnapshot) => void;
  onDrop: () => void;
  onCollect: (points: number, x: number) => void;
  onFever: () => void;
  onRefill: () => void;
};

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement, callbacks: SceneCallbacks): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#05091BFF");
  scene.imageProcessingConfiguration.exposure = 0.78;
  scene.imageProcessingConfiguration.contrast = 1.08;

  const camera = new ArcRotateCamera("cabinet-camera", Math.PI / 2, 0.91, 13.6, new Vector3(0, 0.25, 0), scene);
  camera.lowerRadiusLimit = 13.6;
  camera.upperRadiusLimit = 13.6;
  camera.lowerBetaLimit = 0.91;
  camera.upperBetaLimit = 0.91;
  camera.fov = 0.78;
  camera.attachControl(canvas, false);

  const ambient = new HemisphericLight("indigo-ambient", new Vector3(0, 1, 0), scene);
  ambient.diffuse = Color3.FromHexString("#7192D9");
  ambient.groundColor = Color3.FromHexString("#120816");
  ambient.intensity = 0.42;

  const goldLight = new PointLight("gold-light", new Vector3(0, 4.6, 0.6), scene);
  goldLight.diffuse = Color3.FromHexString("#FFD15A");
  goldLight.intensity = 7.5;
  goldLight.range = 11;

  const magentaLight = new PointLight("magenta-light", new Vector3(-3.5, 2, -1.5), scene);
  magentaLight.diffuse = Color3.FromHexString("#FF39C4");
  magentaLight.intensity = 3.1;
  magentaLight.range = 8;

  const cyanLight = new PointLight("cyan-light", new Vector3(3.5, 1.7, 1.5), scene);
  cyanLight.diffuse = Color3.FromHexString("#47F2F1");
  cyanLight.intensity = 2.7;
  cyanLight.range = 8;

  const glow = new GlowLayer("arcade-bloom", scene, { blurKernelSize: 36 });
  glow.intensity = 0.34;

  const params = new URLSearchParams(window.location.search);
  const world = new GameWorld(scene, callbacks, params.has("demo"));
  scene.onBeforeRenderObservable.add(() => world.update(Math.min(0.05, engine.getDeltaTime() / 1000)));

  return {
    scene,
    dropAtClientX: (clientX, viewportWidth) => world.dropAt((clientX / Math.max(1, viewportWidth)) * 2 - 1),
    dropAtCenter: () => world.dropAt(0),
    toggleMuted: () => world.toggleMuted(),
    reset: () => world.reset(),
    dispose: () => {
      world.dispose();
      glow.dispose();
      scene.dispose();
    },
  };
}
