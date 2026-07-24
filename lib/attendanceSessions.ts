import { prisma } from "@/lib/prisma";
import { getUpcomingAttendanceSessionDates, weekdayFromDate, weekdayLabel, type WeekdayValue } from "@/lib/attendance";

function formatAttendanceDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function ensureCourseAttendanceSessions({
  courseId,
  courseTitle,
  attendanceDays,
  createdById,
  weeksAhead = 12,
}: {
  courseId: string;
  courseTitle: string;
  attendanceDays: WeekdayValue[];
  createdById: string;
  weeksAhead?: number;
}) {
  if (!attendanceDays.length) {
    return;
  }

  const upcomingDates = getUpcomingAttendanceSessionDates(attendanceDays, weeksAhead);

  if (!upcomingDates.length) {
    return;
  }

  const existingSessions = await prisma.attendanceSession.findMany({
    where: {
      courseId,
      sessionDate: {
        gte: upcomingDates[0],
      },
    },
    select: { sessionDate: true },
  });

  const existingKeys = new Set(existingSessions.map((session) => formatAttendanceDateKey(session.sessionDate)));
  const sessionsToCreate = upcomingDates
    .filter((sessionDate) => !existingKeys.has(formatAttendanceDateKey(sessionDate)))
    .map((sessionDate) => ({
      courseId,
      createdById,
      title: courseTitle + " - " + weekdayLabel(weekdayFromDate(sessionDate) ?? ""),
      sessionDate,
      startsAt: null,
      endsAt: null,
    }));

  if (!sessionsToCreate.length) {
    return;
  }

  await prisma.attendanceSession.createMany({ data: sessionsToCreate });
}
