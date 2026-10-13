import { logger } from '../../../core/logger.js';
import { listExpiredGames } from './store.js';
import { startHideAndSeek, guessHideAndSeek, endHideAndSeek } from './hideSeek.js';
import { startTrivia, answerTrivia, endTrivia } from './trivia.js';
import { startRaceLobby, pickRacer, startRaceNow, runRace } from './race.js';

export { startHideAndSeek, guessHideAndSeek, startTrivia, startRaceLobby };

const FINISHERS = {
  hideseek: (client, game) => endHideAndSeek(client, game.id, game),
  trivia: (client, game) => endTrivia(client, game.id, game),
  race: (client, game) => runRace(client, game.id),
};

/**
 * Backstop for the in-process timers: finishes any game whose time ran out
 * (e.g. the bot restarted mid-game). Every finisher is idempotent.
 */
export async function sweepExpiredGames(client) {
  for (const game of listExpiredGames()) {
    await FINISHERS[game.type]?.(client, game).catch((err) => logger.warn({ err, gameId: game.id, type: game.type }, 'Could not finish expired Peaches game'));
  }
}

export const gameButtons = {
  trivia: answerTrivia,
  race_pick: pickRacer,
  race_go: startRaceNow,
};
