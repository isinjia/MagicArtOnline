import './style.css';
import { loadGame } from './core/save';
import { loadFonts } from './fonts';
import { App } from './ui/app';

void loadFonts().then(() => {
  new App(document.getElementById('app')!, loadGame());
});
