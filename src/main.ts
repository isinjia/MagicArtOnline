import './style.css';
import { newGame } from './core/gen';
import { loadGame, saveGame } from './core/save';
import { loadFonts } from './fonts';
import { App } from './ui/app';

void loadFonts().then(() => {
  const state = loadGame() ?? newGame();
  saveGame(state);
  new App(document.getElementById('app')!, state);
});
