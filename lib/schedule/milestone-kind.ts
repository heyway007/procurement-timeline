export const BID_SUBMISSION_TIME_SLOTS = ["MORNING", "AFTERNOON"] as const;

export type BidSubmissionTimeSlot = (typeof BID_SUBMISSION_TIME_SLOTS)[number];

export const BID_SUBMISSION_TIME_LABELS: Record<BidSubmissionTimeSlot, string> = {
  MORNING: "8.30 น. - 12.00 น.",
  AFTERNOON: "13.30 น. - 16.30 น.",
};

export function isBidSubmissionMilestone(label: string): boolean {
  return label.includes("กำหนดวันเสนอราคา");
}

export function isPresentMilestone(label: string): boolean {
  return label.includes("Present");
}

export function effectiveBidSubmissionTimeSlot(
  value?: BidSubmissionTimeSlot,
): BidSubmissionTimeSlot {
  return value ?? "MORNING";
}

export function bidSubmissionTimeLabel(value?: BidSubmissionTimeSlot): string {
  return BID_SUBMISSION_TIME_LABELS[effectiveBidSubmissionTimeSlot(value)];
}
