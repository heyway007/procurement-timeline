export const BID_SUBMISSION_TIME_SLOTS = ["MORNING", "AFTERNOON"] as const;

export type BidSubmissionTimeSlot = (typeof BID_SUBMISSION_TIME_SLOTS)[number];

export const BID_SUBMISSION_TIME_LABELS: Record<BidSubmissionTimeSlot, string> = {
  MORNING: "9.00 น. - 12.00 น.",
  AFTERNOON: "13.00 น. - 16.30 น.",
};

export function isBidSubmissionMilestone(label: string): boolean {
  return label.includes("กำหนดวันเสนอราคา");
}

export function isPresentMilestone(label: string): boolean {
  return label.includes("Present");
}

export const NEGOTIATION_WINDOW_WORKING_DAYS = 3;

export function isSelectableNegotiationMilestone(step: {
  order: number;
  label: string;
}): boolean {
  // Selective/specific methods use step 9 for negotiation; e-bidding uses other orders.
  return step.order === 9 &&
    step.label.includes("พิจารณาคัดเลือกผู้ชนะ") &&
    step.label.includes("ต่อรองราคา");
}

export function isSingleDaySelectableMilestone(step: {
  order: number;
  label: string;
}): boolean {
  return isPresentMilestone(step.label) || isSelectableNegotiationMilestone(step);
}

export function effectiveBidSubmissionTimeSlot(
  value?: BidSubmissionTimeSlot,
): BidSubmissionTimeSlot {
  return value ?? "MORNING";
}

export function bidSubmissionTimeLabel(value?: BidSubmissionTimeSlot): string {
  return BID_SUBMISSION_TIME_LABELS[effectiveBidSubmissionTimeSlot(value)];
}
