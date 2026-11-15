import {v4 as uuid} from "uuid";
import {postWithRetry} from "./post";
import {getRsiReviewKey} from "./rsiReviewKey";
import {
  isSiteLanguageHebrew,
  rsiReviewPrNumberPreference,
} from "./settings";
import {Button, snackbars} from "./snackbar";

export interface PendingOfflineRsiDecision {
  id: string;
  page: string;
  ref: string;
  decision: "approve" | "reject";
  reviewerIdentity: string;
  key?: string;
  knownPrNumber?: number;
  hebrew?: string;
  english?: string;
  fallbackHebrew?: string;
  fallbackEnglish?: string;
  reason?: string;
  timestamp: number;
}

export const OFFLINE_RSI_DECISIONS_STORAGE_KEY = "pendingOfflineRsiReviewDecisions";

const inFlightDecisionIdentifiers = new Set<string>();

export function markDecisionInFlight(decisionIdentifier: string): void {
  inFlightDecisionIdentifiers.add(decisionIdentifier);
}

export function unmarkDecisionInFlight(decisionIdentifier: string): void {
  inFlightDecisionIdentifiers.delete(decisionIdentifier);
}

export function isDecisionInFlight(decisionIdentifier: string): boolean {
  return inFlightDecisionIdentifiers.has(decisionIdentifier);
}

export function clearInFlightDecisionsForTesting(): void {
  inFlightDecisionIdentifiers.clear();
}

export function getPendingOfflineRsiDecisions(): PendingOfflineRsiDecision[] {
  try {
    const rawValue = localStorage.getItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    console.error("Failed to parse pending offline RSI decisions from localStorage:", error);
    return [];
  }
}

export function savePendingOfflineRsiDecision(
  decisionData: Omit<PendingOfflineRsiDecision, "id" | "timestamp"> &
    Partial<Pick<PendingOfflineRsiDecision, "id" | "timestamp">>,
): PendingOfflineRsiDecision {
  const pendingDecisions = getPendingOfflineRsiDecisions();
  const completeDecision: PendingOfflineRsiDecision = {
    ...decisionData,
    id: decisionData.id || uuid(),
    timestamp: decisionData.timestamp || Date.now(),
  };
  pendingDecisions.push(completeDecision);
  try {
    localStorage.setItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY, JSON.stringify(pendingDecisions));
  } catch (error) {
    console.error("Failed to save pending offline RSI decision to localStorage:", error);
  }
  return completeDecision;
}

export function removePendingOfflineRsiDecision(decisionIdentifier: string): void {
  const pendingDecisions = getPendingOfflineRsiDecisions();
  const remainingDecisions = pendingDecisions.filter(
    (pendingDecision) => pendingDecision.id !== decisionIdentifier,
  );
  try {
    if (remainingDecisions.length > 0) {
      localStorage.setItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY, JSON.stringify(remainingDecisions));
    } else {
      localStorage.removeItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Failed to remove pending offline RSI decision from localStorage:", error);
  }
}

export function clearPendingOfflineRsiDecisionsForTesting(): void {
  localStorage.removeItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY);
}

let isCurrentlyFlushingQueue = false;

export async function flushPendingOfflineRsiDecisions(): Promise<void> {
  if (isCurrentlyFlushingQueue) {
    return;
  }
  const pendingDecisions = getPendingOfflineRsiDecisions();
  if (pendingDecisions.length === 0) {
    return;
  }

  isCurrentlyFlushingQueue = true;
  try {
    for (const pendingDecision of pendingDecisions) {
      if (isDecisionInFlight(pendingDecision.id)) {
        continue;
      }

      markDecisionInFlight(pendingDecision.id);

      const latestKnownPrNumberString = rsiReviewPrNumberPreference.get();
      const knownPrNumber = latestKnownPrNumberString
        ? Number(latestKnownPrNumberString)
        : pendingDecision.knownPrNumber;
      const reviewKey = pendingDecision.key || getRsiReviewKey();

      if (!reviewKey) {
        console.warn("Skipping offline RSI decision retry due to missing review key:", pendingDecision);
        unmarkDecisionInFlight(pendingDecision.id);
        continue;
      }

      try {
        // Sequentially flush queued decisions so knownPrNumber chains into subsequent requests
        // eslint-disable-next-line no-await-in-loop
        const response = await postWithRetry("/api/rsi-review-decision", {
          page: pendingDecision.page,
          ref: pendingDecision.ref,
          decision: pendingDecision.decision,
          key: reviewKey,
          knownPrNumber,
          reviewerIdentity: pendingDecision.reviewerIdentity,
          hebrew: pendingDecision.hebrew,
          english: pendingDecision.english,
          fallbackHebrew: pendingDecision.fallbackHebrew,
          fallbackEnglish: pendingDecision.fallbackEnglish,
          reason: pendingDecision.reason,
        });

        removePendingOfflineRsiDecision(pendingDecision.id);
        unmarkDecisionInFlight(pendingDecision.id);

        if (response?.prNumber !== undefined) {
          rsiReviewPrNumberPreference.set(String(response.prNumber));
        }

        const decisionLabel = pendingDecision.decision === "approve" ? "Approved" : "Rejected";
        const pullRequestLink = response?.url
          ? ` — <a href="${response.url}" target="_blank">view PR</a>`
          : "";
        const dismissButton: Button = {
          text: isSiteLanguageHebrew() ? "סגור" : "Dismiss",
          onClick: () => {
            snackbars.reportedIssueSent.hide();
          },
        };
        snackbars.reportedIssueSent.show(
          `${decisionLabel} ${pendingDecision.ref}${pullRequestLink}`,
          [dismissButton],
        );
      } catch (error: any) {
        unmarkDecisionInFlight(pendingDecision.id);
        console.error("Failed to retry offline RSI review decision:", error);
        if (error?.status === 400 || error?.status === 403) {
          removePendingOfflineRsiDecision(pendingDecision.id);
        }
        break;
      }
    }
  } finally {
    isCurrentlyFlushingQueue = false;
  }
}

let hasRegisteredOnlineListener = false;

export function initializeOfflineRsiRetries(): void {
  if (typeof window === "undefined" || hasRegisteredOnlineListener) {
    return;
  }
  hasRegisteredOnlineListener = true;
  window.addEventListener("online", () => {
    flushPendingOfflineRsiDecisions();
  });
  if (navigator.onLine !== false) {
    flushPendingOfflineRsiDecisions();
  }
}

export function resetOfflineRsiRetriesForTesting(): void {
  hasRegisteredOnlineListener = false;
  clearInFlightDecisionsForTesting();
}
