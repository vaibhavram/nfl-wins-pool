export type TeamRecord = { wins: number; losses: number; ties: number };

export type Team = {
  ab: string;
  city: string;
  name: string;
  full: string;
  div: string;
  color: string;
  ou: number; // Vegas preseason win-total line — static for the season, set once at draft time
  logo: string;
};

function logoUrl(ab: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${ab.toLowerCase()}.png`;
}

// [ab, city, name, division, primaryColor, vegasOverUnder]
// Win totals: Yahoo Sports, "NFL win totals odds regular season" (2026 season lines).
const RAW: [string, string, string, string, string, number][] = [
  ["ARI", "Arizona", "Cardinals", "NFC West", "#97233F", 4.5],
  ["ATL", "Atlanta", "Falcons", "NFC South", "#A71930", 7.5],
  ["BAL", "Baltimore", "Ravens", "AFC North", "#241773", 11.5],
  ["BUF", "Buffalo", "Bills", "AFC East", "#00338D", 10.5],
  ["CAR", "Carolina", "Panthers", "NFC South", "#0085CA", 7.5],
  ["CHI", "Chicago", "Bears", "NFC North", "#1c3557", 9.5],
  ["CIN", "Cincinnati", "Bengals", "AFC North", "#FB4F14", 10.5],
  ["CLE", "Cleveland", "Browns", "AFC North", "#4a3521", 5.5],
  ["DAL", "Dallas", "Cowboys", "NFC East", "#1d3a63", 9.5],
  ["DEN", "Denver", "Broncos", "AFC West", "#FB4F14", 9.5],
  ["DET", "Detroit", "Lions", "NFC North", "#0076B6", 10.5],
  ["GB", "Green Bay", "Packers", "NFC North", "#203731", 9.5],
  ["HOU", "Houston", "Texans", "AFC South", "#1b3a4d", 9.5],
  ["IND", "Indianapolis", "Colts", "AFC South", "#1b4a80", 7.5],
  ["JAX", "Jacksonville", "Jaguars", "AFC South", "#006778", 8.5],
  ["KC", "Kansas City", "Chiefs", "AFC West", "#E31837", 10.5],
  ["LV", "Las Vegas", "Raiders", "AFC West", "#6b7378", 5.5],
  ["LAC", "L.A. Chargers", "Chargers", "AFC West", "#0080C6", 9.5],
  ["LAR", "L.A. Rams", "Rams", "NFC West", "#1e4a94", 11.5],
  ["MIA", "Miami", "Dolphins", "AFC East", "#008E97", 4.5],
  ["MIN", "Minnesota", "Vikings", "NFC North", "#4F2683", 8.5],
  ["NE", "New England", "Patriots", "AFC East", "#1c3d63", 10.5],
  ["NO", "New Orleans", "Saints", "NFC South", "#a58f63", 7.5],
  ["NYG", "New York Giants", "Giants", "NFC East", "#1b3573", 7.5],
  ["NYJ", "New York Jets", "Jets", "AFC East", "#125740", 5.5],
  ["PHI", "Philadelphia", "Eagles", "NFC East", "#005e69", 10.5],
  ["PIT", "Pittsburgh", "Steelers", "AFC North", "#a8791c", 8.5],
  ["SF", "San Francisco", "49ers", "NFC West", "#AA0000", 9.5],
  ["SEA", "Seattle", "Seahawks", "NFC West", "#2c5580", 10.5],
  ["TB", "Tampa Bay", "Buccaneers", "NFC South", "#D50A0A", 8.5],
  ["TEN", "Tennessee", "Titans", "AFC South", "#4B92DB", 6.5],
  ["WSH", "Washington", "Commanders", "NFC East", "#7a2020", 7.5],
];

export const TEAMS: Team[] = RAW.map(([ab, city, name, div, color, ou]) => ({
  ab,
  city,
  name,
  full: city.endsWith(name) ? city : `${city} ${name}`,
  div,
  color,
  ou,
  logo: logoUrl(ab),
}));

export const TEAM: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.ab, t]));
