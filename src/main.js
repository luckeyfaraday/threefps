import { Game } from "./core/game.js";
import { Hud } from "./ui/hud.js";

const hud = new Hud(document);
const game = new Game({
  hud,
  mount: document.getElementById("viewport"),
});

game.init().catch((error) => {
  console.error(error);
  hud.setError("Failed to load the collision world.");
});
