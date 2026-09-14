// Local-only prompt workshop tool -- NOT part of the app. Renders the exact same prompt
// buildPrompt() produces against fixture data (based on the real numbers seen in a real dry run
// against "Vaibhav's friends", Week 1) and calls the real LLM, without touching the DB or
// deploying anything. Run with:
//   NODE_OPTIONS="--conditions=react-server" ANTHROPIC_API_KEY=... npx tsx scripts/preview-digest-prompt.ts
import { buildPrompt, type StandingsRow } from "../lib/weekly-digest";
import { generateText } from "../lib/llm";

// Rosters (used only to make the fixture's owner attributions below realistic):
// Rahul: ARI, PIT, BUF | Leo: SEA, JAX, DAL | Kaanchana: SF, NE, MIA | Deepak: CHI, GB, TB
// Jong Ha: KC, CIN, NYJ | Keyur: DET, MIN, LAR | Vaibhav: DEN, ATL, NO | Akash: LAC, TEN, NYG
// IND and CAR are left undrafted, to exercise the "unowned team" no-parens case too.
const standingsRows: StandingsRow[] = [
  { name: "Rahul", teams: ["ARI", "PIT", "BUF"], wins: 2, preWinPct: 25.5, postWinPct: 40.4 },
  { name: "Leo", teams: ["SEA", "JAX", "DAL"], wins: 2, preWinPct: 22.1, postWinPct: 24.8 },
  { name: "Kaanchana", teams: ["SF", "NE", "MIA"], wins: 2, preWinPct: 18.4, postWinPct: 17.2 },
  { name: "Deepak", teams: ["CHI", "GB", "TB"], wins: 2, preWinPct: 15.0, postWinPct: 13.9 },
  { name: "Jong Ha", teams: ["KC", "CIN", "NYJ"], wins: 1, preWinPct: 9.2, postWinPct: 6.8 },
  { name: "Keyur", teams: ["DET", "MIN", "LAR"], wins: 1, preWinPct: 8.6, postWinPct: 6.1 },
  { name: "Vaibhav", teams: ["DEN", "ATL", "NO"], wins: 1, preWinPct: 8.3, postWinPct: 4.7 },
  { name: "Akash", teams: ["LAC", "TEN", "NYG"], wins: 0, preWinPct: 9.0, postWinPct: 3.3 },
];

const gameLines = [
  "Arizona Cardinals (Rahul) beat Los Angeles Chargers (Akash) 24-17 (had been a 32% pre-game favorite)",
  "Buffalo Bills (Rahul) beat New York Jets (Jong Ha) 27-13 (had been a 68% pre-game favorite)",
  "Indianapolis Colts beat Denver Broncos (Vaibhav) 20-16 (had been a 61% pre-game favorite)",
  "Seattle Seahawks (Leo) beat Carolina Panthers 34-10 (had been a 55% pre-game favorite)",
];

const best = { name: "Rahul", pre: 25.5, post: 40.4 };
const worst = { name: "Akash", pre: 9.0, post: 3.3 };
const upsetLine = "Arizona Cardinals (Rahul) beat Los Angeles Chargers (Akash) 24-17 (had been a 32% pre-game favorite)";
const streakLines: string[] = []; // week 1 -- no multi-week streaks yet

const prompt = buildPrompt("Vaibhav's friends", 1, standingsRows, gameLines, best, worst, upsetLine, streakLines);

console.log("─".repeat(80));
console.log(prompt);
console.log("─".repeat(80));

generateText(prompt).then((recap) => {
  console.log("\nRECAP:\n");
  console.log(recap);
  console.log(`\n(${recap.split(/\s+/).length} words)`);
});
