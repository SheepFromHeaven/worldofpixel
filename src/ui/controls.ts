import { NOWHERE } from '../sim/grid.ts';
import { NOBODY } from '../sim/people/people.ts';
import { game } from './game.ts';
import { KeyController } from './keys.ts';

export const keys = new KeyController();

keys.on('togglePause', (phase) => {
  if (phase !== 'press') return false;
  game.togglePause();
  return true;
});

keys.on('cycleSpeed', (phase) => {
  if (phase !== 'press') return false;
  game.cycleSpeed();
  return true;
});

keys.on('deeper', (phase) => {
  if (phase !== 'press') return false;
  game.dig(4);
  return true;
});

keys.on('shallower', (phase) => {
  if (phase !== 'press') return false;
  game.dig(-4);
  return true;
});

keys.on('cancel', (phase) => {
  if (phase !== 'press') return false;
  if (game.openedIndex !== NOWHERE) {
    game.openTile(NOWHERE);
    return true;
  }
  if (game.selectedPerson !== NOBODY) {
    game.selectPerson(NOBODY);
    return true;
  }
  if (game.selectedStructure !== NOWHERE) {
    game.clearStructureSelection();
    return true;
  }
  if (game.tool !== null) {
    game.setTool(null);
    return true;
  }
  return false;
});
