// The pool's starting line: each manager's chance of winning before a snap was played.
//
// This cannot be recovered from game data. ESPN drops a game's pre-game predictor once the game
// is final (verified: the summary endpoint returns no `predictor` block for a completed Week 1
// game), so replaying the season today prices every matchup with today's ratings -- which know
// which teams collapsed. That produced a Pre-W1 bar putting the joint-best roster on paper at
// 2.9%, which is a statement about October, not about September.
//
// The preseason Vegas win totals in lib/teams.ts are the honest source: they are what the market
// thought in August, they never move, and they are the numbers the draft itself was run on.
import "server-only";
import { TEAM } from "./teams";
import { runSimulationWithGames, type SimGame } from "./simulation";
import type { Pick } from "./draft";

const GAMES_PER_TEAM = 17; // 18 weeks, one of them a bye
const HOME_FIELD_LOGIT = 0.2; // ~55% for two evenly matched teams, the long-run NFL home edge

function logit(p: number): number {
  return Math.log(p / (1 - p));
}

/** A team's preseason strength as a log-odds rating, from its Vegas win total. A 17-game line of
 * 11.5 is a .676 team; 4.5 is a .265 team. */
function preseasonRating(ab: string): number {
  const ou = TEAM[ab]?.ou;
  if (ou === undefined) return 0;
  const winRate = Math.min(0.95, Math.max(0.05, ou / GAMES_PER_TEAM));
  return logit(winRate);
}

/** The season's real schedule, with every game priced off the two teams' preseason win totals
 * instead of their current form -- and no results fixed, since none had been played. */
export function preseasonGames(games: SimGame[]): SimGame[] {
  return games.map((g) => {
    const diff = preseasonRating(g.home) - preseasonRating(g.away) + HOME_FIELD_LOGIT;
    return { ...g, fixedResult: null, pHomeWin: 1 / (1 + Math.exp(-diff)) };
  });
}

export async function getPreseasonWinProbabilities(
  picks: Pick[],
  roster: string[],
  games: SimGame[],
  year: number,
  trials: number,
): Promise<Record<string, number>> {
  const summary = await runSimulationWithGames(picks, roster, preseasonGames(games), year, trials);
  return Object.fromEntries(summary.results.map((r) => [r.manager, r.winPct]));
}
