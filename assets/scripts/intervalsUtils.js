/*
* The start_time and end_time are in minutes since the last Sunday at midnight.
* Example of an interval:
* {
*  "start_time": 3840, // 64 hours since last Sunday at midnight
*  "end_time": 4320 // 72 hours since last Sunday at midnight
* }
* Each schedule contains a timezone, which means each minute is relative to the last Sunday at midnight in that timezone.
* To calculate the start and end times, use the equation: ((hours since Sunday at midnight)*60) + (minutes of incomplete hour).
*/
const convertIntervalToOffset = (interval, offset) => { 
  //console.log('Converting interval to offset:', interval);
  if (offset > 0) {
    return {
      start_time: interval.start_time + offset,
      end_time: interval.end_time + offset
    };
  } else if (offset < 0) {
    return {
      start_time: interval.start_time - Math.abs(offset),
      end_time: interval.end_time - Math.abs(offset)
    };
  }
  // If offset is 0, return the interval as is
  return {
    start_time: interval.start_time,
    end_time: interval.end_time
  };
}

const intervalToReadableTime = (interval) => {
  // Convert minutes since Sunday midnight to day and time
  const totalMinutes = interval.start_time;
  const endTotalMinutes = interval.end_time;

  // Calculate day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = Math.floor(totalMinutes / (24 * 60));
  const endDayOfWeek = Math.floor(endTotalMinutes / (24 * 60));

  // Calculate hours and minutes within the day
  const minutesInDay = totalMinutes % (24 * 60);
  const endMinutesInDay = endTotalMinutes % (24 * 60);

  const startHours = Math.floor(minutesInDay / 60);
  const startMinutes = minutesInDay % 60;
  const endHours = Math.floor(endMinutesInDay / 60);
  const endMinutesRemainder = endMinutesInDay % 60;

  // Format time as HH:MM:SS
  const formatTime = (hours, minutes) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  };

  return {
    dayOfWeek: dayOfWeek,
    endDayOfWeek: endDayOfWeek,
    start_time: formatTime(startHours, startMinutes),
    end_time: formatTime(endHours, endMinutesRemainder)
  };
}

/**
 * Organizes a list of time intervals by the day of the week.
 * We have a specific behaviour for the intervals that ends at midnight (00:00:00).
 * If an interval ends at midnight, it is normally considered to end at the start of the next day
 * as the minutes are inclusive (intervals as defined do not add 1 minute to the next), 
 * so it should normally be rendered as 00:00:00 - 00:00:00 on the next day - this is normally handled
 * to appear on the same day 00:00:00 - 23:59:59.
 * @param {*} intervals
 * @returns [ { day: 'Monday', intervals: [...] }, ... ]
 */
const organizeIntervalsByWeekday = (intervals) => {
  const weeklyIntervals = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: []
  };

  const firstTimeOfDay = '00:00:00';
  const lastTimeOfDay = '23:59:59';

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  intervals.forEach(interval => {

    const processedInterval = intervalToReadableTime(interval);
    // Handle intervals that might span multiple days
    if (processedInterval.dayOfWeek === processedInterval.endDayOfWeek
      || processedInterval.end_time === firstTimeOfDay
    ) {
      // Same day interval
      const dayName = dayNames[processedInterval.dayOfWeek];
      weeklyIntervals[dayName].push({
        start_time: processedInterval.start_time,
        end_time: (processedInterval.end_time === firstTimeOfDay) ? lastTimeOfDay : processedInterval.end_time
      });
    } else {
      // Multi-day interval (rare, but handle gracefully)
      const startDayName = dayNames[processedInterval.dayOfWeek];
      weeklyIntervals[startDayName].push({
        start_time: processedInterval.start_time,
        end_time: lastTimeOfDay
      });
      // If the startDay is not the last day of the week we can add the end time to the next day
      if (startDayName !== dayNames[6]) {
        const endDayName = dayNames[processedInterval.endDayOfWeek];
        weeklyIntervals[endDayName].push({
          start_time: firstTimeOfDay,
          end_time: processedInterval.end_time
        });
      } else {
        // If it ends on the last day of the week, we can just add the end time to the first day of the week
        weeklyIntervals[dayNames[0]].push({
          start_time: firstTimeOfDay,
          end_time: processedInterval.end_time
        });
      }
    }
  });

  return [
    {
      day: 'Monday',
      intervals: weeklyIntervals.monday
    },
    {
      day: 'Tuesday',
      intervals: weeklyIntervals.tuesday
    },
    {
      day: 'Wednesday',
      intervals: weeklyIntervals.wednesday
    },
    {
      day: 'Thursday',
      intervals: weeklyIntervals.thursday
    },
    {
      day: 'Friday',
      intervals: weeklyIntervals.friday
    },
    {
      day: 'Saturday',
      intervals: weeklyIntervals.saturday
    },
    {
      day: 'Sunday',
      intervals: weeklyIntervals.sunday
    },
  ]
}

export const intervals = {
  convertIntervalToOffset,
  intervalToReadableTime,
  organizeIntervalsByWeekday
};