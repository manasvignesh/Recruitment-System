export const defaultStages = [
  "Applied",
  "Screening",
  "Assessment",
  "Interview",
  "Final Review",
  "Offer",
  "Hired",
];
export function stageAllowed(current: string, next: string, stages: string[]) {
  if (stages.indexOf(current) < 0) return false;
  return (
    next !== "Hired" &&
    stages.includes(next) &&
    Math.abs(stages.indexOf(current) - stages.indexOf(next)) === 1
  );
}
export const jobTransitions: Record<string, string[]> = {
  draft: ["pending"],
  pending: ["approved", "draft"],
  approved: ["published", "draft"],
  published: ["approved", "closed"],
  closed: ["approved", "archived"],
  archived: [],
};
export const offerTransitions: Record<string, string[]> = {
  draft: ["pending"],
  pending: ["approved", "draft"],
  approved: ["available"],
  available: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};
export function canTransition(
  map: Record<string, string[]>,
  from: string,
  to: string,
) {
  return map[from]?.includes(to) ?? false;
}
export function overlaps(
  startA: Date,
  durationA: number,
  startB: Date,
  durationB: number,
) {
  return (
    startA.getTime() < startB.getTime() + durationB * 60000 &&
    startB.getTime() < startA.getTime() + durationA * 60000
  );
}
