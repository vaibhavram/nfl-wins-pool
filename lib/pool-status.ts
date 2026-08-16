import { ordinal } from "./format";
import type { PoolCard } from "./dashboard-server";

/** Where tapping a pool card/row should take you -- one destination per status, shared by the
 * dashboard and the pool switcher so they never drift out of sync with each other. */
export function poolHref(slug: string, status: PoolCard["status"]): string {
  switch (status) {
    case "filling":
      return `/p/${slug}/invite`;
    case "ready":
      return `/p/${slug}/lobby`;
    case "drafting":
      return `/p/${slug}/draft`;
    case "in_season":
    case "final":
      return `/p/${slug}/standings`;
  }
}

/** The six status treatments a pool card can show. */
export function statusLabel(
  card: Pick<PoolCard, "status" | "memberCount" | "rank" | "isMyTurn" | "onClockName">,
): { label: string; color: string } {
  switch (card.status) {
    case "filling":
      return { label: `${card.memberCount}/10 joined`, color: "var(--color-neutral-400)" };
    case "ready":
      return { label: "Ready to draft", color: "var(--color-accent-300)" };
    case "drafting":
      return card.isMyTurn
        ? { label: "Your turn", color: "var(--color-accent-300)" }
        : { label: card.onClockName ? `Waiting on ${card.onClockName}` : "Drafting", color: "var(--color-neutral-400)" };
    case "in_season":
      return { label: card.rank ? `${ordinal(card.rank)} of 10 · In season` : "In season", color: "var(--color-accent-300)" };
    case "final":
      return { label: card.rank ? `${ordinal(card.rank)} of 10 · Complete` : "Complete", color: "var(--color-neutral-500)" };
  }
}
