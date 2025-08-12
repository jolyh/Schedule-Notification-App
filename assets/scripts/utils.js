const getUserIanaTimezone = (user) => user.iana_time_zone;

const getMinutesSinceLastSundayUTC = () => {
  const now = new Date();
  const lastSunday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay());
  const minutesSinceLastSunday = Math.floor((now - lastSunday) / (1000 * 60));
  return minutesSinceLastSunday;
};

const findCurrentShift = (schedule, currentTime) => {
  const currentShift = schedule.intervals.find(shift => shift.start_time <= currentTime && currentTime <= shift.end_time);
  return currentShift;
};

const findClosestNextShift = (schedule, currentTime) => {
  const nextShift = schedule.intervals.find(shift =>  currentTime <= shift.start_time);
  return nextShift;
};

export const utils = {
  getUserIanaTimezone,
  getMinutesSinceLastSundayUTC,
  findCurrentShift,
  findClosestNextShift
};