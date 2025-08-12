import { intervals } from "./intervalsUtils.js";
import { utils } from "./utils.js";

// Settings
const appSettings = {
  useStaticTimezones: true, // Set to true to use static timezones from a local file
  shiftReminderTime: 1 // Minimum time in minutes before shift start/end to notify - default is 10 minutes
};

let client = null;
let currentUser = null;
let currentUserAssignedSchedule = null;
let zendeskTimezones = [];

// ------------------------
// Shift Notifications Logic
// ------------------------

const withMockedData = true; // Set to true to use mocked data for testing
const mockedTimezones = { // Hardcoded real timezones for testing
  "Brasilia": {
    "name": "Brasilia",
    "iana_name": "America/Sao_Paulo"
  },
  "UTC": {
    "name": "UTC",
    "iana_name": "Etc/UTC"
  },
  "PST": {
    "name": "Pacific Time (US & Canada)",
    "iana_name": "America/Los_Angeles"
  },
  "Paris": {
    "name": "Paris",
    "iana_name": "Europe/Paris",
  },
  "Beijing": {
    "name": "Beijing",
    "iana_name": "Asia/Shanghai",
  }
}
const mockedDataTypes = {
  user: 'user',
  schedule_default: 'schedule_9to5',
  schedule_online: 'schedule_online',
  schedule_default_alternated: 'schedule_9to5_alternated',
  schedule_status_test: 'schedule_status_test' // For testing shift status changes
};
// Mocked data configuration
const mockedSchedule = mockedDataTypes.schedule_default; // Ajust to use specific schedule mock data
const mockedUserTimezone = mockedTimezones.UTC; // Default timezone for mocked user
const mockedScheduleTimezone = mockedTimezones.UTC; // Default timezone for mocked schedule

const returnMockData = async (dataRequested) => {
  try {
    console.log(`Loading mock data for: ${dataRequested}`);
    const filePath = `./mocks/${dataRequested}.json`;
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`Failed to load mock data from ${filePath}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    switch (dataRequested) {
      case mockedDataTypes.user:
        const user = data.user || [];
        if (mockedUserTimezone) {
          user.iana_time_zone = mockedUserTimezone.iana_name;
        }
        return user;
      case mockedDataTypes.schedule_default:
      case mockedDataTypes.schedule_online:
      case mockedDataTypes.schedule_default_alternated:
      case mockedDataTypes.schedule_status_test:
        const schedule = data.schedule;
        if (mockedScheduleTimezone) {
          schedule.time_zone = mockedScheduleTimezone.name;
        }
        return schedule;
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error loading mock data for ${dataRequested}:`, error);
    displayAlertOnError(`Error loading mock data for ${dataRequested}`, error);
    return [];
  }
}

// API
const getCurrentUser = async () => {

  if (withMockedData) {
    return await returnMockData(mockedDataTypes.user);
  }

  try {
    const result = await client.request({ url: `/api/v2/users/me.json` });
    console.log('Current user:', result);
    return result.user || null;
  } catch (error) {
    displayAlertOnError('Error fetching current user', error);
    return null;
  }
}

/*
* Example of schedule object:
* {
*  "start_time": 3840,
*  "end_time": 4320
* }
* The start_time and end_time are in minutes since the last Sunday at midnight.
* To calculate the start and end times, use the equation: ((hours since Sunday at midnight)*60) + (minutes of incomplete hour).
*/
const getSchedule = async (id) => {

  if (withMockedData) {
    return await returnMockData(mockedSchedule);
  }

  try {
    const result = await client.request({ url: `/api/v2/business_hours/schedules/${id}` });
    return result.schedule || null;
  } catch (error) {
    displayAlertOnError('Error fetching schedule', error);
    return null;
  }
}

const getAssignedScheduleFromUser = (user) => {
  return user.user_fields.assigned_schedule || null;
}

// Get timezones from Zendesk API or local file depending on the settings
const getTimezones = async () => {
  if (withMockedData || appSettings.useStaticTimezones) {
    return await getTimezonesFile();
  }
  return await getZendeskTimezones();
}

const getZendeskTimezones = async () => {
  try {
    const result = await client.request({ url: `/api/v2/time_zones.json` });
    return result.time_zones || null;
  } catch (error) {
    console.error(`Error loading timezones:`, error);
    displayAlertOnError(`Error loading timezones`, error);
    return [];
  }
}

/* 
** Instead of calling `/api/v2/time_zones.json` to get the list of timezones,
** we can use a local JSON file that contains the timezone data.
** This is useful for testing purposes and to avoid unnecessary API calls as the timezone data is relatively static.
** The file has been simplified to directly return the timezones without additional properties nor URLs.
*/
const getTimezonesFile = async () => {
  try {
    const response = await fetch(`./data/time_zones.json`);
    if (!response.ok) {
      throw new Error(`Failed to load mock data from ${filePath}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error loading timezone file:`, error);
    displayAlertOnError(`Error loading timezone file`, error);
    return null;
  }
}
const getTimezoneByName = (name) => {

  const timezone = zendeskTimezones.find(tz => tz.name === name);
  if (timezone) {
    return {
      name: timezone.name,
      offset: timezone.offset,
      iana_name: timezone.iana_name
    };
  } else {
    displayAlertOnError(`Timezone not found: ${name}`);
    return null;
  }
}

const addTimezoneInfoToAssignedSchedule = () => {
  console.log('Adding timezone info to assigned schedule:', currentUserAssignedSchedule);
  const timezone = getTimezoneByName(currentUserAssignedSchedule.time_zone);
  console.log('Adding timezone info to assigned schedule:', {
    ...currentUserAssignedSchedule,
    offset: timezone ? timezone.offset : 0,
    iana_timezone: timezone ? timezone.iana_name : null
  });
  return {
    ...currentUserAssignedSchedule,
    offset: timezone ? timezone.offset : 0,
    iana_timezone: timezone ? timezone.iana_name : null
  };
}

const getCurrentUserAndScheduleTotalOffset = () => {
  const userOffset = getTimezoneByName(currentUser.time_zone)?.offset || 0;
  const intervalOffset = currentUserAssignedSchedule.offset || 0;
  const totalOffset = userOffset - intervalOffset;
  return totalOffset;
}

// ------------------------
// Shift Notifications Logic
// ------------------------

// We purposely use the term "shift" instead of "interval" to avoid confusion with the intervals used in the schedule.
// x min left till start/end notifications - set in appSettings.shiftReminderTime
// Starting is start_time - time >= x // x min left till start
// Started is start_time - time <= 0 && end_time - time >= 0
// Ending is end_time - time <= 0 && start_time - time >= x // x min left till end
// Ended is end_time - time <= 0

const shiftStatus = {
  STARTING: "Starting",
  STARTED: "Started",
  ONGOING: "Ongoing",
  ENDING: "Ending",
  ENDED: "Ended",
  NOT_ON_SHIFT: "Not on shift"
};

let notificationInterval = null;
let currentShiftStatus = null;
let currentShift = null;
let currentTime = null;

const ONE_MINUTE = 1000 * 60; // 1 minute in milliseconds
const shiftStatusInterval = ONE_MINUTE; // Default to 1min

/**
 * Checks the status of the current shift based on the current time.
 * @param {number} currentTime - The current time in minutes since last Sunday at midnight.
 * @param {Object} currentShift - The current shift object - null if no shift is found.
 * @param {Object} nextShift - The next shift object - null if current shift is ongoing.
 * @returns {string} - The status of the current shift.
 */
const checkShiftStatus = (currentTime, currentShift, nextShift) => {

  // In shift, inclusive start <= now <= end
  if (currentShift) {

    const startTime = currentShift.start_time;
    const endTime = currentShift.end_time;

    if (endTime - currentTime == 0) {
      return shiftStatus.ENDED;
    }
    if (startTime - currentTime == 0) {
      return shiftStatus.STARTED;
    }
    if (endTime - currentTime <= appSettings.shiftReminderTime) {
      return shiftStatus.ENDING;
    }
    if (startTime - currentTime < 0 && endTime - currentTime > 0) {
      return shiftStatus.ONGOING;
    }

  } else if (nextShift) { // If no current shift, check next shift 
    const startTime = nextShift.start_time;

    if (startTime - currentTime <= appSettings.shiftReminderTime) {
      return shiftStatus.STARTING;
    }
  }

  return shiftStatus.NOT_ON_SHIFT;
}

const startShiftNotifications = (schedule) => {

  // Initialize
  var shift = null
  var nextShift = null;

  currentTime = utils.getMinutesSinceLastSundayUTC(); // get current time
  currentShift = utils.findCurrentShift(schedule, currentTime); // Am I in a shift (inclusive start <= now <= end) - Undefined if no shift is found
  if (!currentShift) {
    nextShift = utils.findClosestNextShift(schedule, currentTime);
  }
  shift = checkShiftStatus(currentTime, currentShift, nextShift);
  notifyShiftStatus(schedule.name, shift, currentTime, currentShift, nextShift);
  currentShiftStatus = shift;

  notificationInterval = setInterval(() => {

    if (currentTime === null) {
      currentTime = utils.getMinutesSinceLastSundayUTC(); // Update current time
    } else {
      currentTime += (shiftStatusInterval / ONE_MINUTE); // Increment current time by the interval in minutes
    }
    currentShift = utils.findCurrentShift(schedule, currentTime); // Check if I am in a shift
    if (!currentShift) {
      nextShift = utils.findClosestNextShift(schedule, currentTime);
    }
    shift = checkShiftStatus(currentTime, currentShift, nextShift);

    if (shift !== currentShiftStatus || shift === shiftStatus.STARTING || shift === shiftStatus.ENDING) {
      notifyShiftStatus(schedule.name, shift, currentTime, currentShift, nextShift);
      currentShiftStatus = shift;
    }

  }, shiftStatusInterval); // Check x minutes

};

// TO test
const notifyShiftStatus = (
  scheduleName,
  newShiftStatus,
  currentTime,
  currentShift,
  nextShift
) => {

  console.log(`Notifying shift status: `,
  scheduleName,
  newShiftStatus,
  currentTime,
  currentShift,
  nextShift,
  );

  switch (newShiftStatus) {
    case shiftStatus.STARTING:
      console.log(`Shift for ${scheduleName} starting in ${nextShift.start_time - currentTime} minutes`);
      displayZendeskNotification(`Shift for ${scheduleName} starting in ${nextShift.start_time - currentTime} minutes`);
      break;
    case shiftStatus.STARTED:
      displayZendeskNotification(`Your shift for ${scheduleName} has started.`);
      break;
    case shiftStatus.ONGOING:
      displayZendeskNotification(`You are currently on shift for ${scheduleName}.`);
      break;
    case shiftStatus.ENDING:
      console.log(`Shift for ${scheduleName} ending in ${currentShift.end_time - currentTime} minutes`);
      displayZendeskNotification(`Shift for ${scheduleName} ending in ${currentShift.end_time - currentTime} minutes`);
      break;
    case shiftStatus.ENDED:
      displayZendeskNotification(`Your shift for ${scheduleName} has ended.`);
      break;
    case shiftStatus.NOT_ON_SHIFT:
      displayZendeskNotification(`You're not on shift right now.`);
      break;
    default:
      console.warn('Unknown shift status:', newShiftStatus);
  }
}

// ------------------------
// UI
// ------------------------

// Render the schedules list using Handlebars
const renderSchedule = (schedule) => {

  // Adjust for the offset between the user's timezone and the schedule's timezone
  const totalOffset = getCurrentUserAndScheduleTotalOffset();

  const adjustedSchedule = {
    ...schedule,
    intervals: schedule.intervals.map(interval => {
      return intervals.convertIntervalToOffset(interval, totalOffset);
    })
  };

  console.log('Rendering schedules list:', adjustedSchedule);

  const weeklyIntervals = intervals.organizeIntervalsByWeekday(adjustedSchedule.intervals);

  const scheduleData = {
    withMockedData: withMockedData,
    schedule: {
      ...adjustedSchedule,
      weeklyIntervals: weeklyIntervals
    },
    userTimezone: utils.getUserIanaTimezone(currentUser)
  };

  console.log('Formatted schedule data:', scheduleData);

  const source = document.getElementById("schedules-template").innerHTML;
  const template = Handlebars.compile(source);

  const html = template(scheduleData);

  document.getElementById("content").innerHTML = html;
}

export const refreshSchedule = async () => {
  try {
    currentUser = await getCurrentUser();
    const scheduleId = getAssignedScheduleFromUser(currentUser);

    if (!scheduleId) {
      console.warn('No schedules assigned to the current user.');
      return;
    }

    currentUserAssignedSchedule = await getSchedule(scheduleId);
    currentUserAssignedSchedule = addTimezoneInfoToAssignedSchedule();

    console.log('Schedules to render:', currentUserAssignedSchedule);
    if (currentUserAssignedSchedule) {
      startShiftNotifications(currentUserAssignedSchedule);
      renderSchedule(currentUserAssignedSchedule);
    }
  } catch (error) {
    displayAlertOnError('Error refreshing schedules', error);
  }
};

const displayAlertOnError = (errorMessage, error) => {
  console.error(errorMessage, error);
  const alertMessage = `An error occurred: ${errorMessage}`;
  client.invoke('notify', alertMessage, 'error');
}
const displayZendeskNotification = (message) => {
  client.invoke('notify', message, 'notice');
}

// ------------------------
// App Logic
// ------------------------

const getAppSettings = async () => {
  const result = await client.metadata();
  console.log('App settings:', result);
  var settings = result.settings || {};
  appSettings.useStaticTimezones = settings.useStaticTimezones || appSettings.useStaticTimezones;
  appSettings.shiftReminderTime = settings.shiftReminderTime || appSettings.shiftReminderTime;
  return settings;
}

(async () => {
  client = ZAFClient.init();
  client.invoke('resize', { width: '100%', height: '500px' });

  client.on('app.registered', async () => {
    await getAppSettings();
    zendeskTimezones = await getTimezones();
    refreshSchedule();
  });

  client.on('app.unregistered', () => {
    // Add other event listeners that could cause refresh
    console.log('App unregistered');
    if (notificationInterval) {
      clearInterval(notificationInterval);
      notificationInterval = null;
    }
  });

})();