/**
 * Attendance Shift & Status Computation Utilities
 */

export function computeShiftStatus(
  clockInTime: string | null | undefined,
  shift: any
): 'present' | 'late' | 'half_day' | 'absent' {
  if (!clockInTime) return 'absent';
  const d = new Date(clockInTime);
  const clockInMins = d.getHours() * 60 + d.getMinutes();

  // If no shift is provided, default to standard office timings: 09:00 AM start, 15m grace (09:15), late up to 10:30, half day up to 14:00
  const effectiveShift = shift || {
    start_time: '09:00',
    grace_minutes: 15,
    late_end: '10:30',
    half_day_end: '14:00',
  };

  const toMins = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };

  const startTimeMins = toMins(effectiveShift.start_time || '09:00');
  const graceMins = effectiveShift.grace_minutes ?? 15;
  const graceEnd = startTimeMins + graceMins;
  const lateEnd = toMins(effectiveShift.late_end || '10:30');
  const halfEnd = toMins(effectiveShift.half_day_end || '14:00');

  if (clockInMins <= graceEnd) return 'present';
  if (clockInMins <= lateEnd) return 'late';
  if (clockInMins <= halfEnd) return 'half_day';
  return 'half_day'; // Clocks in past half-day threshold
}

export function getEffectiveAttendanceStatus(
  record: any,
  shift: any
): 'present' | 'late' | 'half_day' | 'absent' | 'holiday' | 'approved_leave' | 'paid_leave' {
  if (!record) return 'absent';
  if (record.status === 'holiday' || record.status === 'approved_leave' || record.status === 'paid_leave') {
    return record.status;
  }
  if (record.status === 'half_day' || record.status === 'half-day') return 'half_day';
  if (record.status === 'late') return 'late';
  
  if (record.clock_in_time) {
    return computeShiftStatus(record.clock_in_time, shift);
  }

  if (record.status === 'present') return 'present';
  return record.status || 'absent';
}
