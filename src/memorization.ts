export const MEMORIZATION_DAYS = [1, 3, 7, 14, 30, 60] as const;
export type Memorization = {
  addedOn: string;
  learnedOn?: string;
  reviews: string[];
};

// Local calendar dates keep the plan stable across midnight and daylight saving.
export function calendarDay(now = new Date()): string {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Takvim tarihi geçersiz.");
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function isCalendarDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
  );
}
export function addDays(day: string, days: number): string {
  if (!isCalendarDay(day) || !Number.isInteger(days))
    throw new Error("Takvim tarihi geçersiz.");
  // A stored day is a calendar label, not an instant in the current time zone.
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  if (!isCalendarDay(result)) throw new Error("Takvim tarihi geçersiz.");
  return result;
}
export function nextMemorizationDate(plan: Memorization): string | null {
  if (!plan.learnedOn || plan.reviews.length === MEMORIZATION_DAYS.length)
    return null;
  return addDays(plan.learnedOn, MEMORIZATION_DAYS[plan.reviews.length]);
}
export function memorizationDue(
  plan: Memorization,
  today = calendarDay(),
): boolean {
  const due = nextMemorizationDate(plan);
  const lastReview = plan.reviews.at(-1);
  return (
    isCalendarDay(today) &&
    !!due &&
    due <= today &&
    (!lastReview || lastReview < today)
  );
}
export function learnMemorization(
  plan: Memorization,
  today = calendarDay(),
): Memorization {
  return plan.learnedOn || !isCalendarDay(today) || today < plan.addedOn
    ? plan
    : { ...plan, learnedOn: today };
}
export function completeMemorization(
  plan: Memorization,
  today = calendarDay(),
): Memorization {
  return memorizationDue(plan, today)
    ? { ...plan, reviews: [...plan.reviews, today] }
    : plan;
}
export function validateMemorization(value: unknown): Memorization {
  const plan = value as Memorization;
  const validDay = isCalendarDay;
  if (
    !plan ||
    typeof plan !== "object" ||
    !validDay(plan.addedOn) ||
    (plan.learnedOn !== undefined &&
      (!validDay(plan.learnedOn) || plan.learnedOn < plan.addedOn)) ||
    !Array.isArray(plan.reviews) ||
    plan.reviews.length > MEMORIZATION_DAYS.length ||
    (plan.reviews.length > 0 && !plan.learnedOn) ||
    plan.reviews.some(
      (day, i) =>
        !validDay(day) ||
        day < addDays(plan.learnedOn!, MEMORIZATION_DAYS[i]) ||
        (i > 0 && day <= plan.reviews[i - 1]),
    )
  ) {
    throw new Error("Yedekte ezber bilgisi geçersiz.");
  }
  return {
    addedOn: plan.addedOn,
    ...(plan.learnedOn ? { learnedOn: plan.learnedOn } : {}),
    reviews: [...plan.reviews],
  };
}
