export let currentSchedule = [];
export let currentHolidayRanges = [];
export let currentHomeContent = {};
export let salonClosingTime = '22:00';

export function setSchedule(data) { currentSchedule = data; }
export function setHolidayRanges(data) { currentHolidayRanges = data; }
export function setHomeContent(data) { currentHomeContent = data; }
export function setSalonClosingTime(time) { salonClosingTime = time; }
