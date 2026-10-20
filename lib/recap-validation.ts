// A deterministic check on the LLM's recap for the one class of error it keeps making on its own:
// calling a team undefeated or winless when that team's own record says otherwise.
//
// Prompt wording alone didn't hold it. Across consecutive runs on identical data the model wrote
// "his undefeated Chiefs and Texans both came through" -- true of the first team, false of the
// second -- then got it right on the next run, which is what a stochastic failure looks like.
// Giving the prompt each team's record supplies the contradicting fact; this notices when the
// recap contradicts it anyway, so the caller can ask for another draft.
//
// Deliberately narrow: only streak adjectives attached to a named team. A score ("an 18-16
// upset") is indistinguishable from a record to a regex, so bare numbers are never checked.
import "server-only";
import { TEAM, type TeamRecord } from "./teams";

export type RecapIssue = { team: string; claimed: string; actual: string };

const STREAK = /\b(undefeated|unbeaten|perfect|winless)\b/gi;

// Words that may sit between a team and the adjective describing it without breaking the link:
// copulas, "still/now", and the conjunction markers of a shared claim ("both", "all"). Anything
// else -- a different verb, a new subject -- means the adjective has moved on to another idea.
const LINKING = /^[\s"'’—–\-.]*(?:(?:both|all|are|is|was|were|stay|stays|staying|stayed|remain|remains|remained|sit|sits|sitting|still|now|yet|so|far|at|and|the|a|an|been|be|look|looks|looking)[\s"'’—–\-.]*)*$/i;
// Between two conjoined team names in one shared claim ("Chiefs and Texans"), only a conjunction.
const CONJUNCTION = /^[\s"'’—–\-.]*(?:and|&|,|plus|with)[\s"'’—–\-.]*(?:the|his|her|their)?[\s"'’—–\-.]*$/i;

const SENTENCE_END = /[.!?]/;

type Mention = { start: number; end: number; ab: string };

/** Every team name occurrence in the text, longest label first so "San Francisco 49ers" wins over
 * "49ers" at the same position. */
function mentions(text: string): Mention[] {
  const labels: { label: string; ab: string }[] = [];
  for (const ab of Object.keys(TEAM)) {
    const t = TEAM[ab];
    for (const label of [t.full, t.name]) if (label) labels.push({ label, ab });
  }
  labels.sort((a, b) => b.label.length - a.label.length);

  const found: Mention[] = [];
  for (const { label, ab } of labels) {
    const re = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (found.some((f) => start < f.end && end > f.start)) continue; // already covered by a longer label
      found.push({ start, end, ab });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Which teams a streak adjective actually describes.
 *
 * The adjective binds to the team names adjacent to it, extending across conjunctions so a claim
 * shared by two teams is caught ("Chiefs and Texans -- both undefeated", "undefeated Chiefs and
 * Texans"), but stopping at any other verb so a sentence that moves on to a second team's
 * unrelated news is not ("Chiefs remain undefeated and the Texans upset Jacksonville"). Looks
 * behind the adjective first, since that is the commoner English order, and ahead only if nothing
 * is linked behind it. */
function scopeOf(text: string, adjStart: number, adjEnd: number, all: Mention[]): string[] {
  const sentenceStart = (() => {
    for (let i = adjStart - 1; i >= 0; i--) if (SENTENCE_END.test(text[i])) return i + 1;
    return 0;
  })();
  const sentenceEnd = (() => {
    for (let i = adjEnd; i < text.length; i++) if (SENTENCE_END.test(text[i])) return i;
    return text.length;
  })();
  const inSentence = all.filter((m) => m.start >= sentenceStart && m.end <= sentenceEnd);

  const before = [...inSentence].filter((m) => m.end <= adjStart).reverse();
  if (before.length > 0 && LINKING.test(text.slice(before[0].end, adjStart))) {
    const scope = [before[0]];
    for (let i = 1; i < before.length; i++) {
      if (!CONJUNCTION.test(text.slice(before[i].end, before[i - 1].start))) break;
      scope.push(before[i]);
    }
    return scope.map((m) => m.ab);
  }

  const after = inSentence.filter((m) => m.start >= adjEnd);
  if (after.length > 0 && LINKING.test(text.slice(adjEnd, after[0].start))) {
    const scope = [after[0]];
    for (let i = 1; i < after.length; i++) {
      if (!CONJUNCTION.test(text.slice(after[i - 1].end, after[i].start))) break;
      scope.push(after[i]);
    }
    return scope.map((m) => m.ab);
  }

  return [];
}

function recordString(r: TeamRecord): string {
  return r.ties > 0 ? `${r.wins}-${r.losses}-${r.ties}` : `${r.wins}-${r.losses}`;
}

/** Every team the recap describes as undefeated/winless whose record disagrees. Empty means the
 * recap made no streak claim this check can fault. */
export function findRecordMisattributions(recap: string, standings: Record<string, TeamRecord>): RecapIssue[] {
  const all = mentions(recap);
  const issues: RecapIssue[] = [];
  STREAK.lastIndex = 0;
  for (let m = STREAK.exec(recap); m; m = STREAK.exec(recap)) {
    const claimed = m[1].toLowerCase();
    const undefeated = claimed !== "winless";
    for (const ab of scopeOf(recap, m.index, m.index + m[0].length, all)) {
      const rec = standings[ab];
      if (!rec) continue;
      const wrong = undefeated ? rec.losses > 0 : rec.wins > 0;
      if (wrong) issues.push({ team: TEAM[ab]?.full ?? ab, claimed, actual: recordString(rec) });
    }
  }
  return issues;
}
