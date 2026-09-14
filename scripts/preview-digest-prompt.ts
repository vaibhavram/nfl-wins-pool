// Local-only prompt workshop tool -- NOT part of the app. Renders the exact same prompt
// buildPrompt() produces against REAL data pulled from a real dry run against "Vaibhav's
// friends", Week 1 (copied in verbatim below), and calls the real LLM -- without touching the DB
// or deploying anything. Run with:
//   NODE_OPTIONS="--conditions=react-server" ANTHROPIC_API_KEY=... npx tsx scripts/preview-digest-prompt.ts
import { buildPrompt, type StandingsRow } from "../lib/weekly-digest";
import { generateText } from "../lib/llm";

const standingsRows: StandingsRow[] = [
  { name: "Rahul", teams: [], wins: 3, preWinPct: 26.2, postWinPct: 40.2 },
  { name: "Leo", teams: [], wins: 2, preWinPct: 2.3, postWinPct: 2.7 },
  { name: "Kaanchana", teams: [], wins: 2, preWinPct: 9.7, postWinPct: 11.9 },
  { name: "Deepak", teams: [], wins: 2, preWinPct: 4.6, postWinPct: 4.5 },
  { name: "Jong Ha", teams: [], wins: 1, preWinPct: 15.2, postWinPct: 10.8 },
  { name: "Vaibhav", teams: [], wins: 1, preWinPct: 7.1, postWinPct: 5.8 },
  { name: "Mohin", teams: [], wins: 1, preWinPct: 1.9, postWinPct: 1.6 },
  { name: "Keyur", teams: [], wins: 1, preWinPct: 9.0, postWinPct: 5.7 },
  { name: "Advait", teams: [], wins: 1, preWinPct: 15.6, postWinPct: 13.8 },
  { name: "Akash", teams: [], wins: 0, preWinPct: 8.4, postWinPct: 3.1 },
];

const gameLines = [
  "Seattle Seahawks (Leo) beat New England Patriots (Keyur) 13-10 (had been a 46% pre-game favorite)",
  "San Francisco 49ers (Kaanchana) beat L.A. Rams (Akash) 27-7 (had been a 49% pre-game favorite)",
  "Cincinnati Bengals (Advait) beat Tampa Bay Buccaneers (Mohin) 33-27 (had been a 63% pre-game favorite)",
  "Detroit Lions (Deepak) beat New Orleans Saints (Akash) 31-30 (had been a 67% pre-game favorite)",
  "New York Jets beat Tennessee Titans (Deepak) 23-10 (had been a 48% pre-game favorite)",
  "Baltimore Ravens (Jong Ha) beat Indianapolis Colts (Keyur) 41-23 (had been a 60% pre-game favorite)",
  "Pittsburgh Steelers (Kaanchana) beat Atlanta Falcons (Kaanchana) 20-13 (had been a 61% pre-game favorite)",
  "Chicago Bears (Deepak) beat Carolina Panthers (Jong Ha) 59-37 (had been a 58% pre-game favorite)",
  "Jacksonville Jaguars (Leo) beat Cleveland Browns (Leo) 34-10 (had been a 84% pre-game favorite)",
  "Buffalo Bills (Rahul) beat Houston Texans (Vaibhav) 36-31 (had been a 50% pre-game favorite)",
  "Las Vegas Raiders (Vaibhav) beat Miami Dolphins 27-13 (had been a 70% pre-game favorite)",
  "Minnesota Vikings (Rahul) beat Green Bay Packers (Mohin) 39-22 (had been a 59% pre-game favorite)",
  "Philadelphia Eagles (Keyur) beat Washington Commanders (Advait) 24-22 (had been a 65% pre-game favorite)",
  "Arizona Cardinals (Mohin) beat L.A. Chargers (Akash) 26-14 (had been a 32% pre-game favorite)",
  "New York Giants (Rahul) beat Dallas Cowboys (Jong Ha) 28-20 (had been a 53% pre-game favorite)",
];

const best = { name: "Rahul", pre: 26.2, post: 40.2 };
const worst = { name: "Akash", pre: 8.4, post: 3.1 };
const upsetLine = "Arizona Cardinals (Mohin) beat L.A. Chargers (Akash) 26-14 (had been a 32% pre-game favorite)";
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
