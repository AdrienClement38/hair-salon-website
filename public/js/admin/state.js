export let currentSchedule = [];
export let currentHolidayRanges = []; // Legacy support or just mapped global ones?
export let currentLeaves = []; // New full structure
export let currentHomeContent = {};
export let salonClosingTime = '22:00';

export let currentProducts = [];

export function setSchedule(data) { currentSchedule = data; }
export function setHolidayRanges(data) { currentHolidayRanges = data; }
export function setLeaves(data) { currentLeaves = data; }
export function setHomeContent(data) { currentHomeContent = data; }
export function setSalonClosingTime(time) { salonClosingTime = time; }
export function setProducts(data) { currentProducts = data; }

export let currentSalonIdentity = { name: 'La Base Coiffure', logo: null };
export function setSalonIdentity(data) { currentSalonIdentity = data || { name: 'La Base Coiffure', logo: null }; }
