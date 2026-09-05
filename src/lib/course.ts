export const COURSE_ROUND_OPTIONS = [3, 5, 7, 10];

export interface CourseData {
  rounds: number;
}

export function emptyCourse(): CourseData {
  return { rounds: 5 };
}

export function isCoursePlayable(data: CourseData): boolean {
  return !!data && data.rounds >= 1 && data.rounds <= 10;
}
