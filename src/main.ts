import './style.css';
import { newGame } from './core/gen';
import { loadGame, saveGame } from './core/save';
import { App } from './ui/app';

const state = loadGame() ?? newGame();
saveGame(state);
new App(document.getElementById('app')!, state);
