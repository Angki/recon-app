//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
//#endregion
let electron = require("electron");
let path = require("path");
path = __toESM(path);
let child_process = require("child_process");
let fs = require("fs");
fs = __toESM(fs);
let os = require("os");
os = __toESM(os);
//#region electron/services/logger.ts
var LoggerService, logger;
var init_logger = __esmMin((() => {
	LoggerService = class {
		constructor() {
			this.logDir = path.default.join(os.default.homedir(), "Documents", "SecOpsScans", "logs");
			this.logFile = path.default.join(this.logDir, "application.log");
			this.init();
		}
		init() {
			if (!fs.default.existsSync(this.logDir)) fs.default.mkdirSync(this.logDir, { recursive: true });
		}
		formatMessage(level, message) {
			return `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level.toUpperCase()}] ${message}\n`;
		}
		info(message) {
			const log = this.formatMessage("info", message);
			fs.default.appendFileSync(this.logFile, log);
			console.log(log.trim());
		}
		error(message, err) {
			const log = this.formatMessage("error", message + (err ? ` - ${err.message}` : ""));
			fs.default.appendFileSync(this.logFile, log);
			console.error(log.trim());
		}
		warn(message) {
			const log = this.formatMessage("warn", message);
			fs.default.appendFileSync(this.logFile, log);
			console.warn(log.trim());
		}
	};
	logger = new LoggerService();
})), daysInYear, maxTime, millisecondsInWeek, millisecondsInDay, secondsInHour, secondsInDay, secondsInYear, secondsInMonth, constructFromSymbol;
var init_constants = __esmMin((() => {
	daysInYear = 365.2425;
	maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
	-maxTime;
	millisecondsInWeek = 6048e5;
	millisecondsInDay = 864e5;
	secondsInHour = 3600;
	secondsInDay = secondsInHour * 24;
	secondsInDay * 7;
	secondsInYear = secondsInDay * daysInYear;
	secondsInMonth = secondsInYear / 12;
	secondsInMonth * 3;
	constructFromSymbol = Symbol.for("constructDateFrom");
}));
//#endregion
//#region node_modules/date-fns/constructFrom.js
/**
* @name constructFrom
* @category Generic Helpers
* @summary Constructs a date using the reference date and the value
*
* @description
* The function constructs a new date using the constructor from the reference
* date and the given value. It helps to build generic functions that accept
* date extensions.
*
* It defaults to `Date` if the passed reference date is a number or a string.
*
* Starting from v3.7.0, it allows to construct a date using `[Symbol.for("constructDateFrom")]`
* enabling to transfer extra properties from the reference date to the new date.
* It's useful for extensions like [`TZDate`](https://github.com/date-fns/tz)
* that accept a time zone as a constructor argument.
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
*
* @param date - The reference date to take constructor from
* @param value - The value to create the date
*
* @returns Date initialized using the given date and value
*
* @example
* import { constructFrom } from "./constructFrom/date-fns";
*
* // A function that clones a date preserving the original type
* function cloneDate<DateType extends Date>(date: DateType): DateType {
*   return constructFrom(
*     date, // Use constructor from the given date
*     date.getTime() // Use the date value to create a new date
*   );
* }
*/
function constructFrom(date, value) {
	if (typeof date === "function") return date(value);
	if (date && typeof date === "object" && constructFromSymbol in date) return date[constructFromSymbol](value);
	if (date instanceof Date) return new date.constructor(value);
	return new Date(value);
}
var init_constructFrom = __esmMin((() => {
	init_constants();
}));
//#endregion
//#region node_modules/date-fns/toDate.js
/**
* @name toDate
* @category Common Helpers
* @summary Convert the given argument to an instance of Date.
*
* @description
* Convert the given argument to an instance of Date.
*
* If the argument is an instance of Date, the function returns its clone.
*
* If the argument is a number, it is treated as a timestamp.
*
* If the argument is none of the above, the function returns Invalid Date.
*
* Starting from v3.7.0, it clones a date using `[Symbol.for("constructDateFrom")]`
* enabling to transfer extra properties from the reference date to the new date.
* It's useful for extensions like [`TZDate`](https://github.com/date-fns/tz)
* that accept a time zone as a constructor argument.
*
* **Note**: *all* Date arguments passed to any *date-fns* function is processed by `toDate`.
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type, it is the type returned from the context function if it is passed, or inferred from the arguments.
*
* @param argument - The value to convert
*
* @returns The parsed date in the local time zone
*
* @example
* // Clone the date:
* const result = toDate(new Date(2014, 1, 11, 11, 30, 30))
* //=> Tue Feb 11 2014 11:30:30
*
* @example
* // Convert the timestamp to date:
* const result = toDate(1392098430000)
* //=> Tue Feb 11 2014 11:30:30
*/
function toDate(argument, context) {
	return constructFrom(context || argument, argument);
}
var init_toDate = __esmMin((() => {
	init_constructFrom();
}));
//#endregion
//#region node_modules/date-fns/addDays.js
var init_addDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addMonths.js
var init_addMonths = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/add.js
var init_add = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSaturday.js
var init_isSaturday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSunday.js
var init_isSunday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isWeekend.js
var init_isWeekend = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addBusinessDays.js
var init_addBusinessDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addMilliseconds.js
var init_addMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addHours.js
var init_addHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/_lib/defaultOptions.js
function getDefaultOptions() {
	return defaultOptions;
}
var defaultOptions;
var init_defaultOptions = __esmMin((() => {
	defaultOptions = {};
}));
//#endregion
//#region node_modules/date-fns/startOfWeek.js
/**
* The {@link startOfWeek} function options.
*/
/**
* @name startOfWeek
* @category Week Helpers
* @summary Return the start of a week for the given date.
*
* @description
* Return the start of a week for the given date.
* The result will be in the local timezone.
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type, it is the type returned from the context function if it is passed, or inferred from the arguments.
*
* @param date - The original date
* @param options - An object with options
*
* @returns The start of a week
*
* @example
* // The start of a week for 2 September 2014 11:55:00:
* const result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0))
* //=> Sun Aug 31 2014 00:00:00
*
* @example
* // If the week starts on Monday, the start of the week for 2 September 2014 11:55:00:
* const result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0), { weekStartsOn: 1 })
* //=> Mon Sep 01 2014 00:00:00
*/
function startOfWeek(date, options) {
	const defaultOptions = getDefaultOptions();
	const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions.weekStartsOn ?? defaultOptions.locale?.options?.weekStartsOn ?? 0;
	const _date = toDate(date, options?.in);
	const day = _date.getDay();
	const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
	_date.setDate(_date.getDate() - diff);
	_date.setHours(0, 0, 0, 0);
	return _date;
}
var init_startOfWeek = __esmMin((() => {
	init_defaultOptions();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/startOfISOWeek.js
/**
* The {@link startOfISOWeek} function options.
*/
/**
* @name startOfISOWeek
* @category ISO Week Helpers
* @summary Return the start of an ISO week for the given date.
*
* @description
* Return the start of an ISO week for the given date.
* The result will be in the local timezone.
*
* ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type, it is the type returned from the context function if it is passed, or inferred from the arguments.
*
* @param date - The original date
* @param options - An object with options
*
* @returns The start of an ISO week
*
* @example
* // The start of an ISO week for 2 September 2014 11:55:00:
* const result = startOfISOWeek(new Date(2014, 8, 2, 11, 55, 0))
* //=> Mon Sep 01 2014 00:00:00
*/
function startOfISOWeek(date, options) {
	return startOfWeek(date, {
		...options,
		weekStartsOn: 1
	});
}
var init_startOfISOWeek = __esmMin((() => {
	init_startOfWeek();
}));
//#endregion
//#region node_modules/date-fns/getISOWeekYear.js
/**
* The {@link getISOWeekYear} function options.
*/
/**
* @name getISOWeekYear
* @category ISO Week-Numbering Year Helpers
* @summary Get the ISO week-numbering year of the given date.
*
* @description
* Get the ISO week-numbering year of the given date,
* which always starts 3 days before the year's first Thursday.
*
* ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
*
* @param date - The given date
*
* @returns The ISO week-numbering year
*
* @example
* // Which ISO-week numbering year is 2 January 2005?
* const result = getISOWeekYear(new Date(2005, 0, 2))
* //=> 2004
*/
function getISOWeekYear(date, options) {
	const _date = toDate(date, options?.in);
	const year = _date.getFullYear();
	const fourthOfJanuaryOfNextYear = constructFrom(_date, 0);
	fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
	fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
	const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
	const fourthOfJanuaryOfThisYear = constructFrom(_date, 0);
	fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
	fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
	const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
	if (_date.getTime() >= startOfNextYear.getTime()) return year + 1;
	else if (_date.getTime() >= startOfThisYear.getTime()) return year;
	else return year - 1;
}
var init_getISOWeekYear = __esmMin((() => {
	init_constructFrom();
	init_startOfISOWeek();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js
/**
* Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
* They usually appear for dates that denote time before the timezones were introduced
* (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
* and GMT+01:00:00 after that date)
*
* Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
* which would lead to incorrect calculations.
*
* This function returns the timezone offset in milliseconds that takes seconds in account.
*/
function getTimezoneOffsetInMilliseconds(date) {
	const _date = toDate(date);
	const utcDate = new Date(Date.UTC(_date.getFullYear(), _date.getMonth(), _date.getDate(), _date.getHours(), _date.getMinutes(), _date.getSeconds(), _date.getMilliseconds()));
	utcDate.setUTCFullYear(_date.getFullYear());
	return +date - +utcDate;
}
var init_getTimezoneOffsetInMilliseconds = __esmMin((() => {
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/_lib/normalizeDates.js
function normalizeDates(context, ...dates) {
	const normalize = constructFrom.bind(null, context || dates.find((date) => typeof date === "object"));
	return dates.map(normalize);
}
var init_normalizeDates = __esmMin((() => {
	init_constructFrom();
}));
//#endregion
//#region node_modules/date-fns/startOfDay.js
/**
* The {@link startOfDay} function options.
*/
/**
* @name startOfDay
* @category Day Helpers
* @summary Return the start of a day for the given date.
*
* @description
* Return the start of a day for the given date.
* The result will be in the local timezone.
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type, it is the type returned from the context function if it is passed, or inferred from the arguments.
*
* @param date - The original date
* @param options - The options
*
* @returns The start of a day
*
* @example
* // The start of a day for 2 September 2014 11:55:00:
* const result = startOfDay(new Date(2014, 8, 2, 11, 55, 0))
* //=> Tue Sep 02 2014 00:00:00
*/
function startOfDay(date, options) {
	const _date = toDate(date, options?.in);
	_date.setHours(0, 0, 0, 0);
	return _date;
}
var init_startOfDay = __esmMin((() => {
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarDays.js
/**
* The {@link differenceInCalendarDays} function options.
*/
/**
* @name differenceInCalendarDays
* @category Day Helpers
* @summary Get the number of calendar days between the given dates.
*
* @description
* Get the number of calendar days between the given dates. This means that the times are removed
* from the dates and then the difference in days is calculated.
*
* @param laterDate - The later date
* @param earlierDate - The earlier date
* @param options - The options object
*
* @returns The number of calendar days
*
* @example
* // How many calendar days are between
* // 2 July 2011 23:00:00 and 2 July 2012 00:00:00?
* const result = differenceInCalendarDays(
*   new Date(2012, 6, 2, 0, 0),
*   new Date(2011, 6, 2, 23, 0)
* )
* //=> 366
* // How many calendar days are between
* // 2 July 2011 23:59:00 and 3 July 2011 00:01:00?
* const result = differenceInCalendarDays(
*   new Date(2011, 6, 3, 0, 1),
*   new Date(2011, 6, 2, 23, 59)
* )
* //=> 1
*/
function differenceInCalendarDays(laterDate, earlierDate, options) {
	const [laterDate_, earlierDate_] = normalizeDates(options?.in, laterDate, earlierDate);
	const laterStartOfDay = startOfDay(laterDate_);
	const earlierStartOfDay = startOfDay(earlierDate_);
	const laterTimestamp = +laterStartOfDay - getTimezoneOffsetInMilliseconds(laterStartOfDay);
	const earlierTimestamp = +earlierStartOfDay - getTimezoneOffsetInMilliseconds(earlierStartOfDay);
	return Math.round((laterTimestamp - earlierTimestamp) / millisecondsInDay);
}
var init_differenceInCalendarDays = __esmMin((() => {
	init_getTimezoneOffsetInMilliseconds();
	init_normalizeDates();
	init_constants();
	init_startOfDay();
}));
//#endregion
//#region node_modules/date-fns/startOfISOWeekYear.js
/**
* The {@link startOfISOWeekYear} function options.
*/
/**
* @name startOfISOWeekYear
* @category ISO Week-Numbering Year Helpers
* @summary Return the start of an ISO week-numbering year for the given date.
*
* @description
* Return the start of an ISO week-numbering year,
* which always starts 3 days before the year's first Thursday.
* The result will be in the local timezone.
*
* ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type, it is the type returned from the context function if it is passed, or inferred from the arguments.
*
* @param date - The original date
* @param options - An object with options
*
* @returns The start of an ISO week-numbering year
*
* @example
* // The start of an ISO week-numbering year for 2 July 2005:
* const result = startOfISOWeekYear(new Date(2005, 6, 2))
* //=> Mon Jan 03 2005 00:00:00
*/
function startOfISOWeekYear(date, options) {
	const year = getISOWeekYear(date, options);
	const fourthOfJanuary = constructFrom(options?.in || date, 0);
	fourthOfJanuary.setFullYear(year, 0, 4);
	fourthOfJanuary.setHours(0, 0, 0, 0);
	return startOfISOWeek(fourthOfJanuary);
}
var init_startOfISOWeekYear = __esmMin((() => {
	init_constructFrom();
	init_getISOWeekYear();
	init_startOfISOWeek();
}));
//#endregion
//#region node_modules/date-fns/setISOWeekYear.js
var init_setISOWeekYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addISOWeekYears.js
var init_addISOWeekYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addMinutes.js
var init_addMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addQuarters.js
var init_addQuarters = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addSeconds.js
var init_addSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addWeeks.js
var init_addWeeks = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/addYears.js
var init_addYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/areIntervalsOverlapping.js
var init_areIntervalsOverlapping = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/max.js
var init_max = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/min.js
var init_min = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/clamp.js
var init_clamp = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/closestIndexTo.js
var init_closestIndexTo = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/closestTo.js
var init_closestTo = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/compareAsc.js
var init_compareAsc = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/compareDesc.js
var init_compareDesc = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/constructNow.js
var init_constructNow = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/daysToWeeks.js
var init_daysToWeeks = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameDay.js
var init_isSameDay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isDate.js
/**
* @name isDate
* @category Common Helpers
* @summary Is the given value a date?
*
* @description
* Returns true if the given value is an instance of Date. The function works for dates transferred across iframes.
*
* @param value - The value to check
*
* @returns True if the given value is a date
*
* @example
* // For a valid date:
* const result = isDate(new Date())
* //=> true
*
* @example
* // For an invalid date:
* const result = isDate(new Date(NaN))
* //=> true
*
* @example
* // For some value:
* const result = isDate('2014-02-31')
* //=> false
*
* @example
* // For an object:
* const result = isDate({})
* //=> false
*/
function isDate(value) {
	return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}
var init_isDate = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isValid.js
/**
* @name isValid
* @category Common Helpers
* @summary Is the given date valid?
*
* @description
* Returns false if argument is Invalid Date and true otherwise.
* Argument is converted to Date using `toDate`. See [toDate](https://date-fns.org/docs/toDate)
* Invalid Date is a Date, whose time value is NaN.
*
* Time value of Date: http://es5.github.io/#x15.9.1.1
*
* @param date - The date to check
*
* @returns The date is valid
*
* @example
* // For the valid date:
* const result = isValid(new Date(2014, 1, 31))
* //=> true
*
* @example
* // For the value, convertible into a date:
* const result = isValid(1393804800000)
* //=> true
*
* @example
* // For the invalid date:
* const result = isValid(new Date(''))
* //=> false
*/
function isValid(date) {
	return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
}
var init_isValid = __esmMin((() => {
	init_isDate();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/differenceInBusinessDays.js
var init_differenceInBusinessDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarISOWeekYears.js
var init_differenceInCalendarISOWeekYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarISOWeeks.js
var init_differenceInCalendarISOWeeks = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarMonths.js
var init_differenceInCalendarMonths = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getQuarter.js
var init_getQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarQuarters.js
var init_differenceInCalendarQuarters = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarWeeks.js
var init_differenceInCalendarWeeks = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInCalendarYears.js
var init_differenceInCalendarYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInDays.js
var init_differenceInDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInHours.js
var init_differenceInHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subISOWeekYears.js
var init_subISOWeekYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInISOWeekYears.js
var init_differenceInISOWeekYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInMilliseconds.js
var init_differenceInMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInMinutes.js
var init_differenceInMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfDay.js
var init_endOfDay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfMonth.js
var init_endOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isLastDayOfMonth.js
var init_isLastDayOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInMonths.js
var init_differenceInMonths = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInQuarters.js
var init_differenceInQuarters = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInSeconds.js
var init_differenceInSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInWeeks.js
var init_differenceInWeeks = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/differenceInYears.js
var init_differenceInYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachDayOfInterval.js
var init_eachDayOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachHourOfInterval.js
var init_eachHourOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachMinuteOfInterval.js
var init_eachMinuteOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachMonthOfInterval.js
var init_eachMonthOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfQuarter.js
var init_startOfQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachQuarterOfInterval.js
var init_eachQuarterOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachWeekOfInterval.js
var init_eachWeekOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachWeekendOfInterval.js
var init_eachWeekendOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfMonth.js
var init_startOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachWeekendOfMonth.js
var init_eachWeekendOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfYear.js
var init_endOfYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfYear.js
/**
* The {@link startOfYear} function options.
*/
/**
* @name startOfYear
* @category Year Helpers
* @summary Return the start of a year for the given date.
*
* @description
* Return the start of a year for the given date.
* The result will be in the local timezone.
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type, it is the type returned from the context function if it is passed, or inferred from the arguments.
*
* @param date - The original date
* @param options - The options
*
* @returns The start of a year
*
* @example
* // The start of a year for 2 September 2014 11:55:00:
* const result = startOfYear(new Date(2014, 8, 2, 11, 55, 00))
* //=> Wed Jan 01 2014 00:00:00
*/
function startOfYear(date, options) {
	const date_ = toDate(date, options?.in);
	date_.setFullYear(date_.getFullYear(), 0, 1);
	date_.setHours(0, 0, 0, 0);
	return date_;
}
var init_startOfYear = __esmMin((() => {
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/eachWeekendOfYear.js
var init_eachWeekendOfYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/eachYearOfInterval.js
var init_eachYearOfInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfDecade.js
var init_endOfDecade = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfHour.js
var init_endOfHour = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfWeek.js
var init_endOfWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfISOWeek.js
var init_endOfISOWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfISOWeekYear.js
var init_endOfISOWeekYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfMinute.js
var init_endOfMinute = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfQuarter.js
var init_endOfQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfSecond.js
var init_endOfSecond = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfToday.js
var init_endOfToday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfTomorrow.js
var init_endOfTomorrow = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/endOfYesterday.js
var init_endOfYesterday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/locale/en-US/_lib/formatDistance.js
var formatDistanceLocale, formatDistance;
var init_formatDistance$1 = __esmMin((() => {
	formatDistanceLocale = {
		lessThanXSeconds: {
			one: "less than a second",
			other: "less than {{count}} seconds"
		},
		xSeconds: {
			one: "1 second",
			other: "{{count}} seconds"
		},
		halfAMinute: "half a minute",
		lessThanXMinutes: {
			one: "less than a minute",
			other: "less than {{count}} minutes"
		},
		xMinutes: {
			one: "1 minute",
			other: "{{count}} minutes"
		},
		aboutXHours: {
			one: "about 1 hour",
			other: "about {{count}} hours"
		},
		xHours: {
			one: "1 hour",
			other: "{{count}} hours"
		},
		xDays: {
			one: "1 day",
			other: "{{count}} days"
		},
		aboutXWeeks: {
			one: "about 1 week",
			other: "about {{count}} weeks"
		},
		xWeeks: {
			one: "1 week",
			other: "{{count}} weeks"
		},
		aboutXMonths: {
			one: "about 1 month",
			other: "about {{count}} months"
		},
		xMonths: {
			one: "1 month",
			other: "{{count}} months"
		},
		aboutXYears: {
			one: "about 1 year",
			other: "about {{count}} years"
		},
		xYears: {
			one: "1 year",
			other: "{{count}} years"
		},
		overXYears: {
			one: "over 1 year",
			other: "over {{count}} years"
		},
		almostXYears: {
			one: "almost 1 year",
			other: "almost {{count}} years"
		}
	};
	formatDistance = (token, count, options) => {
		let result;
		const tokenValue = formatDistanceLocale[token];
		if (typeof tokenValue === "string") result = tokenValue;
		else if (count === 1) result = tokenValue.one;
		else result = tokenValue.other.replace("{{count}}", count.toString());
		if (options?.addSuffix) if (options.comparison && options.comparison > 0) return "in " + result;
		else return result + " ago";
		return result;
	};
}));
//#endregion
//#region node_modules/date-fns/locale/_lib/buildFormatLongFn.js
function buildFormatLongFn(args) {
	return (options = {}) => {
		const width = options.width ? String(options.width) : args.defaultWidth;
		return args.formats[width] || args.formats[args.defaultWidth];
	};
}
var init_buildFormatLongFn = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/locale/en-US/_lib/formatLong.js
var dateFormats, timeFormats, dateTimeFormats, formatLong;
var init_formatLong = __esmMin((() => {
	init_buildFormatLongFn();
	dateFormats = {
		full: "EEEE, MMMM do, y",
		long: "MMMM do, y",
		medium: "MMM d, y",
		short: "MM/dd/yyyy"
	};
	timeFormats = {
		full: "h:mm:ss a zzzz",
		long: "h:mm:ss a z",
		medium: "h:mm:ss a",
		short: "h:mm a"
	};
	dateTimeFormats = {
		full: "{{date}} 'at' {{time}}",
		long: "{{date}} 'at' {{time}}",
		medium: "{{date}}, {{time}}",
		short: "{{date}}, {{time}}"
	};
	formatLong = {
		date: buildFormatLongFn({
			formats: dateFormats,
			defaultWidth: "full"
		}),
		time: buildFormatLongFn({
			formats: timeFormats,
			defaultWidth: "full"
		}),
		dateTime: buildFormatLongFn({
			formats: dateTimeFormats,
			defaultWidth: "full"
		})
	};
}));
//#endregion
//#region node_modules/date-fns/locale/en-US/_lib/formatRelative.js
var formatRelativeLocale, formatRelative;
var init_formatRelative$1 = __esmMin((() => {
	formatRelativeLocale = {
		lastWeek: "'last' eeee 'at' p",
		yesterday: "'yesterday at' p",
		today: "'today at' p",
		tomorrow: "'tomorrow at' p",
		nextWeek: "eeee 'at' p",
		other: "P"
	};
	formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];
}));
//#endregion
//#region node_modules/date-fns/locale/_lib/buildLocalizeFn.js
/**
* The localize function argument callback which allows to convert raw value to
* the actual type.
*
* @param value - The value to convert
*
* @returns The converted value
*/
/**
* The map of localized values for each width.
*/
/**
* The index type of the locale unit value. It types conversion of units of
* values that don't start at 0 (i.e. quarters).
*/
/**
* Converts the unit value to the tuple of values.
*/
/**
* The tuple of localized era values. The first element represents BC,
* the second element represents AD.
*/
/**
* The tuple of localized quarter values. The first element represents Q1.
*/
/**
* The tuple of localized day values. The first element represents Sunday.
*/
/**
* The tuple of localized month values. The first element represents January.
*/
function buildLocalizeFn(args) {
	return (value, options) => {
		const context = options?.context ? String(options.context) : "standalone";
		let valuesArray;
		if (context === "formatting" && args.formattingValues) {
			const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
			const width = options?.width ? String(options.width) : defaultWidth;
			valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
		} else {
			const defaultWidth = args.defaultWidth;
			const width = options?.width ? String(options.width) : args.defaultWidth;
			valuesArray = args.values[width] || args.values[defaultWidth];
		}
		const index = args.argumentCallback ? args.argumentCallback(value) : value;
		return valuesArray[index];
	};
}
var init_buildLocalizeFn = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/locale/en-US/_lib/localize.js
var eraValues, quarterValues, monthValues, dayValues, dayPeriodValues, formattingDayPeriodValues, ordinalNumber, localize;
var init_localize = __esmMin((() => {
	init_buildLocalizeFn();
	eraValues = {
		narrow: ["B", "A"],
		abbreviated: ["BC", "AD"],
		wide: ["Before Christ", "Anno Domini"]
	};
	quarterValues = {
		narrow: [
			"1",
			"2",
			"3",
			"4"
		],
		abbreviated: [
			"Q1",
			"Q2",
			"Q3",
			"Q4"
		],
		wide: [
			"1st quarter",
			"2nd quarter",
			"3rd quarter",
			"4th quarter"
		]
	};
	monthValues = {
		narrow: [
			"J",
			"F",
			"M",
			"A",
			"M",
			"J",
			"J",
			"A",
			"S",
			"O",
			"N",
			"D"
		],
		abbreviated: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec"
		],
		wide: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		]
	};
	dayValues = {
		narrow: [
			"S",
			"M",
			"T",
			"W",
			"T",
			"F",
			"S"
		],
		short: [
			"Su",
			"Mo",
			"Tu",
			"We",
			"Th",
			"Fr",
			"Sa"
		],
		abbreviated: [
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat"
		],
		wide: [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		]
	};
	dayPeriodValues = {
		narrow: {
			am: "a",
			pm: "p",
			midnight: "mi",
			noon: "n",
			morning: "morning",
			afternoon: "afternoon",
			evening: "evening",
			night: "night"
		},
		abbreviated: {
			am: "AM",
			pm: "PM",
			midnight: "midnight",
			noon: "noon",
			morning: "morning",
			afternoon: "afternoon",
			evening: "evening",
			night: "night"
		},
		wide: {
			am: "a.m.",
			pm: "p.m.",
			midnight: "midnight",
			noon: "noon",
			morning: "morning",
			afternoon: "afternoon",
			evening: "evening",
			night: "night"
		}
	};
	formattingDayPeriodValues = {
		narrow: {
			am: "a",
			pm: "p",
			midnight: "mi",
			noon: "n",
			morning: "in the morning",
			afternoon: "in the afternoon",
			evening: "in the evening",
			night: "at night"
		},
		abbreviated: {
			am: "AM",
			pm: "PM",
			midnight: "midnight",
			noon: "noon",
			morning: "in the morning",
			afternoon: "in the afternoon",
			evening: "in the evening",
			night: "at night"
		},
		wide: {
			am: "a.m.",
			pm: "p.m.",
			midnight: "midnight",
			noon: "noon",
			morning: "in the morning",
			afternoon: "in the afternoon",
			evening: "in the evening",
			night: "at night"
		}
	};
	ordinalNumber = (dirtyNumber, _options) => {
		const number = Number(dirtyNumber);
		const rem100 = number % 100;
		if (rem100 > 20 || rem100 < 10) switch (rem100 % 10) {
			case 1: return number + "st";
			case 2: return number + "nd";
			case 3: return number + "rd";
		}
		return number + "th";
	};
	localize = {
		ordinalNumber,
		era: buildLocalizeFn({
			values: eraValues,
			defaultWidth: "wide"
		}),
		quarter: buildLocalizeFn({
			values: quarterValues,
			defaultWidth: "wide",
			argumentCallback: (quarter) => quarter - 1
		}),
		month: buildLocalizeFn({
			values: monthValues,
			defaultWidth: "wide"
		}),
		day: buildLocalizeFn({
			values: dayValues,
			defaultWidth: "wide"
		}),
		dayPeriod: buildLocalizeFn({
			values: dayPeriodValues,
			defaultWidth: "wide",
			formattingValues: formattingDayPeriodValues,
			defaultFormattingWidth: "wide"
		})
	};
}));
//#endregion
//#region node_modules/date-fns/locale/_lib/buildMatchFn.js
function buildMatchFn(args) {
	return (string, options = {}) => {
		const width = options.width;
		const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
		const matchResult = string.match(matchPattern);
		if (!matchResult) return null;
		const matchedString = matchResult[0];
		const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
		const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : findKey(parsePatterns, (pattern) => pattern.test(matchedString));
		let value;
		value = args.valueCallback ? args.valueCallback(key) : key;
		value = options.valueCallback ? options.valueCallback(value) : value;
		const rest = string.slice(matchedString.length);
		return {
			value,
			rest
		};
	};
}
function findKey(object, predicate) {
	for (const key in object) if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) return key;
}
function findIndex(array, predicate) {
	for (let key = 0; key < array.length; key++) if (predicate(array[key])) return key;
}
var init_buildMatchFn = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
function buildMatchPatternFn(args) {
	return (string, options = {}) => {
		const matchResult = string.match(args.matchPattern);
		if (!matchResult) return null;
		const matchedString = matchResult[0];
		const parseResult = string.match(args.parsePattern);
		if (!parseResult) return null;
		let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
		value = options.valueCallback ? options.valueCallback(value) : value;
		const rest = string.slice(matchedString.length);
		return {
			value,
			rest
		};
	};
}
var init_buildMatchPatternFn = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/locale/en-US/_lib/match.js
var matchOrdinalNumberPattern, parseOrdinalNumberPattern, matchEraPatterns, parseEraPatterns, matchQuarterPatterns, parseQuarterPatterns, matchMonthPatterns, parseMonthPatterns, matchDayPatterns, parseDayPatterns, matchDayPeriodPatterns, parseDayPeriodPatterns, match;
var init_match = __esmMin((() => {
	init_buildMatchFn();
	init_buildMatchPatternFn();
	matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
	parseOrdinalNumberPattern = /\d+/i;
	matchEraPatterns = {
		narrow: /^(b|a)/i,
		abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
		wide: /^(before christ|before common era|anno domini|common era)/i
	};
	parseEraPatterns = { any: [/^b/i, /^(a|c)/i] };
	matchQuarterPatterns = {
		narrow: /^[1234]/i,
		abbreviated: /^q[1234]/i,
		wide: /^[1234](th|st|nd|rd)? quarter/i
	};
	parseQuarterPatterns = { any: [
		/1/i,
		/2/i,
		/3/i,
		/4/i
	] };
	matchMonthPatterns = {
		narrow: /^[jfmasond]/i,
		abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
		wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
	};
	parseMonthPatterns = {
		narrow: [
			/^j/i,
			/^f/i,
			/^m/i,
			/^a/i,
			/^m/i,
			/^j/i,
			/^j/i,
			/^a/i,
			/^s/i,
			/^o/i,
			/^n/i,
			/^d/i
		],
		any: [
			/^ja/i,
			/^f/i,
			/^mar/i,
			/^ap/i,
			/^may/i,
			/^jun/i,
			/^jul/i,
			/^au/i,
			/^s/i,
			/^o/i,
			/^n/i,
			/^d/i
		]
	};
	matchDayPatterns = {
		narrow: /^[smtwf]/i,
		short: /^(su|mo|tu|we|th|fr|sa)/i,
		abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
		wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
	};
	parseDayPatterns = {
		narrow: [
			/^s/i,
			/^m/i,
			/^t/i,
			/^w/i,
			/^t/i,
			/^f/i,
			/^s/i
		],
		any: [
			/^su/i,
			/^m/i,
			/^tu/i,
			/^w/i,
			/^th/i,
			/^f/i,
			/^sa/i
		]
	};
	matchDayPeriodPatterns = {
		narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
		any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
	};
	parseDayPeriodPatterns = { any: {
		am: /^a/i,
		pm: /^p/i,
		midnight: /^mi/i,
		noon: /^no/i,
		morning: /morning/i,
		afternoon: /afternoon/i,
		evening: /evening/i,
		night: /night/i
	} };
	match = {
		ordinalNumber: buildMatchPatternFn({
			matchPattern: matchOrdinalNumberPattern,
			parsePattern: parseOrdinalNumberPattern,
			valueCallback: (value) => parseInt(value, 10)
		}),
		era: buildMatchFn({
			matchPatterns: matchEraPatterns,
			defaultMatchWidth: "wide",
			parsePatterns: parseEraPatterns,
			defaultParseWidth: "any"
		}),
		quarter: buildMatchFn({
			matchPatterns: matchQuarterPatterns,
			defaultMatchWidth: "wide",
			parsePatterns: parseQuarterPatterns,
			defaultParseWidth: "any",
			valueCallback: (index) => index + 1
		}),
		month: buildMatchFn({
			matchPatterns: matchMonthPatterns,
			defaultMatchWidth: "wide",
			parsePatterns: parseMonthPatterns,
			defaultParseWidth: "any"
		}),
		day: buildMatchFn({
			matchPatterns: matchDayPatterns,
			defaultMatchWidth: "wide",
			parsePatterns: parseDayPatterns,
			defaultParseWidth: "any"
		}),
		dayPeriod: buildMatchFn({
			matchPatterns: matchDayPeriodPatterns,
			defaultMatchWidth: "any",
			parsePatterns: parseDayPeriodPatterns,
			defaultParseWidth: "any"
		})
	};
}));
//#endregion
//#region node_modules/date-fns/locale/en-US.js
var enUS;
var init_en_US = __esmMin((() => {
	init_formatDistance$1();
	init_formatLong();
	init_formatRelative$1();
	init_localize();
	init_match();
	enUS = {
		code: "en-US",
		formatDistance,
		formatLong,
		formatRelative,
		localize,
		match,
		options: {
			weekStartsOn: 0,
			firstWeekContainsDate: 1
		}
	};
}));
//#endregion
//#region node_modules/date-fns/_lib/defaultLocale.js
var init_defaultLocale = __esmMin((() => {
	init_en_US();
}));
//#endregion
//#region node_modules/date-fns/getDayOfYear.js
/**
* The {@link getDayOfYear} function options.
*/
/**
* @name getDayOfYear
* @category Day Helpers
* @summary Get the day of the year of the given date.
*
* @description
* Get the day of the year of the given date.
*
* @param date - The given date
* @param options - The options
*
* @returns The day of year
*
* @example
* // Which day of the year is 2 July 2014?
* const result = getDayOfYear(new Date(2014, 6, 2))
* //=> 183
*/
function getDayOfYear(date, options) {
	const _date = toDate(date, options?.in);
	return differenceInCalendarDays(_date, startOfYear(_date)) + 1;
}
var init_getDayOfYear = __esmMin((() => {
	init_differenceInCalendarDays();
	init_startOfYear();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/getISOWeek.js
/**
* The {@link getISOWeek} function options.
*/
/**
* @name getISOWeek
* @category ISO Week Helpers
* @summary Get the ISO week of the given date.
*
* @description
* Get the ISO week of the given date.
*
* ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
*
* @param date - The given date
* @param options - The options
*
* @returns The ISO week
*
* @example
* // Which week of the ISO-week numbering year is 2 January 2005?
* const result = getISOWeek(new Date(2005, 0, 2))
* //=> 53
*/
function getISOWeek(date, options) {
	const _date = toDate(date, options?.in);
	const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
	return Math.round(diff / millisecondsInWeek) + 1;
}
var init_getISOWeek = __esmMin((() => {
	init_constants();
	init_startOfISOWeek();
	init_startOfISOWeekYear();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/getWeekYear.js
/**
* The {@link getWeekYear} function options.
*/
/**
* @name getWeekYear
* @category Week-Numbering Year Helpers
* @summary Get the local week-numbering year of the given date.
*
* @description
* Get the local week-numbering year of the given date.
* The exact calculation depends on the values of
* `options.weekStartsOn` (which is the index of the first day of the week)
* and `options.firstWeekContainsDate` (which is the day of January, which is always in
* the first week of the week-numbering year)
*
* Week numbering: https://en.wikipedia.org/wiki/Week#The_ISO_week_date_system
*
* @param date - The given date
* @param options - An object with options.
*
* @returns The local week-numbering year
*
* @example
* // Which week numbering year is 26 December 2004 with the default settings?
* const result = getWeekYear(new Date(2004, 11, 26))
* //=> 2005
*
* @example
* // Which week numbering year is 26 December 2004 if week starts on Saturday?
* const result = getWeekYear(new Date(2004, 11, 26), { weekStartsOn: 6 })
* //=> 2004
*
* @example
* // Which week numbering year is 26 December 2004 if the first week contains 4 January?
* const result = getWeekYear(new Date(2004, 11, 26), { firstWeekContainsDate: 4 })
* //=> 2004
*/
function getWeekYear(date, options) {
	const _date = toDate(date, options?.in);
	const year = _date.getFullYear();
	const defaultOptions = getDefaultOptions();
	const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions.firstWeekContainsDate ?? defaultOptions.locale?.options?.firstWeekContainsDate ?? 1;
	const firstWeekOfNextYear = constructFrom(options?.in || date, 0);
	firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
	firstWeekOfNextYear.setHours(0, 0, 0, 0);
	const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
	const firstWeekOfThisYear = constructFrom(options?.in || date, 0);
	firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
	firstWeekOfThisYear.setHours(0, 0, 0, 0);
	const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
	if (+_date >= +startOfNextYear) return year + 1;
	else if (+_date >= +startOfThisYear) return year;
	else return year - 1;
}
var init_getWeekYear = __esmMin((() => {
	init_defaultOptions();
	init_constructFrom();
	init_startOfWeek();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/startOfWeekYear.js
/**
* The {@link startOfWeekYear} function options.
*/
/**
* @name startOfWeekYear
* @category Week-Numbering Year Helpers
* @summary Return the start of a local week-numbering year for the given date.
*
* @description
* Return the start of a local week-numbering year.
* The exact calculation depends on the values of
* `options.weekStartsOn` (which is the index of the first day of the week)
* and `options.firstWeekContainsDate` (which is the day of January, which is always in
* the first week of the week-numbering year)
*
* Week numbering: https://en.wikipedia.org/wiki/Week#The_ISO_week_date_system
*
* @typeParam DateType - The `Date` type, the function operates on. Gets inferred from passed arguments. Allows to use extensions like [`UTCDate`](https://github.com/date-fns/utc).
* @typeParam ResultDate - The result `Date` type.
*
* @param date - The original date
* @param options - An object with options
*
* @returns The start of a week-numbering year
*
* @example
* // The start of an a week-numbering year for 2 July 2005 with default settings:
* const result = startOfWeekYear(new Date(2005, 6, 2))
* //=> Sun Dec 26 2004 00:00:00
*
* @example
* // The start of a week-numbering year for 2 July 2005
* // if Monday is the first day of week
* // and 4 January is always in the first week of the year:
* const result = startOfWeekYear(new Date(2005, 6, 2), {
*   weekStartsOn: 1,
*   firstWeekContainsDate: 4
* })
* //=> Mon Jan 03 2005 00:00:00
*/
function startOfWeekYear(date, options) {
	const defaultOptions = getDefaultOptions();
	const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions.firstWeekContainsDate ?? defaultOptions.locale?.options?.firstWeekContainsDate ?? 1;
	const year = getWeekYear(date, options);
	const firstWeek = constructFrom(options?.in || date, 0);
	firstWeek.setFullYear(year, 0, firstWeekContainsDate);
	firstWeek.setHours(0, 0, 0, 0);
	return startOfWeek(firstWeek, options);
}
var init_startOfWeekYear = __esmMin((() => {
	init_defaultOptions();
	init_constructFrom();
	init_getWeekYear();
	init_startOfWeek();
}));
//#endregion
//#region node_modules/date-fns/getWeek.js
/**
* The {@link getWeek} function options.
*/
/**
* @name getWeek
* @category Week Helpers
* @summary Get the local week index of the given date.
*
* @description
* Get the local week index of the given date.
* The exact calculation depends on the values of
* `options.weekStartsOn` (which is the index of the first day of the week)
* and `options.firstWeekContainsDate` (which is the day of January, which is always in
* the first week of the week-numbering year)
*
* Week numbering: https://en.wikipedia.org/wiki/Week#The_ISO_week_date_system
*
* @param date - The given date
* @param options - An object with options
*
* @returns The week
*
* @example
* // Which week of the local week numbering year is 2 January 2005 with default options?
* const result = getWeek(new Date(2005, 0, 2))
* //=> 2
*
* @example
* // Which week of the local week numbering year is 2 January 2005,
* // if Monday is the first day of the week,
* // and the first week of the year always contains 4 January?
* const result = getWeek(new Date(2005, 0, 2), {
*   weekStartsOn: 1,
*   firstWeekContainsDate: 4
* })
* //=> 53
*/
function getWeek(date, options) {
	const _date = toDate(date, options?.in);
	const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
	return Math.round(diff / millisecondsInWeek) + 1;
}
var init_getWeek = __esmMin((() => {
	init_constants();
	init_startOfWeek();
	init_startOfWeekYear();
	init_toDate();
}));
//#endregion
//#region node_modules/date-fns/_lib/addLeadingZeros.js
function addLeadingZeros(number, targetLength) {
	return (number < 0 ? "-" : "") + Math.abs(number).toString().padStart(targetLength, "0");
}
var init_addLeadingZeros = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/_lib/format/lightFormatters.js
var lightFormatters;
var init_lightFormatters = __esmMin((() => {
	init_addLeadingZeros();
	lightFormatters = {
		y(date, token) {
			const signedYear = date.getFullYear();
			const year = signedYear > 0 ? signedYear : 1 - signedYear;
			return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
		},
		M(date, token) {
			const month = date.getMonth();
			return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
		},
		d(date, token) {
			return addLeadingZeros(date.getDate(), token.length);
		},
		a(date, token) {
			const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
			switch (token) {
				case "a":
				case "aa": return dayPeriodEnumValue.toUpperCase();
				case "aaa": return dayPeriodEnumValue;
				case "aaaaa": return dayPeriodEnumValue[0];
				default: return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
			}
		},
		h(date, token) {
			return addLeadingZeros(date.getHours() % 12 || 12, token.length);
		},
		H(date, token) {
			return addLeadingZeros(date.getHours(), token.length);
		},
		m(date, token) {
			return addLeadingZeros(date.getMinutes(), token.length);
		},
		s(date, token) {
			return addLeadingZeros(date.getSeconds(), token.length);
		},
		S(date, token) {
			const numberOfDigits = token.length;
			const milliseconds = date.getMilliseconds();
			return addLeadingZeros(Math.trunc(milliseconds * Math.pow(10, numberOfDigits - 3)), token.length);
		}
	};
}));
//#endregion
//#region node_modules/date-fns/_lib/format/formatters.js
function formatTimezoneShort(offset, delimiter = "") {
	const sign = offset > 0 ? "-" : "+";
	const absOffset = Math.abs(offset);
	const hours = Math.trunc(absOffset / 60);
	const minutes = absOffset % 60;
	if (minutes === 0) return sign + String(hours);
	return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
function formatTimezoneWithOptionalMinutes(offset, delimiter) {
	if (offset % 60 === 0) return (offset > 0 ? "-" : "+") + addLeadingZeros(Math.abs(offset) / 60, 2);
	return formatTimezone(offset, delimiter);
}
function formatTimezone(offset, delimiter = "") {
	const sign = offset > 0 ? "-" : "+";
	const absOffset = Math.abs(offset);
	const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
	const minutes = addLeadingZeros(absOffset % 60, 2);
	return sign + hours + delimiter + minutes;
}
var dayPeriodEnum, formatters;
var init_formatters = __esmMin((() => {
	init_getDayOfYear();
	init_getISOWeek();
	init_getISOWeekYear();
	init_getWeek();
	init_getWeekYear();
	init_addLeadingZeros();
	init_lightFormatters();
	dayPeriodEnum = {
		am: "am",
		pm: "pm",
		midnight: "midnight",
		noon: "noon",
		morning: "morning",
		afternoon: "afternoon",
		evening: "evening",
		night: "night"
	};
	formatters = {
		G: function(date, token, localize) {
			const era = date.getFullYear() > 0 ? 1 : 0;
			switch (token) {
				case "G":
				case "GG":
				case "GGG": return localize.era(era, { width: "abbreviated" });
				case "GGGGG": return localize.era(era, { width: "narrow" });
				default: return localize.era(era, { width: "wide" });
			}
		},
		y: function(date, token, localize) {
			if (token === "yo") {
				const signedYear = date.getFullYear();
				const year = signedYear > 0 ? signedYear : 1 - signedYear;
				return localize.ordinalNumber(year, { unit: "year" });
			}
			return lightFormatters.y(date, token);
		},
		Y: function(date, token, localize, options) {
			const signedWeekYear = getWeekYear(date, options);
			const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
			if (token === "YY") return addLeadingZeros(weekYear % 100, 2);
			if (token === "Yo") return localize.ordinalNumber(weekYear, { unit: "year" });
			return addLeadingZeros(weekYear, token.length);
		},
		R: function(date, token) {
			return addLeadingZeros(getISOWeekYear(date), token.length);
		},
		u: function(date, token) {
			return addLeadingZeros(date.getFullYear(), token.length);
		},
		Q: function(date, token, localize) {
			const quarter = Math.ceil((date.getMonth() + 1) / 3);
			switch (token) {
				case "Q": return String(quarter);
				case "QQ": return addLeadingZeros(quarter, 2);
				case "Qo": return localize.ordinalNumber(quarter, { unit: "quarter" });
				case "QQQ": return localize.quarter(quarter, {
					width: "abbreviated",
					context: "formatting"
				});
				case "QQQQQ": return localize.quarter(quarter, {
					width: "narrow",
					context: "formatting"
				});
				default: return localize.quarter(quarter, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		q: function(date, token, localize) {
			const quarter = Math.ceil((date.getMonth() + 1) / 3);
			switch (token) {
				case "q": return String(quarter);
				case "qq": return addLeadingZeros(quarter, 2);
				case "qo": return localize.ordinalNumber(quarter, { unit: "quarter" });
				case "qqq": return localize.quarter(quarter, {
					width: "abbreviated",
					context: "standalone"
				});
				case "qqqqq": return localize.quarter(quarter, {
					width: "narrow",
					context: "standalone"
				});
				default: return localize.quarter(quarter, {
					width: "wide",
					context: "standalone"
				});
			}
		},
		M: function(date, token, localize) {
			const month = date.getMonth();
			switch (token) {
				case "M":
				case "MM": return lightFormatters.M(date, token);
				case "Mo": return localize.ordinalNumber(month + 1, { unit: "month" });
				case "MMM": return localize.month(month, {
					width: "abbreviated",
					context: "formatting"
				});
				case "MMMMM": return localize.month(month, {
					width: "narrow",
					context: "formatting"
				});
				default: return localize.month(month, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		L: function(date, token, localize) {
			const month = date.getMonth();
			switch (token) {
				case "L": return String(month + 1);
				case "LL": return addLeadingZeros(month + 1, 2);
				case "Lo": return localize.ordinalNumber(month + 1, { unit: "month" });
				case "LLL": return localize.month(month, {
					width: "abbreviated",
					context: "standalone"
				});
				case "LLLLL": return localize.month(month, {
					width: "narrow",
					context: "standalone"
				});
				default: return localize.month(month, {
					width: "wide",
					context: "standalone"
				});
			}
		},
		w: function(date, token, localize, options) {
			const week = getWeek(date, options);
			if (token === "wo") return localize.ordinalNumber(week, { unit: "week" });
			return addLeadingZeros(week, token.length);
		},
		I: function(date, token, localize) {
			const isoWeek = getISOWeek(date);
			if (token === "Io") return localize.ordinalNumber(isoWeek, { unit: "week" });
			return addLeadingZeros(isoWeek, token.length);
		},
		d: function(date, token, localize) {
			if (token === "do") return localize.ordinalNumber(date.getDate(), { unit: "date" });
			return lightFormatters.d(date, token);
		},
		D: function(date, token, localize) {
			const dayOfYear = getDayOfYear(date);
			if (token === "Do") return localize.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
			return addLeadingZeros(dayOfYear, token.length);
		},
		E: function(date, token, localize) {
			const dayOfWeek = date.getDay();
			switch (token) {
				case "E":
				case "EE":
				case "EEE": return localize.day(dayOfWeek, {
					width: "abbreviated",
					context: "formatting"
				});
				case "EEEEE": return localize.day(dayOfWeek, {
					width: "narrow",
					context: "formatting"
				});
				case "EEEEEE": return localize.day(dayOfWeek, {
					width: "short",
					context: "formatting"
				});
				default: return localize.day(dayOfWeek, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		e: function(date, token, localize, options) {
			const dayOfWeek = date.getDay();
			const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
			switch (token) {
				case "e": return String(localDayOfWeek);
				case "ee": return addLeadingZeros(localDayOfWeek, 2);
				case "eo": return localize.ordinalNumber(localDayOfWeek, { unit: "day" });
				case "eee": return localize.day(dayOfWeek, {
					width: "abbreviated",
					context: "formatting"
				});
				case "eeeee": return localize.day(dayOfWeek, {
					width: "narrow",
					context: "formatting"
				});
				case "eeeeee": return localize.day(dayOfWeek, {
					width: "short",
					context: "formatting"
				});
				default: return localize.day(dayOfWeek, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		c: function(date, token, localize, options) {
			const dayOfWeek = date.getDay();
			const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
			switch (token) {
				case "c": return String(localDayOfWeek);
				case "cc": return addLeadingZeros(localDayOfWeek, token.length);
				case "co": return localize.ordinalNumber(localDayOfWeek, { unit: "day" });
				case "ccc": return localize.day(dayOfWeek, {
					width: "abbreviated",
					context: "standalone"
				});
				case "ccccc": return localize.day(dayOfWeek, {
					width: "narrow",
					context: "standalone"
				});
				case "cccccc": return localize.day(dayOfWeek, {
					width: "short",
					context: "standalone"
				});
				default: return localize.day(dayOfWeek, {
					width: "wide",
					context: "standalone"
				});
			}
		},
		i: function(date, token, localize) {
			const dayOfWeek = date.getDay();
			const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
			switch (token) {
				case "i": return String(isoDayOfWeek);
				case "ii": return addLeadingZeros(isoDayOfWeek, token.length);
				case "io": return localize.ordinalNumber(isoDayOfWeek, { unit: "day" });
				case "iii": return localize.day(dayOfWeek, {
					width: "abbreviated",
					context: "formatting"
				});
				case "iiiii": return localize.day(dayOfWeek, {
					width: "narrow",
					context: "formatting"
				});
				case "iiiiii": return localize.day(dayOfWeek, {
					width: "short",
					context: "formatting"
				});
				default: return localize.day(dayOfWeek, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		a: function(date, token, localize) {
			const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
			switch (token) {
				case "a":
				case "aa": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "abbreviated",
					context: "formatting"
				});
				case "aaa": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "abbreviated",
					context: "formatting"
				}).toLowerCase();
				case "aaaaa": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "narrow",
					context: "formatting"
				});
				default: return localize.dayPeriod(dayPeriodEnumValue, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		b: function(date, token, localize) {
			const hours = date.getHours();
			let dayPeriodEnumValue;
			if (hours === 12) dayPeriodEnumValue = dayPeriodEnum.noon;
			else if (hours === 0) dayPeriodEnumValue = dayPeriodEnum.midnight;
			else dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
			switch (token) {
				case "b":
				case "bb": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "abbreviated",
					context: "formatting"
				});
				case "bbb": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "abbreviated",
					context: "formatting"
				}).toLowerCase();
				case "bbbbb": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "narrow",
					context: "formatting"
				});
				default: return localize.dayPeriod(dayPeriodEnumValue, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		B: function(date, token, localize) {
			const hours = date.getHours();
			let dayPeriodEnumValue;
			if (hours >= 17) dayPeriodEnumValue = dayPeriodEnum.evening;
			else if (hours >= 12) dayPeriodEnumValue = dayPeriodEnum.afternoon;
			else if (hours >= 4) dayPeriodEnumValue = dayPeriodEnum.morning;
			else dayPeriodEnumValue = dayPeriodEnum.night;
			switch (token) {
				case "B":
				case "BB":
				case "BBB": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "abbreviated",
					context: "formatting"
				});
				case "BBBBB": return localize.dayPeriod(dayPeriodEnumValue, {
					width: "narrow",
					context: "formatting"
				});
				default: return localize.dayPeriod(dayPeriodEnumValue, {
					width: "wide",
					context: "formatting"
				});
			}
		},
		h: function(date, token, localize) {
			if (token === "ho") {
				let hours = date.getHours() % 12;
				if (hours === 0) hours = 12;
				return localize.ordinalNumber(hours, { unit: "hour" });
			}
			return lightFormatters.h(date, token);
		},
		H: function(date, token, localize) {
			if (token === "Ho") return localize.ordinalNumber(date.getHours(), { unit: "hour" });
			return lightFormatters.H(date, token);
		},
		K: function(date, token, localize) {
			const hours = date.getHours() % 12;
			if (token === "Ko") return localize.ordinalNumber(hours, { unit: "hour" });
			return addLeadingZeros(hours, token.length);
		},
		k: function(date, token, localize) {
			let hours = date.getHours();
			if (hours === 0) hours = 24;
			if (token === "ko") return localize.ordinalNumber(hours, { unit: "hour" });
			return addLeadingZeros(hours, token.length);
		},
		m: function(date, token, localize) {
			if (token === "mo") return localize.ordinalNumber(date.getMinutes(), { unit: "minute" });
			return lightFormatters.m(date, token);
		},
		s: function(date, token, localize) {
			if (token === "so") return localize.ordinalNumber(date.getSeconds(), { unit: "second" });
			return lightFormatters.s(date, token);
		},
		S: function(date, token) {
			return lightFormatters.S(date, token);
		},
		X: function(date, token, _localize) {
			const timezoneOffset = date.getTimezoneOffset();
			if (timezoneOffset === 0) return "Z";
			switch (token) {
				case "X": return formatTimezoneWithOptionalMinutes(timezoneOffset);
				case "XXXX":
				case "XX": return formatTimezone(timezoneOffset);
				default: return formatTimezone(timezoneOffset, ":");
			}
		},
		x: function(date, token, _localize) {
			const timezoneOffset = date.getTimezoneOffset();
			switch (token) {
				case "x": return formatTimezoneWithOptionalMinutes(timezoneOffset);
				case "xxxx":
				case "xx": return formatTimezone(timezoneOffset);
				default: return formatTimezone(timezoneOffset, ":");
			}
		},
		O: function(date, token, _localize) {
			const timezoneOffset = date.getTimezoneOffset();
			switch (token) {
				case "O":
				case "OO":
				case "OOO": return "GMT" + formatTimezoneShort(timezoneOffset, ":");
				default: return "GMT" + formatTimezone(timezoneOffset, ":");
			}
		},
		z: function(date, token, _localize) {
			const timezoneOffset = date.getTimezoneOffset();
			switch (token) {
				case "z":
				case "zz":
				case "zzz": return "GMT" + formatTimezoneShort(timezoneOffset, ":");
				default: return "GMT" + formatTimezone(timezoneOffset, ":");
			}
		},
		t: function(date, token, _localize) {
			return addLeadingZeros(Math.trunc(+date / 1e3), token.length);
		},
		T: function(date, token, _localize) {
			return addLeadingZeros(+date, token.length);
		}
	};
}));
//#endregion
//#region node_modules/date-fns/_lib/format/longFormatters.js
var dateLongFormatter, timeLongFormatter, dateTimeLongFormatter, longFormatters;
var init_longFormatters = __esmMin((() => {
	dateLongFormatter = (pattern, formatLong) => {
		switch (pattern) {
			case "P": return formatLong.date({ width: "short" });
			case "PP": return formatLong.date({ width: "medium" });
			case "PPP": return formatLong.date({ width: "long" });
			default: return formatLong.date({ width: "full" });
		}
	};
	timeLongFormatter = (pattern, formatLong) => {
		switch (pattern) {
			case "p": return formatLong.time({ width: "short" });
			case "pp": return formatLong.time({ width: "medium" });
			case "ppp": return formatLong.time({ width: "long" });
			default: return formatLong.time({ width: "full" });
		}
	};
	dateTimeLongFormatter = (pattern, formatLong) => {
		const matchResult = pattern.match(/(P+)(p+)?/) || [];
		const datePattern = matchResult[1];
		const timePattern = matchResult[2];
		if (!timePattern) return dateLongFormatter(pattern, formatLong);
		let dateTimeFormat;
		switch (datePattern) {
			case "P":
				dateTimeFormat = formatLong.dateTime({ width: "short" });
				break;
			case "PP":
				dateTimeFormat = formatLong.dateTime({ width: "medium" });
				break;
			case "PPP":
				dateTimeFormat = formatLong.dateTime({ width: "long" });
				break;
			default:
				dateTimeFormat = formatLong.dateTime({ width: "full" });
				break;
		}
		return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong)).replace("{{time}}", timeLongFormatter(timePattern, formatLong));
	};
	longFormatters = {
		p: timeLongFormatter,
		P: dateTimeLongFormatter
	};
}));
//#endregion
//#region node_modules/date-fns/_lib/protectedTokens.js
function isProtectedDayOfYearToken(token) {
	return dayOfYearTokenRE.test(token);
}
function isProtectedWeekYearToken(token) {
	return weekYearTokenRE.test(token);
}
function warnOrThrowProtectedError(token, format, input) {
	const _message = message(token, format, input);
	console.warn(_message);
	if (throwTokens.includes(token)) throw new RangeError(_message);
}
function message(token, format, input) {
	const subject = token[0] === "Y" ? "years" : "days of the month";
	return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}
var dayOfYearTokenRE, weekYearTokenRE, throwTokens;
var init_protectedTokens = __esmMin((() => {
	dayOfYearTokenRE = /^D+$/;
	weekYearTokenRE = /^Y+$/;
	throwTokens = [
		"D",
		"DD",
		"YY",
		"YYYY"
	];
}));
//#endregion
//#region node_modules/date-fns/format.js
/**
* The {@link format} function options.
*/
/**
* @name format
* @alias formatDate
* @category Common Helpers
* @summary Format the date.
*
* @description
* Return the formatted date string in the given format. The result may vary by locale.
*
* > ⚠️ Please note that the `format` tokens differ from Moment.js and other libraries.
* > See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
*
* The characters wrapped between two single quotes characters (') are escaped.
* Two single quotes in a row, whether inside or outside a quoted sequence, represent a 'real' single quote.
* (see the last example)
*
* Format of the string is based on Unicode Technical Standard #35:
* https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
* with a few additions (see note 7 below the table).
*
* Accepted patterns:
* | Unit                            | Pattern | Result examples                   | Notes |
* |---------------------------------|---------|-----------------------------------|-------|
* | Era                             | G..GGG  | AD, BC                            |       |
* |                                 | GGGG    | Anno Domini, Before Christ        | 2     |
* |                                 | GGGGG   | A, B                              |       |
* | Calendar year                   | y       | 44, 1, 1900, 2017                 | 5     |
* |                                 | yo      | 44th, 1st, 0th, 17th              | 5,7   |
* |                                 | yy      | 44, 01, 00, 17                    | 5     |
* |                                 | yyy     | 044, 001, 1900, 2017              | 5     |
* |                                 | yyyy    | 0044, 0001, 1900, 2017            | 5     |
* |                                 | yyyyy   | ...                               | 3,5   |
* | Local week-numbering year       | Y       | 44, 1, 1900, 2017                 | 5     |
* |                                 | Yo      | 44th, 1st, 1900th, 2017th         | 5,7   |
* |                                 | YY      | 44, 01, 00, 17                    | 5,8   |
* |                                 | YYY     | 044, 001, 1900, 2017              | 5     |
* |                                 | YYYY    | 0044, 0001, 1900, 2017            | 5,8   |
* |                                 | YYYYY   | ...                               | 3,5   |
* | ISO week-numbering year         | R       | -43, 0, 1, 1900, 2017             | 5,7   |
* |                                 | RR      | -43, 00, 01, 1900, 2017           | 5,7   |
* |                                 | RRR     | -043, 000, 001, 1900, 2017        | 5,7   |
* |                                 | RRRR    | -0043, 0000, 0001, 1900, 2017     | 5,7   |
* |                                 | RRRRR   | ...                               | 3,5,7 |
* | Extended year                   | u       | -43, 0, 1, 1900, 2017             | 5     |
* |                                 | uu      | -43, 01, 1900, 2017               | 5     |
* |                                 | uuu     | -043, 001, 1900, 2017             | 5     |
* |                                 | uuuu    | -0043, 0001, 1900, 2017           | 5     |
* |                                 | uuuuu   | ...                               | 3,5   |
* | Quarter (formatting)            | Q       | 1, 2, 3, 4                        |       |
* |                                 | Qo      | 1st, 2nd, 3rd, 4th                | 7     |
* |                                 | QQ      | 01, 02, 03, 04                    |       |
* |                                 | QQQ     | Q1, Q2, Q3, Q4                    |       |
* |                                 | QQQQ    | 1st quarter, 2nd quarter, ...     | 2     |
* |                                 | QQQQQ   | 1, 2, 3, 4                        | 4     |
* | Quarter (stand-alone)           | q       | 1, 2, 3, 4                        |       |
* |                                 | qo      | 1st, 2nd, 3rd, 4th                | 7     |
* |                                 | qq      | 01, 02, 03, 04                    |       |
* |                                 | qqq     | Q1, Q2, Q3, Q4                    |       |
* |                                 | qqqq    | 1st quarter, 2nd quarter, ...     | 2     |
* |                                 | qqqqq   | 1, 2, 3, 4                        | 4     |
* | Month (formatting)              | M       | 1, 2, ..., 12                     |       |
* |                                 | Mo      | 1st, 2nd, ..., 12th               | 7     |
* |                                 | MM      | 01, 02, ..., 12                   |       |
* |                                 | MMM     | Jan, Feb, ..., Dec                |       |
* |                                 | MMMM    | January, February, ..., December  | 2     |
* |                                 | MMMMM   | J, F, ..., D                      |       |
* | Month (stand-alone)             | L       | 1, 2, ..., 12                     |       |
* |                                 | Lo      | 1st, 2nd, ..., 12th               | 7     |
* |                                 | LL      | 01, 02, ..., 12                   |       |
* |                                 | LLL     | Jan, Feb, ..., Dec                |       |
* |                                 | LLLL    | January, February, ..., December  | 2     |
* |                                 | LLLLL   | J, F, ..., D                      |       |
* | Local week of year              | w       | 1, 2, ..., 53                     |       |
* |                                 | wo      | 1st, 2nd, ..., 53th               | 7     |
* |                                 | ww      | 01, 02, ..., 53                   |       |
* | ISO week of year                | I       | 1, 2, ..., 53                     | 7     |
* |                                 | Io      | 1st, 2nd, ..., 53th               | 7     |
* |                                 | II      | 01, 02, ..., 53                   | 7     |
* | Day of month                    | d       | 1, 2, ..., 31                     |       |
* |                                 | do      | 1st, 2nd, ..., 31st               | 7     |
* |                                 | dd      | 01, 02, ..., 31                   |       |
* | Day of year                     | D       | 1, 2, ..., 365, 366               | 9     |
* |                                 | Do      | 1st, 2nd, ..., 365th, 366th       | 7     |
* |                                 | DD      | 01, 02, ..., 365, 366             | 9     |
* |                                 | DDD     | 001, 002, ..., 365, 366           |       |
* |                                 | DDDD    | ...                               | 3     |
* | Day of week (formatting)        | E..EEE  | Mon, Tue, Wed, ..., Sun           |       |
* |                                 | EEEE    | Monday, Tuesday, ..., Sunday      | 2     |
* |                                 | EEEEE   | M, T, W, T, F, S, S               |       |
* |                                 | EEEEEE  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
* | ISO day of week (formatting)    | i       | 1, 2, 3, ..., 7                   | 7     |
* |                                 | io      | 1st, 2nd, ..., 7th                | 7     |
* |                                 | ii      | 01, 02, ..., 07                   | 7     |
* |                                 | iii     | Mon, Tue, Wed, ..., Sun           | 7     |
* |                                 | iiii    | Monday, Tuesday, ..., Sunday      | 2,7   |
* |                                 | iiiii   | M, T, W, T, F, S, S               | 7     |
* |                                 | iiiiii  | Mo, Tu, We, Th, Fr, Sa, Su        | 7     |
* | Local day of week (formatting)  | e       | 2, 3, 4, ..., 1                   |       |
* |                                 | eo      | 2nd, 3rd, ..., 1st                | 7     |
* |                                 | ee      | 02, 03, ..., 01                   |       |
* |                                 | eee     | Mon, Tue, Wed, ..., Sun           |       |
* |                                 | eeee    | Monday, Tuesday, ..., Sunday      | 2     |
* |                                 | eeeee   | M, T, W, T, F, S, S               |       |
* |                                 | eeeeee  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
* | Local day of week (stand-alone) | c       | 2, 3, 4, ..., 1                   |       |
* |                                 | co      | 2nd, 3rd, ..., 1st                | 7     |
* |                                 | cc      | 02, 03, ..., 01                   |       |
* |                                 | ccc     | Mon, Tue, Wed, ..., Sun           |       |
* |                                 | cccc    | Monday, Tuesday, ..., Sunday      | 2     |
* |                                 | ccccc   | M, T, W, T, F, S, S               |       |
* |                                 | cccccc  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
* | AM, PM                          | a..aa   | AM, PM                            |       |
* |                                 | aaa     | am, pm                            |       |
* |                                 | aaaa    | a.m., p.m.                        | 2     |
* |                                 | aaaaa   | a, p                              |       |
* | AM, PM, noon, midnight          | b..bb   | AM, PM, noon, midnight            |       |
* |                                 | bbb     | am, pm, noon, midnight            |       |
* |                                 | bbbb    | a.m., p.m., noon, midnight        | 2     |
* |                                 | bbbbb   | a, p, n, mi                       |       |
* | Flexible day period             | B..BBB  | at night, in the morning, ...     |       |
* |                                 | BBBB    | at night, in the morning, ...     | 2     |
* |                                 | BBBBB   | at night, in the morning, ...     |       |
* | Hour [1-12]                     | h       | 1, 2, ..., 11, 12                 |       |
* |                                 | ho      | 1st, 2nd, ..., 11th, 12th         | 7     |
* |                                 | hh      | 01, 02, ..., 11, 12               |       |
* | Hour [0-23]                     | H       | 0, 1, 2, ..., 23                  |       |
* |                                 | Ho      | 0th, 1st, 2nd, ..., 23rd          | 7     |
* |                                 | HH      | 00, 01, 02, ..., 23               |       |
* | Hour [0-11]                     | K       | 1, 2, ..., 11, 0                  |       |
* |                                 | Ko      | 1st, 2nd, ..., 11th, 0th          | 7     |
* |                                 | KK      | 01, 02, ..., 11, 00               |       |
* | Hour [1-24]                     | k       | 24, 1, 2, ..., 23                 |       |
* |                                 | ko      | 24th, 1st, 2nd, ..., 23rd         | 7     |
* |                                 | kk      | 24, 01, 02, ..., 23               |       |
* | Minute                          | m       | 0, 1, ..., 59                     |       |
* |                                 | mo      | 0th, 1st, ..., 59th               | 7     |
* |                                 | mm      | 00, 01, ..., 59                   |       |
* | Second                          | s       | 0, 1, ..., 59                     |       |
* |                                 | so      | 0th, 1st, ..., 59th               | 7     |
* |                                 | ss      | 00, 01, ..., 59                   |       |
* | Fraction of second              | S       | 0, 1, ..., 9                      |       |
* |                                 | SS      | 00, 01, ..., 99                   |       |
* |                                 | SSS     | 000, 001, ..., 999                |       |
* |                                 | SSSS    | ...                               | 3     |
* | Timezone (ISO-8601 w/ Z)        | X       | -08, +0530, Z                     |       |
* |                                 | XX      | -0800, +0530, Z                   |       |
* |                                 | XXX     | -08:00, +05:30, Z                 |       |
* |                                 | XXXX    | -0800, +0530, Z, +123456          | 2     |
* |                                 | XXXXX   | -08:00, +05:30, Z, +12:34:56      |       |
* | Timezone (ISO-8601 w/o Z)       | x       | -08, +0530, +00                   |       |
* |                                 | xx      | -0800, +0530, +0000               |       |
* |                                 | xxx     | -08:00, +05:30, +00:00            | 2     |
* |                                 | xxxx    | -0800, +0530, +0000, +123456      |       |
* |                                 | xxxxx   | -08:00, +05:30, +00:00, +12:34:56 |       |
* | Timezone (GMT)                  | O...OOO | GMT-8, GMT+5:30, GMT+0            |       |
* |                                 | OOOO    | GMT-08:00, GMT+05:30, GMT+00:00   | 2     |
* | Timezone (specific non-locat.)  | z...zzz | GMT-8, GMT+5:30, GMT+0            | 6     |
* |                                 | zzzz    | GMT-08:00, GMT+05:30, GMT+00:00   | 2,6   |
* | Seconds timestamp               | t       | 512969520                         | 7     |
* |                                 | tt      | ...                               | 3,7   |
* | Milliseconds timestamp          | T       | 512969520900                      | 7     |
* |                                 | TT      | ...                               | 3,7   |
* | Long localized date             | P       | 04/29/1453                        | 7     |
* |                                 | PP      | Apr 29, 1453                      | 7     |
* |                                 | PPP     | April 29th, 1453                  | 7     |
* |                                 | PPPP    | Friday, April 29th, 1453          | 2,7   |
* | Long localized time             | p       | 12:00 AM                          | 7     |
* |                                 | pp      | 12:00:00 AM                       | 7     |
* |                                 | ppp     | 12:00:00 AM GMT+2                 | 7     |
* |                                 | pppp    | 12:00:00 AM GMT+02:00             | 2,7   |
* | Combination of date and time    | Pp      | 04/29/1453, 12:00 AM              | 7     |
* |                                 | PPpp    | Apr 29, 1453, 12:00:00 AM         | 7     |
* |                                 | PPPppp  | April 29th, 1453 at ...           | 7     |
* |                                 | PPPPpppp| Friday, April 29th, 1453 at ...   | 2,7   |
* Notes:
* 1. "Formatting" units (e.g. formatting quarter) in the default en-US locale
*    are the same as "stand-alone" units, but are different in some languages.
*    "Formatting" units are declined according to the rules of the language
*    in the context of a date. "Stand-alone" units are always nominative singular:
*
*    `format(new Date(2017, 10, 6), 'do LLLL', {locale: cs}) //=> '6. listopad'`
*
*    `format(new Date(2017, 10, 6), 'do MMMM', {locale: cs}) //=> '6. listopadu'`
*
* 2. Any sequence of the identical letters is a pattern, unless it is escaped by
*    the single quote characters (see below).
*    If the sequence is longer than listed in table (e.g. `EEEEEEEEEEE`)
*    the output will be the same as default pattern for this unit, usually
*    the longest one (in case of ISO weekdays, `EEEE`). Default patterns for units
*    are marked with "2" in the last column of the table.
*
*    `format(new Date(2017, 10, 6), 'MMM') //=> 'Nov'`
*
*    `format(new Date(2017, 10, 6), 'MMMM') //=> 'November'`
*
*    `format(new Date(2017, 10, 6), 'MMMMM') //=> 'N'`
*
*    `format(new Date(2017, 10, 6), 'MMMMMM') //=> 'November'`
*
*    `format(new Date(2017, 10, 6), 'MMMMMMM') //=> 'November'`
*
* 3. Some patterns could be unlimited length (such as `yyyyyyyy`).
*    The output will be padded with zeros to match the length of the pattern.
*
*    `format(new Date(2017, 10, 6), 'yyyyyyyy') //=> '00002017'`
*
* 4. `QQQQQ` and `qqqqq` could be not strictly numerical in some locales.
*    These tokens represent the shortest form of the quarter.
*
* 5. The main difference between `y` and `u` patterns are B.C. years:
*
*    | Year | `y` | `u` |
*    |------|-----|-----|
*    | AC 1 |   1 |   1 |
*    | BC 1 |   1 |   0 |
*    | BC 2 |   2 |  -1 |
*
*    Also `yy` always returns the last two digits of a year,
*    while `uu` pads single digit years to 2 characters and returns other years unchanged:
*
*    | Year | `yy` | `uu` |
*    |------|------|------|
*    | 1    |   01 |   01 |
*    | 14   |   14 |   14 |
*    | 376  |   76 |  376 |
*    | 1453 |   53 | 1453 |
*
*    The same difference is true for local and ISO week-numbering years (`Y` and `R`),
*    except local week-numbering years are dependent on `options.weekStartsOn`
*    and `options.firstWeekContainsDate` (compare [getISOWeekYear](https://date-fns.org/docs/getISOWeekYear)
*    and [getWeekYear](https://date-fns.org/docs/getWeekYear)).
*
* 6. Specific non-location timezones are currently unavailable in `date-fns`,
*    so right now these tokens fall back to GMT timezones.
*
* 7. These patterns are not in the Unicode Technical Standard #35:
*    - `i`: ISO day of week
*    - `I`: ISO week of year
*    - `R`: ISO week-numbering year
*    - `t`: seconds timestamp
*    - `T`: milliseconds timestamp
*    - `o`: ordinal number modifier
*    - `P`: long localized date
*    - `p`: long localized time
*
* 8. `YY` and `YYYY` tokens represent week-numbering years but they are often confused with years.
*    You should enable `options.useAdditionalWeekYearTokens` to use them. See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
*
* 9. `D` and `DD` tokens represent days of the year but they are often confused with days of the month.
*    You should enable `options.useAdditionalDayOfYearTokens` to use them. See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
*
* @param date - The original date
* @param format - The string of tokens
* @param options - An object with options
*
* @returns The formatted date string
*
* @throws `date` must not be Invalid Date
* @throws `options.locale` must contain `localize` property
* @throws `options.locale` must contain `formatLong` property
* @throws use `yyyy` instead of `YYYY` for formatting years using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
* @throws use `yy` instead of `YY` for formatting years using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
* @throws use `d` instead of `D` for formatting days of the month using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
* @throws use `dd` instead of `DD` for formatting days of the month using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
* @throws format string contains an unescaped latin alphabet character
*
* @example
* // Represent 11 February 2014 in middle-endian format:
* const result = format(new Date(2014, 1, 11), 'MM/dd/yyyy')
* //=> '02/11/2014'
*
* @example
* // Represent 2 July 2014 in Esperanto:
* import { eoLocale } from 'date-fns/locale/eo'
* const result = format(new Date(2014, 6, 2), "do 'de' MMMM yyyy", {
*   locale: eoLocale
* })
* //=> '2-a de julio 2014'
*
* @example
* // Escape string by single quote characters:
* const result = format(new Date(2014, 6, 2, 15), "h 'o''clock'")
* //=> "3 o'clock"
*/
function format(date, formatStr, options) {
	const defaultOptions = getDefaultOptions();
	const locale = options?.locale ?? defaultOptions.locale ?? enUS;
	const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions.firstWeekContainsDate ?? defaultOptions.locale?.options?.firstWeekContainsDate ?? 1;
	const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions.weekStartsOn ?? defaultOptions.locale?.options?.weekStartsOn ?? 0;
	const originalDate = toDate(date, options?.in);
	if (!isValid(originalDate)) throw new RangeError("Invalid time value");
	let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
		const firstCharacter = substring[0];
		if (firstCharacter === "p" || firstCharacter === "P") {
			const longFormatter = longFormatters[firstCharacter];
			return longFormatter(substring, locale.formatLong);
		}
		return substring;
	}).join("").match(formattingTokensRegExp).map((substring) => {
		if (substring === "''") return {
			isToken: false,
			value: "'"
		};
		const firstCharacter = substring[0];
		if (firstCharacter === "'") return {
			isToken: false,
			value: cleanEscapedString(substring)
		};
		if (formatters[firstCharacter]) return {
			isToken: true,
			value: substring
		};
		if (firstCharacter.match(unescapedLatinCharacterRegExp)) throw new RangeError("Format string contains an unescaped latin alphabet character `" + firstCharacter + "`");
		return {
			isToken: false,
			value: substring
		};
	});
	if (locale.localize.preprocessor) parts = locale.localize.preprocessor(originalDate, parts);
	const formatterOptions = {
		firstWeekContainsDate,
		weekStartsOn,
		locale
	};
	return parts.map((part) => {
		if (!part.isToken) return part.value;
		const token = part.value;
		if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) warnOrThrowProtectedError(token, formatStr, String(date));
		const formatter = formatters[token[0]];
		return formatter(originalDate, token, locale.localize, formatterOptions);
	}).join("");
}
function cleanEscapedString(input) {
	const matched = input.match(escapedStringRegExp);
	if (!matched) return input;
	return matched[1].replace(doubleQuoteRegExp, "'");
}
var formattingTokensRegExp, longFormattingTokensRegExp, escapedStringRegExp, doubleQuoteRegExp, unescapedLatinCharacterRegExp;
var init_format = __esmMin((() => {
	init_defaultLocale();
	init_defaultOptions();
	init_formatters();
	init_longFormatters();
	init_protectedTokens();
	init_isValid();
	init_toDate();
	formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
	longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
	escapedStringRegExp = /^'([^]*?)'?$/;
	doubleQuoteRegExp = /''/g;
	unescapedLatinCharacterRegExp = /[a-zA-Z]/;
}));
//#endregion
//#region node_modules/date-fns/formatDistance.js
var init_formatDistance = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatDistanceStrict.js
var init_formatDistanceStrict = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatDistanceToNow.js
var init_formatDistanceToNow = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatDistanceToNowStrict.js
var init_formatDistanceToNowStrict = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatDuration.js
var init_formatDuration = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatISO.js
var init_formatISO = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatISO9075.js
var init_formatISO9075 = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatISODuration.js
var init_formatISODuration = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatRFC3339.js
var init_formatRFC3339 = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatRFC7231.js
var init_formatRFC7231 = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/formatRelative.js
var init_formatRelative = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/fromUnixTime.js
var init_fromUnixTime = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getDate.js
var init_getDate = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getDay.js
var init_getDay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getDaysInMonth.js
var init_getDaysInMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isLeapYear.js
var init_isLeapYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getDaysInYear.js
var init_getDaysInYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getDecade.js
var init_getDecade = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getDefaultOptions.js
var init_getDefaultOptions = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getHours.js
var init_getHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getISODay.js
var init_getISODay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getISOWeeksInYear.js
var init_getISOWeeksInYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getMilliseconds.js
var init_getMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getMinutes.js
var init_getMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getMonth.js
var init_getMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getOverlappingDaysInIntervals.js
var init_getOverlappingDaysInIntervals = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getSeconds.js
var init_getSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getTime.js
var init_getTime = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getUnixTime.js
var init_getUnixTime = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getWeekOfMonth.js
var init_getWeekOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfMonth.js
var init_lastDayOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getWeeksInMonth.js
var init_getWeeksInMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/getYear.js
var init_getYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/hoursToMilliseconds.js
var init_hoursToMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/hoursToMinutes.js
var init_hoursToMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/hoursToSeconds.js
var init_hoursToSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/interval.js
var init_interval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/intervalToDuration.js
var init_intervalToDuration = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/intlFormat.js
var init_intlFormat = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/intlFormatDistance.js
var init_intlFormatDistance = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isAfter.js
var init_isAfter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isBefore.js
var init_isBefore = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isEqual.js
var init_isEqual = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isExists.js
var init_isExists = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isFirstDayOfMonth.js
var init_isFirstDayOfMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isFriday.js
var init_isFriday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isFuture.js
var init_isFuture = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/transpose.js
var init_transpose = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setWeek.js
var init_setWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setISOWeek.js
var init_setISOWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setDay.js
var init_setDay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setISODay.js
var init_setISODay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/parse.js
var init_parse = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isMatch.js
var init_isMatch = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isMonday.js
var init_isMonday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isPast.js
var init_isPast = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfHour.js
var init_startOfHour = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameHour.js
var init_isSameHour = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameWeek.js
var init_isSameWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameISOWeek.js
var init_isSameISOWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameISOWeekYear.js
var init_isSameISOWeekYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfMinute.js
var init_startOfMinute = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameMinute.js
var init_isSameMinute = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameMonth.js
var init_isSameMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameQuarter.js
var init_isSameQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfSecond.js
var init_startOfSecond = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameSecond.js
var init_isSameSecond = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isSameYear.js
var init_isSameYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisHour.js
var init_isThisHour = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisISOWeek.js
var init_isThisISOWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisMinute.js
var init_isThisMinute = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisMonth.js
var init_isThisMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisQuarter.js
var init_isThisQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisSecond.js
var init_isThisSecond = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisWeek.js
var init_isThisWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThisYear.js
var init_isThisYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isThursday.js
var init_isThursday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isToday.js
var init_isToday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isTomorrow.js
var init_isTomorrow = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isTuesday.js
var init_isTuesday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isWednesday.js
var init_isWednesday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isWithinInterval.js
var init_isWithinInterval = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subDays.js
var init_subDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/isYesterday.js
var init_isYesterday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfDecade.js
var init_lastDayOfDecade = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfWeek.js
var init_lastDayOfWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfISOWeek.js
var init_lastDayOfISOWeek = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfISOWeekYear.js
var init_lastDayOfISOWeekYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfQuarter.js
var init_lastDayOfQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lastDayOfYear.js
var init_lastDayOfYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/lightFormat.js
var init_lightFormat = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/milliseconds.js
var init_milliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/millisecondsToHours.js
var init_millisecondsToHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/millisecondsToMinutes.js
var init_millisecondsToMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/millisecondsToSeconds.js
var init_millisecondsToSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/minutesToHours.js
var init_minutesToHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/minutesToMilliseconds.js
var init_minutesToMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/minutesToSeconds.js
var init_minutesToSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/monthsToQuarters.js
var init_monthsToQuarters = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/monthsToYears.js
var init_monthsToYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextDay.js
var init_nextDay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextFriday.js
var init_nextFriday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextMonday.js
var init_nextMonday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextSaturday.js
var init_nextSaturday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextSunday.js
var init_nextSunday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextThursday.js
var init_nextThursday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextTuesday.js
var init_nextTuesday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/nextWednesday.js
var init_nextWednesday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/parseISO.js
var init_parseISO = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/parseJSON.js
var init_parseJSON = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousDay.js
var init_previousDay = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousFriday.js
var init_previousFriday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousMonday.js
var init_previousMonday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousSaturday.js
var init_previousSaturday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousSunday.js
var init_previousSunday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousThursday.js
var init_previousThursday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousTuesday.js
var init_previousTuesday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/previousWednesday.js
var init_previousWednesday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/quartersToMonths.js
var init_quartersToMonths = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/quartersToYears.js
var init_quartersToYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/roundToNearestHours.js
var init_roundToNearestHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/roundToNearestMinutes.js
var init_roundToNearestMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/secondsToHours.js
var init_secondsToHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/secondsToMilliseconds.js
var init_secondsToMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/secondsToMinutes.js
var init_secondsToMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setMonth.js
var init_setMonth = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/set.js
var init_set = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setDate.js
var init_setDate = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setDayOfYear.js
var init_setDayOfYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setDefaultOptions.js
var init_setDefaultOptions = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setHours.js
var init_setHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setMilliseconds.js
var init_setMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setMinutes.js
var init_setMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setQuarter.js
var init_setQuarter = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setSeconds.js
var init_setSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setWeekYear.js
var init_setWeekYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/setYear.js
var init_setYear = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfDecade.js
var init_startOfDecade = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfToday.js
var init_startOfToday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfTomorrow.js
var init_startOfTomorrow = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/startOfYesterday.js
var init_startOfYesterday = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subMonths.js
var init_subMonths = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/sub.js
var init_sub = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subBusinessDays.js
var init_subBusinessDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subHours.js
var init_subHours = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subMilliseconds.js
var init_subMilliseconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subMinutes.js
var init_subMinutes = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subQuarters.js
var init_subQuarters = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subSeconds.js
var init_subSeconds = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subWeeks.js
var init_subWeeks = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/subYears.js
var init_subYears = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/weeksToDays.js
var init_weeksToDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/yearsToDays.js
var init_yearsToDays = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/yearsToMonths.js
var init_yearsToMonths = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/yearsToQuarters.js
var init_yearsToQuarters = __esmMin((() => {}));
//#endregion
//#region node_modules/date-fns/index.js
var init_date_fns = __esmMin((() => {
	init_add();
	init_addBusinessDays();
	init_addDays();
	init_addHours();
	init_addISOWeekYears();
	init_addMilliseconds();
	init_addMinutes();
	init_addMonths();
	init_addQuarters();
	init_addSeconds();
	init_addWeeks();
	init_addYears();
	init_areIntervalsOverlapping();
	init_clamp();
	init_closestIndexTo();
	init_closestTo();
	init_compareAsc();
	init_compareDesc();
	init_constructFrom();
	init_constructNow();
	init_daysToWeeks();
	init_differenceInBusinessDays();
	init_differenceInCalendarDays();
	init_differenceInCalendarISOWeekYears();
	init_differenceInCalendarISOWeeks();
	init_differenceInCalendarMonths();
	init_differenceInCalendarQuarters();
	init_differenceInCalendarWeeks();
	init_differenceInCalendarYears();
	init_differenceInDays();
	init_differenceInHours();
	init_differenceInISOWeekYears();
	init_differenceInMilliseconds();
	init_differenceInMinutes();
	init_differenceInMonths();
	init_differenceInQuarters();
	init_differenceInSeconds();
	init_differenceInWeeks();
	init_differenceInYears();
	init_eachDayOfInterval();
	init_eachHourOfInterval();
	init_eachMinuteOfInterval();
	init_eachMonthOfInterval();
	init_eachQuarterOfInterval();
	init_eachWeekOfInterval();
	init_eachWeekendOfInterval();
	init_eachWeekendOfMonth();
	init_eachWeekendOfYear();
	init_eachYearOfInterval();
	init_endOfDay();
	init_endOfDecade();
	init_endOfHour();
	init_endOfISOWeek();
	init_endOfISOWeekYear();
	init_endOfMinute();
	init_endOfMonth();
	init_endOfQuarter();
	init_endOfSecond();
	init_endOfToday();
	init_endOfTomorrow();
	init_endOfWeek();
	init_endOfYear();
	init_endOfYesterday();
	init_format();
	init_formatDistance();
	init_formatDistanceStrict();
	init_formatDistanceToNow();
	init_formatDistanceToNowStrict();
	init_formatDuration();
	init_formatISO();
	init_formatISO9075();
	init_formatISODuration();
	init_formatRFC3339();
	init_formatRFC7231();
	init_formatRelative();
	init_fromUnixTime();
	init_getDate();
	init_getDay();
	init_getDayOfYear();
	init_getDaysInMonth();
	init_getDaysInYear();
	init_getDecade();
	init_getDefaultOptions();
	init_getHours();
	init_getISODay();
	init_getISOWeek();
	init_getISOWeekYear();
	init_getISOWeeksInYear();
	init_getMilliseconds();
	init_getMinutes();
	init_getMonth();
	init_getOverlappingDaysInIntervals();
	init_getQuarter();
	init_getSeconds();
	init_getTime();
	init_getUnixTime();
	init_getWeek();
	init_getWeekOfMonth();
	init_getWeekYear();
	init_getWeeksInMonth();
	init_getYear();
	init_hoursToMilliseconds();
	init_hoursToMinutes();
	init_hoursToSeconds();
	init_interval();
	init_intervalToDuration();
	init_intlFormat();
	init_intlFormatDistance();
	init_isAfter();
	init_isBefore();
	init_isDate();
	init_isEqual();
	init_isExists();
	init_isFirstDayOfMonth();
	init_isFriday();
	init_isFuture();
	init_isLastDayOfMonth();
	init_isLeapYear();
	init_isMatch();
	init_isMonday();
	init_isPast();
	init_isSameDay();
	init_isSameHour();
	init_isSameISOWeek();
	init_isSameISOWeekYear();
	init_isSameMinute();
	init_isSameMonth();
	init_isSameQuarter();
	init_isSameSecond();
	init_isSameWeek();
	init_isSameYear();
	init_isSaturday();
	init_isSunday();
	init_isThisHour();
	init_isThisISOWeek();
	init_isThisMinute();
	init_isThisMonth();
	init_isThisQuarter();
	init_isThisSecond();
	init_isThisWeek();
	init_isThisYear();
	init_isThursday();
	init_isToday();
	init_isTomorrow();
	init_isTuesday();
	init_isValid();
	init_isWednesday();
	init_isWeekend();
	init_isWithinInterval();
	init_isYesterday();
	init_lastDayOfDecade();
	init_lastDayOfISOWeek();
	init_lastDayOfISOWeekYear();
	init_lastDayOfMonth();
	init_lastDayOfQuarter();
	init_lastDayOfWeek();
	init_lastDayOfYear();
	init_lightFormat();
	init_max();
	init_milliseconds();
	init_millisecondsToHours();
	init_millisecondsToMinutes();
	init_millisecondsToSeconds();
	init_min();
	init_minutesToHours();
	init_minutesToMilliseconds();
	init_minutesToSeconds();
	init_monthsToQuarters();
	init_monthsToYears();
	init_nextDay();
	init_nextFriday();
	init_nextMonday();
	init_nextSaturday();
	init_nextSunday();
	init_nextThursday();
	init_nextTuesday();
	init_nextWednesday();
	init_parse();
	init_parseISO();
	init_parseJSON();
	init_previousDay();
	init_previousFriday();
	init_previousMonday();
	init_previousSaturday();
	init_previousSunday();
	init_previousThursday();
	init_previousTuesday();
	init_previousWednesday();
	init_quartersToMonths();
	init_quartersToYears();
	init_roundToNearestHours();
	init_roundToNearestMinutes();
	init_secondsToHours();
	init_secondsToMilliseconds();
	init_secondsToMinutes();
	init_set();
	init_setDate();
	init_setDay();
	init_setDayOfYear();
	init_setDefaultOptions();
	init_setHours();
	init_setISODay();
	init_setISOWeek();
	init_setISOWeekYear();
	init_setMilliseconds();
	init_setMinutes();
	init_setMonth();
	init_setQuarter();
	init_setSeconds();
	init_setWeek();
	init_setWeekYear();
	init_setYear();
	init_startOfDay();
	init_startOfDecade();
	init_startOfHour();
	init_startOfISOWeek();
	init_startOfISOWeekYear();
	init_startOfMinute();
	init_startOfMonth();
	init_startOfQuarter();
	init_startOfSecond();
	init_startOfToday();
	init_startOfTomorrow();
	init_startOfWeek();
	init_startOfWeekYear();
	init_startOfYear();
	init_startOfYesterday();
	init_sub();
	init_subBusinessDays();
	init_subDays();
	init_subHours();
	init_subISOWeekYears();
	init_subMilliseconds();
	init_subMinutes();
	init_subMonths();
	init_subQuarters();
	init_subSeconds();
	init_subWeeks();
	init_subYears();
	init_toDate();
	init_transpose();
	init_weeksToDays();
	init_yearsToDays();
	init_yearsToMonths();
	init_yearsToQuarters();
}));
//#endregion
//#region electron/services/storage.ts
var StorageService, storage;
var init_storage = __esmMin((() => {
	init_logger();
	init_date_fns();
	StorageService = class {
		constructor() {
			this.baseDir = path.default.join(os.default.homedir(), "Documents", "SecOpsScans");
			this.reportsDir = path.default.join(this.baseDir, "reports");
			this.init();
		}
		init() {
			if (!fs.default.existsSync(this.reportsDir)) fs.default.mkdirSync(this.reportsDir, { recursive: true });
		}
		createScanDirectory(domain) {
			const timestamp = format(/* @__PURE__ */ new Date(), "yyyyMMdd_HHmmss");
			const scanId = `${domain.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${timestamp}`;
			const scanDir = path.default.join(this.reportsDir, scanId);
			const nucleiDir = path.default.join(scanDir, "nuclei");
			const wapitiDir = path.default.join(scanDir, "wapiti");
			const logsDir = path.default.join(scanDir, "logs");
			fs.default.mkdirSync(nucleiDir, { recursive: true });
			fs.default.mkdirSync(wapitiDir, { recursive: true });
			fs.default.mkdirSync(logsDir, { recursive: true });
			logger.info(`Created scan directory for ${scanId}`);
			return {
				scanId,
				scanDir,
				nucleiDir,
				wapitiDir
			};
		}
		saveMetadata(scanId, data) {
			const filePath = path.default.join(this.reportsDir, scanId, "scan_metadata.json");
			fs.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
		}
		getHistory() {
			if (!fs.default.existsSync(this.reportsDir)) return [];
			const scans = fs.default.readdirSync(this.reportsDir);
			const history = [];
			for (const scanId of scans) {
				const metaPath = path.default.join(this.reportsDir, scanId, "scan_metadata.json");
				if (fs.default.existsSync(metaPath)) try {
					const meta = JSON.parse(fs.default.readFileSync(metaPath, "utf8"));
					history.push(meta);
				} catch (e) {
					logger.error(`Failed to parse metadata for ${scanId}`, e);
				}
			}
			return history.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
		}
		openFolder(scanId) {
			const folderPath = path.default.join(this.reportsDir, scanId);
			if (fs.default.existsSync(folderPath)) electron.shell.showItemInFolder(folderPath);
		}
		/** Update the status in the persisted metadata file.
		*  If `scanner` is provided, sets e.g. nucleiStatus / wapitiStatus.
		*  Always re-evaluates the overall `status` field. */
		updateStatus(scanId, scanner, status) {
			const metaPath = path.default.join(this.reportsDir, scanId, "scan_metadata.json");
			if (!fs.default.existsSync(metaPath)) return;
			try {
				const meta = JSON.parse(fs.default.readFileSync(metaPath, "utf8"));
				if (scanner) meta[`${scanner}Status`] = status;
				const tools = meta.config?.tools || [];
				const terminal = [
					"COMPLETED",
					"FAILED",
					"STOPPED"
				];
				let allTerminal = true;
				let anyFailed = false;
				for (const t of tools) {
					const tStatus = meta[`${t}Status`] || "RUNNING";
					if (!terminal.includes(tStatus)) allTerminal = false;
					if (tStatus === "FAILED") anyFailed = true;
				}
				if (status === "STOPPED") {
					meta.status = "STOPPED";
					meta.endTime = (/* @__PURE__ */ new Date()).toISOString();
				} else if (allTerminal && tools.length > 0) {
					meta.status = anyFailed ? "FAILED" : "COMPLETED";
					meta.endTime = (/* @__PURE__ */ new Date()).toISOString();
				}
				fs.default.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
			} catch (err) {
				logger.error(`Failed to update status for ${scanId}`, err);
			}
		}
	};
	storage = new StorageService();
}));
//#endregion
//#region electron/services/settings.ts
var settings_exports = /* @__PURE__ */ __exportAll({ settingsStore: () => settingsStore });
var DEFAULTS, SENSITIVE_FIELDS, SettingsStore, settingsStore;
var init_settings = __esmMin((() => {
	init_logger();
	DEFAULTS = {
		nucleiPath: "nuclei",
		wapitiPath: "wapiti",
		subfinderPath: "subfinder",
		httpxPath: "httpx",
		nmapPath: "nmap",
		zapPath: "zap.bat",
		katanaPath: "katana",
		ffufPath: "ffuf",
		naabuPath: "naabu",
		dnsxPath: "dnsx",
		tlsxPath: "tlsx",
		alterxPath: "alterx",
		appscanPath: "C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe",
		netsparkerPath: "C:\\Program Files (x86)\\Invicti Professional Edition\\Netsparker.exe",
		acunetixUrl: "https://127.0.0.1:13443",
		acunetixApiKey: "",
		acunetixEmail: "",
		acunetixPassword: "",
		acunetixProfileId: "11111111-1111-1111-1111-111111111111",
		wordlistPath: "",
		aiProvider: "ollama",
		aiApiKey: "",
		wpscanApiToken: ""
	};
	SENSITIVE_FIELDS = [
		"acunetixApiKey",
		"acunetixPassword",
		"aiApiKey",
		"wpscanApiToken"
	];
	SettingsStore = class {
		constructor() {
			this.cache = null;
			this.filePath = path.default.join(os.default.homedir(), "Documents", "SecOpsScans", "settings.json");
		}
		encryptField(value) {
			if (!value) return value;
			if (electron.safeStorage && electron.safeStorage.isEncryptionAvailable()) try {
				return electron.safeStorage.encryptString(value).toString("base64");
			} catch (e) {
				logger.error("Failed to encrypt field", e);
			}
			return value;
		}
		decryptField(value) {
			if (!value) return value;
			if (electron.safeStorage && electron.safeStorage.isEncryptionAvailable()) try {
				if (value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) return electron.safeStorage.decryptString(Buffer.from(value, "base64"));
			} catch (e) {
				return value;
			}
			return value;
		}
		get() {
			if (this.cache) return this.cache;
			try {
				if (fs.default.existsSync(this.filePath)) {
					const raw = fs.default.readFileSync(this.filePath, "utf8");
					const parsed = JSON.parse(raw);
					SENSITIVE_FIELDS.forEach((field) => {
						if (parsed[field]) parsed[field] = this.decryptField(parsed[field]);
					});
					this.cache = {
						...DEFAULTS,
						...parsed
					};
					return this.cache;
				}
			} catch (err) {
				logger.error("Failed to read settings", err);
			}
			this.cache = { ...DEFAULTS };
			return this.cache;
		}
		save(settings) {
			const merged = {
				...this.get(),
				...settings
			};
			this.cache = merged;
			try {
				const dir = path.default.dirname(this.filePath);
				if (!fs.default.existsSync(dir)) fs.default.mkdirSync(dir, { recursive: true });
				const toSave = { ...merged };
				SENSITIVE_FIELDS.forEach((field) => {
					if (toSave[field]) toSave[field] = this.encryptField(toSave[field]);
				});
				fs.default.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2));
				logger.info("Settings saved securely");
			} catch (err) {
				logger.error("Failed to save settings", err);
			}
			return merged;
		}
	};
	settingsStore = new SettingsStore();
}));
//#endregion
//#region node_modules/fast-xml-parser/lib/fxp.cjs
var require_fxp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(() => {
		"use strict";
		var t = {
			d: (e, n) => {
				for (var i in n) t.o(n, i) && !t.o(e, i) && Object.defineProperty(e, i, {
					enumerable: !0,
					get: n[i]
				});
			},
			o: (t, e) => Object.prototype.hasOwnProperty.call(t, e),
			r: (t) => {
				"undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(t, "__esModule", { value: !0 });
			}
		}, e = {};
		t.r(e), t.d(e, {
			XMLBuilder: () => ie,
			XMLParser: () => Lt,
			XMLValidator: () => se
		});
		const i = /* @__PURE__ */ new RegExp("^[:A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$");
		function s(t, e) {
			const n = [];
			let i = e.exec(t);
			for (; i;) {
				const s = [];
				s.startIndex = e.lastIndex - i[0].length;
				const r = i.length;
				for (let t = 0; t < r; t++) s.push(i[t]);
				n.push(s), i = e.exec(t);
			}
			return n;
		}
		const r = function(t) {
			return !(null == i.exec(t));
		}, o = [
			"hasOwnProperty",
			"toString",
			"valueOf",
			"__defineGetter__",
			"__defineSetter__",
			"__lookupGetter__",
			"__lookupSetter__"
		], a = [
			"__proto__",
			"constructor",
			"prototype"
		], h = {
			allowBooleanAttributes: !1,
			unpairedTags: []
		};
		function l(t, e) {
			e = Object.assign({}, h, e);
			const n = [];
			let i = !1, s = !1;
			"﻿" === t[0] && (t = t.substr(1));
			for (let r = 0; r < t.length; r++) if ("<" === t[r] && "?" === t[r + 1]) {
				if (r += 2, r = p(t, r), r.err) return r;
			} else {
				if ("<" !== t[r]) {
					if (u(t[r])) continue;
					return b("InvalidChar", "char '" + t[r] + "' is not expected.", w(t, r));
				}
				{
					let o = r;
					if (r++, "!" === t[r]) {
						r = c(t, r);
						continue;
					}
					{
						let a = !1;
						"/" === t[r] && (a = !0, r++);
						let h = "";
						for (; r < t.length && ">" !== t[r] && " " !== t[r] && "	" !== t[r] && "\n" !== t[r] && "\r" !== t[r]; r++) h += t[r];
						if (h = h.trim(), "/" === h[h.length - 1] && (h = h.substring(0, h.length - 1), r--), !E(h)) {
							let e;
							return e = 0 === h.trim().length ? "Invalid space after '<'." : "Tag '" + h + "' is an invalid name.", b("InvalidTag", e, w(t, r));
						}
						const l = g(t, r);
						if (!1 === l) return b("InvalidAttr", "Attributes for '" + h + "' have open quote.", w(t, r));
						let d = l.value;
						if (r = l.index, "/" === d[d.length - 1]) {
							const n = r - d.length;
							d = d.substring(0, d.length - 1);
							const s = x(d, e);
							if (!0 !== s) return b(s.err.code, s.err.msg, w(t, n + s.err.line));
							i = !0;
						} else if (a) {
							if (!l.tagClosed) return b("InvalidTag", "Closing tag '" + h + "' doesn't have proper closing.", w(t, r));
							if (d.trim().length > 0) return b("InvalidTag", "Closing tag '" + h + "' can't have attributes or invalid starting.", w(t, o));
							if (0 === n.length) return b("InvalidTag", "Closing tag '" + h + "' has not been opened.", w(t, o));
							{
								const e = n.pop();
								if (h !== e.tagName) {
									let n = w(t, e.tagStartPos);
									return b("InvalidTag", "Expected closing tag '" + e.tagName + "' (opened in line " + n.line + ", col " + n.col + ") instead of closing tag '" + h + "'.", w(t, o));
								}
								0 == n.length && (s = !0);
							}
						} else {
							const a = x(d, e);
							if (!0 !== a) return b(a.err.code, a.err.msg, w(t, r - d.length + a.err.line));
							if (!0 === s) return b("InvalidXml", "Multiple possible root nodes found.", w(t, r));
							-1 !== e.unpairedTags.indexOf(h) || n.push({
								tagName: h,
								tagStartPos: o
							}), i = !0;
						}
						for (r++; r < t.length; r++) if ("<" === t[r]) {
							if ("!" === t[r + 1]) {
								r++, r = c(t, r);
								continue;
							}
							if ("?" !== t[r + 1]) break;
							if (r = p(t, ++r), r.err) return r;
						} else if ("&" === t[r]) {
							const e = N(t, r);
							if (-1 == e) return b("InvalidChar", "char '&' is not expected.", w(t, r));
							r = e;
						} else if (!0 === s && !u(t[r])) return b("InvalidXml", "Extra text at the end", w(t, r));
						"<" === t[r] && r--;
					}
				}
			}
			return i ? 1 == n.length ? b("InvalidTag", "Unclosed tag '" + n[0].tagName + "'.", w(t, n[0].tagStartPos)) : !(n.length > 0) || b("InvalidXml", "Invalid '" + JSON.stringify(n.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", {
				line: 1,
				col: 1
			}) : b("InvalidXml", "Start tag expected.", 1);
		}
		function u(t) {
			return " " === t || "	" === t || "\n" === t || "\r" === t;
		}
		function p(t, e) {
			const n = e;
			for (; e < t.length; e++) if ("?" == t[e] || " " == t[e]) {
				const i = t.substr(n, e - n);
				if (e > 5 && "xml" === i) return b("InvalidXml", "XML declaration allowed only at the start of the document.", w(t, e));
				if ("?" == t[e] && ">" == t[e + 1]) {
					e++;
					break;
				}
				continue;
			}
			return e;
		}
		function c(t, e) {
			if (t.length > e + 5 && "-" === t[e + 1] && "-" === t[e + 2]) {
				for (e += 3; e < t.length; e++) if ("-" === t[e] && "-" === t[e + 1] && ">" === t[e + 2]) {
					e += 2;
					break;
				}
			} else if (t.length > e + 8 && "D" === t[e + 1] && "O" === t[e + 2] && "C" === t[e + 3] && "T" === t[e + 4] && "Y" === t[e + 5] && "P" === t[e + 6] && "E" === t[e + 7]) {
				let n = 1;
				for (e += 8; e < t.length; e++) if ("<" === t[e]) n++;
				else if (">" === t[e] && (n--, 0 === n)) break;
			} else if (t.length > e + 9 && "[" === t[e + 1] && "C" === t[e + 2] && "D" === t[e + 3] && "A" === t[e + 4] && "T" === t[e + 5] && "A" === t[e + 6] && "[" === t[e + 7]) {
				for (e += 8; e < t.length; e++) if ("]" === t[e] && "]" === t[e + 1] && ">" === t[e + 2]) {
					e += 2;
					break;
				}
			}
			return e;
		}
		const d = "\"", f = "'";
		function g(t, e) {
			let n = "", i = "", s = !1;
			for (; e < t.length; e++) {
				if (t[e] === d || t[e] === f) "" === i ? i = t[e] : i !== t[e] || (i = "");
				else if (">" === t[e] && "" === i) {
					s = !0;
					break;
				}
				n += t[e];
			}
			return "" === i && {
				value: n,
				index: e,
				tagClosed: s
			};
		}
		const m = /* @__PURE__ */ new RegExp("(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['\"])(([\\s\\S])*?)\\5)?", "g");
		function x(t, e) {
			const n = s(t, m), i = {};
			for (let t = 0; t < n.length; t++) {
				if (0 === n[t][1].length) return b("InvalidAttr", "Attribute '" + n[t][2] + "' has no space in starting.", v(n[t]));
				if (void 0 !== n[t][3] && void 0 === n[t][4]) return b("InvalidAttr", "Attribute '" + n[t][2] + "' is without value.", v(n[t]));
				if (void 0 === n[t][3] && !e.allowBooleanAttributes) return b("InvalidAttr", "boolean attribute '" + n[t][2] + "' is not allowed.", v(n[t]));
				const s = n[t][2];
				if (!y(s)) return b("InvalidAttr", "Attribute '" + s + "' is an invalid name.", v(n[t]));
				if (Object.prototype.hasOwnProperty.call(i, s)) return b("InvalidAttr", "Attribute '" + s + "' is repeated.", v(n[t]));
				i[s] = 1;
			}
			return !0;
		}
		function N(t, e) {
			if (";" === t[++e]) return -1;
			if ("#" === t[e]) return function(t, e) {
				let n = /\d/;
				for ("x" === t[e] && (e++, n = /[\da-fA-F]/); e < t.length; e++) {
					if (";" === t[e]) return e;
					if (!t[e].match(n)) break;
				}
				return -1;
			}(t, ++e);
			let n = 0;
			for (; e < t.length; e++, n++) if (!(t[e].match(/\w/) && n < 20)) {
				if (";" === t[e]) break;
				return -1;
			}
			return e;
		}
		function b(t, e, n) {
			return { err: {
				code: t,
				msg: e,
				line: n.line || n,
				col: n.col
			} };
		}
		function y(t) {
			return r(t);
		}
		function E(t) {
			return r(t);
		}
		function w(t, e) {
			const n = t.substring(0, e).split(/\r?\n/);
			return {
				line: n.length,
				col: n[n.length - 1].length + 1
			};
		}
		function v(t) {
			return t.startIndex + t[1].length;
		}
		const S = (t) => o.includes(t) ? "__" + t : t, _ = {
			preserveOrder: !1,
			attributeNamePrefix: "@_",
			attributesGroupName: !1,
			textNodeName: "#text",
			ignoreAttributes: !0,
			removeNSPrefix: !1,
			allowBooleanAttributes: !1,
			parseTagValue: !0,
			parseAttributeValue: !1,
			trimValues: !0,
			cdataPropName: !1,
			numberParseOptions: {
				hex: !0,
				leadingZeros: !0,
				eNotation: !0
			},
			tagValueProcessor: function(t, e) {
				return e;
			},
			attributeValueProcessor: function(t, e) {
				return e;
			},
			stopNodes: [],
			alwaysCreateTextNode: !1,
			isArray: () => !1,
			commentPropName: !1,
			unpairedTags: [],
			processEntities: !0,
			htmlEntities: !1,
			entityDecoder: null,
			ignoreDeclaration: !1,
			ignorePiTags: !1,
			transformTagName: !1,
			transformAttributeName: !1,
			updateTag: function(t, e, n) {
				return t;
			},
			captureMetaData: !1,
			maxNestedTags: 100,
			strictReservedNames: !0,
			jPath: !0,
			onDangerousProperty: S
		};
		function A(t, e) {
			if ("string" != typeof t) return;
			const n = t.toLowerCase();
			if (o.some((t) => n === t.toLowerCase())) throw new Error(`[SECURITY] Invalid ${e}: "${t}" is a reserved JavaScript keyword that could cause prototype pollution`);
			if (a.some((t) => n === t.toLowerCase())) throw new Error(`[SECURITY] Invalid ${e}: "${t}" is a reserved JavaScript keyword that could cause prototype pollution`);
		}
		function T(t, e) {
			return "boolean" == typeof t ? {
				enabled: t,
				maxEntitySize: 1e4,
				maxExpansionDepth: 1e4,
				maxTotalExpansions: Infinity,
				maxExpandedLength: 1e5,
				maxEntityCount: 1e3,
				allowedTags: null,
				tagFilter: null,
				appliesTo: "all"
			} : "object" == typeof t && null !== t ? {
				enabled: !1 !== t.enabled,
				maxEntitySize: Math.max(1, t.maxEntitySize ?? 1e4),
				maxExpansionDepth: Math.max(1, t.maxExpansionDepth ?? 1e4),
				maxTotalExpansions: Math.max(1, t.maxTotalExpansions ?? Infinity),
				maxExpandedLength: Math.max(1, t.maxExpandedLength ?? 1e5),
				maxEntityCount: Math.max(1, t.maxEntityCount ?? 1e3),
				allowedTags: t.allowedTags ?? null,
				tagFilter: t.tagFilter ?? null,
				appliesTo: t.appliesTo ?? "all"
			} : T(!0);
		}
		const C = function(t) {
			const e = Object.assign({}, _, t), n = [
				{
					value: e.attributeNamePrefix,
					name: "attributeNamePrefix"
				},
				{
					value: e.attributesGroupName,
					name: "attributesGroupName"
				},
				{
					value: e.textNodeName,
					name: "textNodeName"
				},
				{
					value: e.cdataPropName,
					name: "cdataPropName"
				},
				{
					value: e.commentPropName,
					name: "commentPropName"
				}
			];
			for (const { value: t, name: e } of n) t && A(t, e);
			return null === e.onDangerousProperty && (e.onDangerousProperty = S), e.processEntities = T(e.processEntities, e.htmlEntities), e.unpairedTagsSet = new Set(e.unpairedTags), e.stopNodes && Array.isArray(e.stopNodes) && (e.stopNodes = e.stopNodes.map((t) => "string" == typeof t && t.startsWith("*.") ? ".." + t.substring(2) : t)), e;
		};
		let P;
		P = "function" != typeof Symbol ? "@@xmlMetadata" : Symbol("XML Node Metadata");
		class $ {
			constructor(t) {
				this.tagname = t, this.child = [], this[":@"] = Object.create(null);
			}
			add(t, e) {
				"__proto__" === t && (t = "#__proto__"), this.child.push({ [t]: e });
			}
			addChild(t, e) {
				"__proto__" === t.tagname && (t.tagname = "#__proto__"), t[":@"] && Object.keys(t[":@"]).length > 0 ? this.child.push({
					[t.tagname]: t.child,
					":@": t[":@"]
				}) : this.child.push({ [t.tagname]: t.child }), void 0 !== e && (this.child[this.child.length - 1][P] = { startIndex: e });
			}
			static getMetaDataSymbol() {
				return P;
			}
		}
		const O = ":A-Za-z_À-ÖØ-öø-˿Ͱ-ͽͿ-҆҈-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�", I = ":A-Za-z_À-˿Ͱ-ͽͿ-҆҈-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�𐀀-󯿿", V = ":A-Za-z_À-˿Ͱ-ͽͿ-҆҈-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�𐀀-󯿿\\-\\.\\d·̀-ͯ҇‿-⁀", D = (t, e, n = "") => {
			const i = `[${t.replace(":", "")}][${e.replace(":", "")}]*`;
			return {
				name: new RegExp(`^[${t}][${e}]*$`, n),
				ncName: new RegExp(`^${i}$`, n),
				qName: new RegExp(`^${i}(?::${i})?$`, n),
				nmToken: new RegExp(`^[${e}]+$`, n),
				nmTokens: new RegExp(`^[${e}]+(?:\\s+[${e}]+)*$`, n)
			};
		}, M = D(O, ":A-Za-z_À-ÖØ-öø-˿Ͱ-ͽͿ-҆҈-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�\\-\\.\\d·̀-ͯ‿-⁀"), j = D(I, V, "u"), L = (t, { xmlVersion: e = "1.0" } = {}) => ((t = "1.0") => "1.1" === t ? j : M)(e).qName.test(t);
		class k {
			constructor(t, e) {
				this.suppressValidationErr = !t, this.options = t, this.xmlVersion = e || 1;
			}
			setXmlVersion(t = 1) {
				this.xmlVersion = t;
			}
			readDocType(t, e) {
				const n = Object.create(null);
				let i = 0;
				if ("O" !== t[e + 3] || "C" !== t[e + 4] || "T" !== t[e + 5] || "Y" !== t[e + 6] || "P" !== t[e + 7] || "E" !== t[e + 8]) throw new Error("Invalid Tag instead of DOCTYPE");
				{
					e += 9;
					let s = 1, r = !1, o = !1, a = "";
					for (; e < t.length; e++) if ("<" !== t[e] || o) if (">" === t[e]) {
						if (o ? "-" === t[e - 1] && "-" === t[e - 2] && (o = !1, s--) : s--, 0 === s) break;
					} else "[" === t[e] ? r = !0 : a += t[e];
					else {
						if (r && F(t, "!ENTITY", e)) {
							let s, r;
							if (e += 7, [s, r, e] = this.readEntityExp(t, e + 1, this.suppressValidationErr), -1 === r.indexOf("&")) {
								if (!1 !== this.options.enabled && null != this.options.maxEntityCount && i >= this.options.maxEntityCount) throw new Error(`Entity count (${i + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`);
								n[s] = r, i++;
							}
						} else if (r && F(t, "!ELEMENT", e)) {
							e += 8;
							const { index: n } = this.readElementExp(t, e + 1);
							e = n;
						} else if (r && F(t, "!ATTLIST", e)) e += 8;
						else if (r && F(t, "!NOTATION", e)) {
							e += 9;
							const { index: n } = this.readNotationExp(t, e + 1, this.suppressValidationErr);
							e = n;
						} else {
							if (!F(t, "!--", e)) throw new Error("Invalid DOCTYPE");
							o = !0;
						}
						s++, a = "";
					}
					if (0 !== s) throw new Error("Unclosed DOCTYPE");
				}
				return {
					entities: n,
					i: e
				};
			}
			readEntityExp(t, e) {
				const n = e = R(t, e);
				for (; e < t.length && !/\s/.test(t[e]) && "\"" !== t[e] && "'" !== t[e];) e++;
				let i = t.substring(n, e);
				if (G(i, { xmlVersion: this.xmlVersion }), e = R(t, e), !this.suppressValidationErr) {
					if ("SYSTEM" === t.substring(e, e + 6).toUpperCase()) throw new Error("External entities are not supported");
					if ("%" === t[e]) throw new Error("Parameter entities are not supported");
				}
				let s = "";
				if ([e, s] = this.readIdentifierVal(t, e, "entity"), !1 !== this.options.enabled && null != this.options.maxEntitySize && s.length > this.options.maxEntitySize) throw new Error(`Entity "${i}" size (${s.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`);
				return [
					i,
					s,
					--e
				];
			}
			readNotationExp(t, e) {
				const n = e = R(t, e);
				for (; e < t.length && !/\s/.test(t[e]);) e++;
				let i = t.substring(n, e);
				!this.suppressValidationErr && G(i, { xmlVersion: this.xmlVersion }), e = R(t, e);
				const s = t.substring(e, e + 6).toUpperCase();
				if (!this.suppressValidationErr && "SYSTEM" !== s && "PUBLIC" !== s) throw new Error(`Expected SYSTEM or PUBLIC, found "${s}"`);
				e += s.length, e = R(t, e);
				let r = null, o = null;
				if ("PUBLIC" === s) [e, r] = this.readIdentifierVal(t, e, "publicIdentifier"), "\"" !== t[e = R(t, e)] && "'" !== t[e] || ([e, o] = this.readIdentifierVal(t, e, "systemIdentifier"));
				else if ("SYSTEM" === s && ([e, o] = this.readIdentifierVal(t, e, "systemIdentifier"), !this.suppressValidationErr && !o)) throw new Error("Missing mandatory system identifier for SYSTEM notation");
				return {
					notationName: i,
					publicIdentifier: r,
					systemIdentifier: o,
					index: --e
				};
			}
			readIdentifierVal(t, e, n) {
				let i = "";
				const s = t[e];
				if ("\"" !== s && "'" !== s) throw new Error(`Expected quoted string, found "${s}"`);
				const r = ++e;
				for (; e < t.length && t[e] !== s;) e++;
				if (i = t.substring(r, e), t[e] !== s) throw new Error(`Unterminated ${n} value`);
				return [++e, i];
			}
			readElementExp(t, e) {
				const n = e = R(t, e);
				for (; e < t.length && !/\s/.test(t[e]);) e++;
				let i = t.substring(n, e);
				if (!this.suppressValidationErr && !L(i, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid element name: "${i}"`);
				let s = "";
				if ("E" === t[e = R(t, e)] && F(t, "MPTY", e)) e += 4;
				else if ("A" === t[e] && F(t, "NY", e)) e += 2;
				else if ("(" === t[e]) {
					const n = ++e;
					for (; e < t.length && ")" !== t[e];) e++;
					if (s = t.substring(n, e), ")" !== t[e]) throw new Error("Unterminated content model");
				} else if (!this.suppressValidationErr) throw new Error(`Invalid Element Expression, found "${t[e]}"`);
				return {
					elementName: i,
					contentModel: s.trim(),
					index: e
				};
			}
			readAttlistExp(t, e) {
				let n = e = R(t, e);
				for (; e < t.length && !/\s/.test(t[e]);) e++;
				let i = t.substring(n, e);
				for (G(i, { xmlVersion: this.xmlVersion }), n = e = R(t, e); e < t.length && !/\s/.test(t[e]);) e++;
				let s = t.substring(n, e);
				if (!G(s, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid attribute name: "${s}"`);
				e = R(t, e);
				let r = "";
				if ("NOTATION" === t.substring(e, e + 8).toUpperCase()) {
					if (r = "NOTATION", "(" !== t[e = R(t, e += 8)]) throw new Error(`Expected '(', found "${t[e]}"`);
					e++;
					let n = [];
					for (; e < t.length && ")" !== t[e];) {
						const i = e;
						for (; e < t.length && "|" !== t[e] && ")" !== t[e];) e++;
						let s = t.substring(i, e);
						if (s = s.trim(), !G(s, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid notation name: "${s}"`);
						n.push(s), "|" === t[e] && (e++, e = R(t, e));
					}
					if (")" !== t[e]) throw new Error("Unterminated list of notations");
					e++, r += " (" + n.join("|") + ")";
				} else {
					const n = e;
					for (; e < t.length && !/\s/.test(t[e]);) e++;
					r += t.substring(n, e);
					if (!this.suppressValidationErr && ![
						"CDATA",
						"ID",
						"IDREF",
						"IDREFS",
						"ENTITY",
						"ENTITIES",
						"NMTOKEN",
						"NMTOKENS"
					].includes(r.toUpperCase())) throw new Error(`Invalid attribute type: "${r}"`);
				}
				e = R(t, e);
				let o = "";
				return "#REQUIRED" === t.substring(e, e + 8).toUpperCase() ? (o = "#REQUIRED", e += 8) : "#IMPLIED" === t.substring(e, e + 7).toUpperCase() ? (o = "#IMPLIED", e += 7) : [e, o] = this.readIdentifierVal(t, e, "ATTLIST"), {
					elementName: i,
					attributeName: s,
					attributeType: r,
					defaultValue: o,
					index: e
				};
			}
		}
		const R = (t, e) => {
			for (; e < t.length && /\s/.test(t[e]);) e++;
			return e;
		};
		function F(t, e, n) {
			for (let i = 0; i < e.length; i++) if (e[i] !== t[n + i + 1]) return !1;
			return !0;
		}
		function G(t, e) {
			if (L(t, { xmlVersion: e })) return t;
			throw new Error(`Invalid entity name ${t}`);
		}
		const U = /^[-+]?0x[a-fA-F0-9]+$/, B = /^0b[01]+$/, W = /^0o[0-7]+$/, z = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/, X = {
			hex: !0,
			binary: !1,
			octal: !1,
			leadingZeros: !0,
			decimalPoint: ".",
			eNotation: !0,
			infinity: "original"
		};
		const Y = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
		function q(t, e) {
			const n = t.trim();
			if (2 !== e && 8 !== e || (t = n.substring(2)), parseInt) return parseInt(t, e);
			if (Number.parseInt) return Number.parseInt(t, e);
			if (window && window.parseInt) return window.parseInt(t, e);
			throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
		}
		class Z {
			constructor(t) {
				this._matcher = t;
			}
			get separator() {
				return this._matcher.separator;
			}
			getCurrentTag() {
				const t = this._matcher.path;
				return t.length > 0 ? t[t.length - 1].tag : void 0;
			}
			getCurrentNamespace() {
				const t = this._matcher.path;
				return t.length > 0 ? t[t.length - 1].namespace : void 0;
			}
			getAttrValue(t) {
				const e = this._matcher.path;
				if (0 !== e.length) return e[e.length - 1].values?.[t];
			}
			hasAttr(t) {
				const e = this._matcher.path;
				if (0 === e.length) return !1;
				const n = e[e.length - 1];
				return void 0 !== n.values && t in n.values;
			}
			getPosition() {
				const t = this._matcher.path;
				return 0 === t.length ? -1 : t[t.length - 1].position ?? 0;
			}
			getCounter() {
				const t = this._matcher.path;
				return 0 === t.length ? -1 : t[t.length - 1].counter ?? 0;
			}
			getIndex() {
				return this.getPosition();
			}
			getDepth() {
				return this._matcher.path.length;
			}
			toString(t, e = !0) {
				return this._matcher.toString(t, e);
			}
			toArray() {
				return this._matcher.path.map((t) => t.tag);
			}
			matches(t) {
				return this._matcher.matches(t);
			}
			matchesAny(t) {
				return t.matchesAny(this._matcher);
			}
		}
		class J {
			constructor(t = {}) {
				this.separator = t.separator || ".", this.path = [], this.siblingStacks = [], this._pathStringCache = null, this._view = new Z(this);
			}
			push(t, e = null, n = null) {
				this._pathStringCache = null, this.path.length > 0 && (this.path[this.path.length - 1].values = void 0);
				const i = this.path.length;
				this.siblingStacks[i] || (this.siblingStacks[i] = /* @__PURE__ */ new Map());
				const s = this.siblingStacks[i], r = n ? `${n}:${t}` : t, o = s.get(r) || 0;
				let a = 0;
				for (const t of s.values()) a += t;
				s.set(r, o + 1);
				const h = {
					tag: t,
					position: a,
					counter: o
				};
				null != n && (h.namespace = n), null != e && (h.values = e), this.path.push(h);
			}
			pop() {
				if (0 === this.path.length) return;
				this._pathStringCache = null;
				const t = this.path.pop();
				return this.siblingStacks.length > this.path.length + 1 && (this.siblingStacks.length = this.path.length + 1), t;
			}
			updateCurrent(t) {
				if (this.path.length > 0) {
					const e = this.path[this.path.length - 1];
					null != t && (e.values = t);
				}
			}
			getCurrentTag() {
				return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
			}
			getCurrentNamespace() {
				return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
			}
			getAttrValue(t) {
				if (0 !== this.path.length) return this.path[this.path.length - 1].values?.[t];
			}
			hasAttr(t) {
				if (0 === this.path.length) return !1;
				const e = this.path[this.path.length - 1];
				return void 0 !== e.values && t in e.values;
			}
			getPosition() {
				return 0 === this.path.length ? -1 : this.path[this.path.length - 1].position ?? 0;
			}
			getCounter() {
				return 0 === this.path.length ? -1 : this.path[this.path.length - 1].counter ?? 0;
			}
			getIndex() {
				return this.getPosition();
			}
			getDepth() {
				return this.path.length;
			}
			toString(t, e = !0) {
				const n = t || this.separator;
				if (n === this.separator && !0 === e) {
					if (null !== this._pathStringCache) return this._pathStringCache;
					const t = this.path.map((t) => t.namespace ? `${t.namespace}:${t.tag}` : t.tag).join(n);
					return this._pathStringCache = t, t;
				}
				return this.path.map((t) => e && t.namespace ? `${t.namespace}:${t.tag}` : t.tag).join(n);
			}
			toArray() {
				return this.path.map((t) => t.tag);
			}
			reset() {
				this._pathStringCache = null, this.path = [], this.siblingStacks = [];
			}
			matches(t) {
				const e = t.segments;
				return 0 !== e.length && (t.hasDeepWildcard() ? this._matchWithDeepWildcard(e) : this._matchSimple(e));
			}
			_matchSimple(t) {
				if (this.path.length !== t.length) return !1;
				for (let e = 0; e < t.length; e++) if (!this._matchSegment(t[e], this.path[e], e === this.path.length - 1)) return !1;
				return !0;
			}
			_matchWithDeepWildcard(t) {
				let e = this.path.length - 1, n = t.length - 1;
				for (; n >= 0 && e >= 0;) {
					const i = t[n];
					if ("deep-wildcard" === i.type) {
						if (n--, n < 0) return !0;
						const i = t[n];
						let s = !1;
						for (let t = e; t >= 0; t--) if (this._matchSegment(i, this.path[t], t === this.path.length - 1)) {
							e = t - 1, n--, s = !0;
							break;
						}
						if (!s) return !1;
					} else {
						if (!this._matchSegment(i, this.path[e], e === this.path.length - 1)) return !1;
						e--, n--;
					}
				}
				return n < 0;
			}
			_matchSegment(t, e, n) {
				if ("*" !== t.tag && t.tag !== e.tag) return !1;
				if (void 0 !== t.namespace && "*" !== t.namespace && t.namespace !== e.namespace) return !1;
				if (void 0 !== t.attrName) {
					if (!n) return !1;
					if (!e.values || !(t.attrName in e.values)) return !1;
					if (void 0 !== t.attrValue && String(e.values[t.attrName]) !== String(t.attrValue)) return !1;
				}
				if (void 0 !== t.position) {
					if (!n) return !1;
					const i = e.counter ?? 0;
					if ("first" === t.position && 0 !== i) return !1;
					if ("odd" === t.position && i % 2 != 1) return !1;
					if ("even" === t.position && i % 2 != 0) return !1;
					if ("nth" === t.position && i !== t.positionValue) return !1;
				}
				return !0;
			}
			matchesAny(t) {
				return t.matchesAny(this);
			}
			snapshot() {
				return {
					path: this.path.map((t) => ({ ...t })),
					siblingStacks: this.siblingStacks.map((t) => new Map(t))
				};
			}
			restore(t) {
				this._pathStringCache = null, this.path = t.path.map((t) => ({ ...t })), this.siblingStacks = t.siblingStacks.map((t) => new Map(t));
			}
			readOnly() {
				return this._view;
			}
		}
		class K {
			constructor(t, e = {}, n) {
				this.pattern = t, this.separator = e.separator || ".", this.segments = this._parse(t), this.data = n, this._hasDeepWildcard = this.segments.some((t) => "deep-wildcard" === t.type), this._hasAttributeCondition = this.segments.some((t) => void 0 !== t.attrName), this._hasPositionSelector = this.segments.some((t) => void 0 !== t.position);
			}
			_parse(t) {
				const e = [];
				let n = 0, i = "";
				for (; n < t.length;) t[n] === this.separator ? n + 1 < t.length && t[n + 1] === this.separator ? (i.trim() && (e.push(this._parseSegment(i.trim())), i = ""), e.push({ type: "deep-wildcard" }), n += 2) : (i.trim() && e.push(this._parseSegment(i.trim())), i = "", n++) : (i += t[n], n++);
				return i.trim() && e.push(this._parseSegment(i.trim())), e;
			}
			_parseSegment(t) {
				const e = { type: "tag" };
				let n = null, i = t;
				const s = t.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
				if (s && (i = s[1] + s[3], s[2])) {
					const t = s[2].slice(1, -1);
					t && (n = t);
				}
				let r, o, a = i;
				if (i.includes("::")) {
					const e = i.indexOf("::");
					if (r = i.substring(0, e).trim(), a = i.substring(e + 2).trim(), !r) throw new Error(`Invalid namespace in pattern: ${t}`);
				}
				let h = null;
				if (a.includes(":")) {
					const t = a.lastIndexOf(":"), e = a.substring(0, t).trim(), n = a.substring(t + 1).trim();
					[
						"first",
						"last",
						"odd",
						"even"
					].includes(n) || /^nth\(\d+\)$/.test(n) ? (o = e, h = n) : o = a;
				} else o = a;
				if (!o) throw new Error(`Invalid segment pattern: ${t}`);
				if (e.tag = o, r && (e.namespace = r), n) if (n.includes("=")) {
					const t = n.indexOf("=");
					e.attrName = n.substring(0, t).trim(), e.attrValue = n.substring(t + 1).trim();
				} else e.attrName = n.trim();
				if (h) {
					const t = h.match(/^nth\((\d+)\)$/);
					t ? (e.position = "nth", e.positionValue = parseInt(t[1], 10)) : e.position = h;
				}
				return e;
			}
			get length() {
				return this.segments.length;
			}
			hasDeepWildcard() {
				return this._hasDeepWildcard;
			}
			hasAttributeCondition() {
				return this._hasAttributeCondition;
			}
			hasPositionSelector() {
				return this._hasPositionSelector;
			}
			toString() {
				return this.pattern;
			}
		}
		class Q {
			constructor() {
				this._byDepthAndTag = /* @__PURE__ */ new Map(), this._wildcardByDepth = /* @__PURE__ */ new Map(), this._deepWildcards = [], this._patterns = /* @__PURE__ */ new Set(), this._sealed = !1;
			}
			add(t) {
				if (this._sealed) throw new TypeError("ExpressionSet is sealed. Create a new ExpressionSet to add more expressions.");
				if (this._patterns.has(t.pattern)) return this;
				if (this._patterns.add(t.pattern), t.hasDeepWildcard()) return this._deepWildcards.push(t), this;
				const e = t.length, i = t.segments[t.segments.length - 1]?.tag;
				if (i && "*" !== i) {
					const n = `${e}:${i}`;
					this._byDepthAndTag.has(n) || this._byDepthAndTag.set(n, []), this._byDepthAndTag.get(n).push(t);
				} else this._wildcardByDepth.has(e) || this._wildcardByDepth.set(e, []), this._wildcardByDepth.get(e).push(t);
				return this;
			}
			addAll(t) {
				for (const e of t) this.add(e);
				return this;
			}
			has(t) {
				return this._patterns.has(t.pattern);
			}
			get size() {
				return this._patterns.size;
			}
			seal() {
				return this._sealed = !0, this;
			}
			get isSealed() {
				return this._sealed;
			}
			matchesAny(t) {
				return null !== this.findMatch(t);
			}
			findMatch(t) {
				const e = t.getDepth(), n = `${e}:${t.getCurrentTag()}`, i = this._byDepthAndTag.get(n);
				if (i) {
					for (let e = 0; e < i.length; e++) if (t.matches(i[e])) return i[e];
				}
				const s = this._wildcardByDepth.get(e);
				if (s) {
					for (let e = 0; e < s.length; e++) if (t.matches(s[e])) return s[e];
				}
				for (let e = 0; e < this._deepWildcards.length; e++) if (t.matches(this._deepWildcards[e])) return this._deepWildcards[e];
				return null;
			}
		}
		const H = {
			cent: "¢",
			pound: "£",
			curren: "¤",
			yen: "¥",
			euro: "€",
			dollar: "$",
			euro: "€",
			fnof: "ƒ",
			inr: "₹",
			af: "؋",
			birr: "ብር",
			peso: "₱",
			rub: "₽",
			won: "₩",
			yuan: "¥",
			cedil: "¸"
		}, tt = {
			amp: "&",
			apos: "'",
			gt: ">",
			lt: "<",
			quot: "\""
		}, et = {
			nbsp: "\xA0",
			copy: "©",
			reg: "®",
			trade: "™",
			mdash: "—",
			ndash: "–",
			hellip: "…",
			laquo: "«",
			raquo: "»",
			lsquo: "‘",
			rsquo: "’",
			ldquo: "“",
			rdquo: "”",
			bull: "•",
			para: "¶",
			sect: "§",
			deg: "°",
			frac12: "½",
			frac14: "¼",
			frac34: "¾"
		}, nt = /* @__PURE__ */ new Set("!?\\\\/[]$%{}^&*()<>|+");
		function it(t) {
			if ("#" === t[0]) throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${t}"`);
			for (const e of t) if (nt.has(e)) throw new Error(`[EntityReplacer] Invalid character '${e}' in entity name: "${t}"`);
			return t;
		}
		function st(...t) {
			const e = Object.create(null);
			for (const n of t) if (n) for (const t of Object.keys(n)) {
				const i = n[t];
				if ("string" == typeof i) e[t] = i;
				else if (i && "object" == typeof i && void 0 !== i.val) {
					const n = i.val;
					"string" == typeof n && (e[t] = n);
				}
			}
			return e;
		}
		const rt = "external", ot = "base", at = "all", ht = Object.freeze({
			allow: 0,
			leave: 1,
			remove: 2,
			throw: 3
		}), lt = new Set([
			9,
			10,
			13
		]);
		class ut {
			constructor(t = {}) {
				var e;
				this._limit = t.limit || {}, this._maxTotalExpansions = this._limit.maxTotalExpansions || 0, this._maxExpandedLength = this._limit.maxExpandedLength || 0, this._postCheck = "function" == typeof t.postCheck ? t.postCheck : (t) => t, this._limitTiers = (e = this._limit.applyLimitsTo ?? rt) && e !== rt ? e === at ? new Set([at]) : e === ot ? new Set([ot]) : Array.isArray(e) ? new Set(e) : new Set([rt]) : new Set([rt]), this._numericAllowed = t.numericAllowed ?? !0, this._baseMap = st(tt, t.namedEntities || null), this._externalMap = Object.create(null), this._inputMap = Object.create(null), this._totalExpansions = 0, this._expandedLength = 0, this._removeSet = new Set(t.remove && Array.isArray(t.remove) ? t.remove : []), this._leaveSet = new Set(t.leave && Array.isArray(t.leave) ? t.leave : []);
				const n = function(t) {
					if (!t) return {
						xmlVersion: 1,
						onLevel: ht.allow,
						nullLevel: ht.remove
					};
					const e = 1.1 === t.xmlVersion ? 1.1 : 1, n = ht[t.onNCR] ?? ht.allow, i = ht[t.nullNCR] ?? ht.remove;
					return {
						xmlVersion: e,
						onLevel: n,
						nullLevel: Math.max(i, ht.remove)
					};
				}(t.ncr);
				this._ncrXmlVersion = n.xmlVersion, this._ncrOnLevel = n.onLevel, this._ncrNullLevel = n.nullLevel;
			}
			setExternalEntities(t) {
				if (t) for (const e of Object.keys(t)) it(e);
				this._externalMap = st(t);
			}
			addExternalEntity(t, e) {
				it(t), "string" == typeof e && -1 === e.indexOf("&") && (this._externalMap[t] = e);
			}
			addInputEntities(t) {
				this._totalExpansions = 0, this._expandedLength = 0, this._inputMap = st(t);
			}
			reset() {
				return this._inputMap = Object.create(null), this._totalExpansions = 0, this._expandedLength = 0, this;
			}
			setXmlVersion(t) {
				this._ncrXmlVersion = 1.1 === t ? 1.1 : 1;
			}
			decode(t) {
				if ("string" != typeof t || 0 === t.length) return t;
				const e = t, n = [], i = t.length;
				let s = 0, r = 0;
				const o = this._maxTotalExpansions > 0, a = this._maxExpandedLength > 0, h = o || a;
				for (; r < i;) {
					if (38 !== t.charCodeAt(r)) {
						r++;
						continue;
					}
					let e = r + 1;
					for (; e < i && 59 !== t.charCodeAt(e) && e - r <= 32;) e++;
					if (e >= i || 59 !== t.charCodeAt(e)) {
						r++;
						continue;
					}
					const l = t.slice(r + 1, e);
					if (0 === l.length) {
						r++;
						continue;
					}
					let u, p;
					if (this._removeSet.has(l)) u = "", void 0 === p && (p = rt);
					else {
						if (this._leaveSet.has(l)) {
							r++;
							continue;
						}
						if (35 === l.charCodeAt(0)) {
							const t = this._resolveNCR(l);
							if (void 0 === t) {
								r++;
								continue;
							}
							u = t, p = ot;
						} else {
							const t = this._resolveName(l);
							u = t?.value, p = t?.tier;
						}
					}
					if (void 0 !== u) {
						if (r > s && n.push(t.slice(s, r)), n.push(u), s = e + 1, r = s, h && this._tierCounts(p)) {
							if (o && (this._totalExpansions++, this._totalExpansions > this._maxTotalExpansions)) throw new Error(`[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`);
							if (a) {
								const t = u.length - (l.length + 2);
								if (t > 0 && (this._expandedLength += t, this._expandedLength > this._maxExpandedLength)) throw new Error(`[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`);
							}
						}
					} else r++;
				}
				s < i && n.push(t.slice(s));
				const l = 0 === n.length ? t : n.join("");
				return this._postCheck(l, e);
			}
			_tierCounts(t) {
				return !!this._limitTiers.has(at) || this._limitTiers.has(t);
			}
			_resolveName(t) {
				return t in this._inputMap ? {
					value: this._inputMap[t],
					tier: rt
				} : t in this._externalMap ? {
					value: this._externalMap[t],
					tier: rt
				} : t in this._baseMap ? {
					value: this._baseMap[t],
					tier: ot
				} : void 0;
			}
			_classifyNCR(t) {
				return 0 === t ? this._ncrNullLevel : t >= 55296 && t <= 57343 || 1 === this._ncrXmlVersion && t >= 1 && t <= 31 && !lt.has(t) ? ht.remove : -1;
			}
			_applyNCRAction(t, e, n) {
				switch (t) {
					case ht.allow: return String.fromCodePoint(n);
					case ht.remove: return "";
					case ht.leave: return;
					case ht.throw: throw new Error(`[EntityDecoder] Prohibited numeric character reference &${e}; (U+${n.toString(16).toUpperCase().padStart(4, "0")})`);
					default: return String.fromCodePoint(n);
				}
			}
			_resolveNCR(t) {
				const e = t.charCodeAt(1);
				let n;
				if (n = 120 === e || 88 === e ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10), Number.isNaN(n) || n < 0 || n > 1114111) return;
				const i = this._classifyNCR(n);
				if (!this._numericAllowed && i < ht.remove) return;
				const s = -1 === i ? this._ncrOnLevel : Math.max(this._ncrOnLevel, i);
				return this._applyNCRAction(s, t, n);
			}
		}
		function pt(t, e) {
			if (!t) return {};
			const n = e.attributesGroupName ? t[e.attributesGroupName] : t;
			if (!n) return {};
			const i = {};
			for (const t in n) t.startsWith(e.attributeNamePrefix) ? i[t.substring(e.attributeNamePrefix.length)] = n[t] : i[t] = n[t];
			return i;
		}
		function ct(t) {
			if (!t || "string" != typeof t) return;
			const e = t.indexOf(":");
			if (-1 !== e && e > 0) {
				const n = t.substring(0, e);
				if ("xmlns" !== n) return n;
			}
		}
		class dt {
			constructor(t, e) {
				var n;
				this.options = t, this.currentNode = null, this.tagsNodeStack = [], this.parseXml = Nt, this.parseTextData = ft, this.resolveNameSpace = gt, this.buildAttributesMap = xt, this.isItStopNode = wt, this.replaceEntitiesValue = yt, this.readStopNodeData = At, this.saveTextToParentTag = Et, this.addChild = bt, this.ignoreAttributesFn = "function" == typeof (n = this.options.ignoreAttributes) ? n : Array.isArray(n) ? (t) => {
					for (const e of n) {
						if ("string" == typeof e && t === e) return !0;
						if (e instanceof RegExp && e.test(t)) return !0;
					}
				} : () => !1, this.entityExpansionCount = 0, this.currentExpandedLength = 0;
				let i = { ...tt };
				this.options.entityDecoder ? this.entityDecoder = this.options.entityDecoder : ("object" == typeof this.options.htmlEntities ? i = this.options.htmlEntities : !0 === this.options.htmlEntities && (i = {
					...et,
					...H
				}), this.entityDecoder = new ut({
					namedEntities: {
						...i,
						...e
					},
					numericAllowed: this.options.htmlEntities,
					limit: {
						maxTotalExpansions: this.options.processEntities.maxTotalExpansions,
						maxExpandedLength: this.options.processEntities.maxExpandedLength,
						applyLimitsTo: this.options.processEntities.appliesTo
					}
				})), this.matcher = new J(), this.readonlyMatcher = this.matcher.readOnly(), this.isCurrentNodeStopNode = !1, this.stopNodeExpressionsSet = new Q();
				const s = this.options.stopNodes;
				if (s && s.length > 0) {
					for (let t = 0; t < s.length; t++) {
						const e = s[t];
						"string" == typeof e ? this.stopNodeExpressionsSet.add(new K(e)) : e instanceof K && this.stopNodeExpressionsSet.add(e);
					}
					this.stopNodeExpressionsSet.seal();
				}
			}
		}
		function ft(t, e, n, i, s, r, o) {
			const a = this.options;
			if (void 0 !== t && (a.trimValues && !i && (t = t.trim()), t.length > 0)) {
				o || (t = this.replaceEntitiesValue(t, e, n));
				const i = a.jPath ? n.toString() : n, h = a.tagValueProcessor(e, t, i, s, r);
				return null == h ? t : typeof h != typeof t || h !== t ? h : a.trimValues || t.trim() === t ? Tt(t, a.parseTagValue, a.numberParseOptions) : t;
			}
		}
		function gt(t) {
			if (this.options.removeNSPrefix) {
				const e = t.split(":"), n = "/" === t.charAt(0) ? "/" : "";
				if ("xmlns" === e[0]) return "";
				2 === e.length && (t = n + e[1]);
			}
			return t;
		}
		const mt = /* @__PURE__ */ new RegExp("([^\\s=]+)\\s*(=\\s*(['\"])([\\s\\S]*?)\\3)?", "gm");
		function xt(t, e, n, i = !1) {
			const r = this.options;
			if (!0 === i || !0 !== r.ignoreAttributes && "string" == typeof t) {
				const i = s(t, mt), o = i.length, a = {}, h = new Array(o);
				let l = !1;
				const u = {};
				for (let t = 0; t < o; t++) {
					const e = this.resolveNameSpace(i[t][1]), s = i[t][4];
					if (e.length && void 0 !== s) {
						let i = s;
						r.trimValues && (i = i.trim()), i = this.replaceEntitiesValue(i, n, this.readonlyMatcher), h[t] = i, u[e] = i, l = !0;
					}
				}
				l && "object" == typeof e && e.updateCurrent && e.updateCurrent(u);
				const p = r.jPath ? e.toString() : this.readonlyMatcher;
				let c = !1;
				for (let t = 0; t < o; t++) {
					const e = this.resolveNameSpace(i[t][1]);
					if (this.ignoreAttributesFn(e, p)) continue;
					let n = r.attributeNamePrefix + e;
					if (e.length) if (r.transformAttributeName && (n = r.transformAttributeName(n)), n = Pt(n, r), void 0 !== i[t][4]) {
						const i = h[t], s = r.attributeValueProcessor(e, i, p);
						a[n] = null == s ? i : typeof s != typeof i || s !== i ? s : Tt(i, r.parseAttributeValue, r.numberParseOptions), c = !0;
					} else r.allowBooleanAttributes && (a[n] = !0, c = !0);
				}
				if (!c) return;
				if (r.attributesGroupName && !r.preserveOrder) {
					const t = {};
					return t[r.attributesGroupName] = a, t;
				}
				return a;
			}
		}
		const Nt = function(t) {
			t = t.replace(/\r\n?/g, "\n");
			const e = new $("!xml");
			let n = e, i = "";
			this.matcher.reset(), this.entityDecoder.reset(), this.entityExpansionCount = 0, this.currentExpandedLength = 0;
			const s = this.options, r = new k(s.processEntities), o = t.length;
			for (let a = 0; a < o; a++) if ("<" === t[a]) {
				const h = t.charCodeAt(a + 1);
				if (47 === h) {
					const e = vt(t, ">", a, "Closing Tag is not closed.");
					let r = t.substring(a + 2, e).trim();
					if (s.removeNSPrefix) {
						const t = r.indexOf(":");
						-1 !== t && (r = r.substr(t + 1));
					}
					r = Ct(s.transformTagName, r, "", s).tagName, n && (i = this.saveTextToParentTag(i, n, this.readonlyMatcher));
					const o = this.matcher.getCurrentTag();
					if (r && s.unpairedTagsSet.has(r)) throw new Error(`Unpaired tag can not be used as closing tag: </${r}>`);
					o && s.unpairedTagsSet.has(o) && (this.matcher.pop(), this.tagsNodeStack.pop()), this.matcher.pop(), this.isCurrentNodeStopNode = !1, n = this.tagsNodeStack.pop(), i = "", a = e;
				} else if (63 === h) {
					let e = _t(t, a, !1, "?>");
					if (!e) throw new Error("Pi Tag is not closed.");
					i = this.saveTextToParentTag(i, n, this.readonlyMatcher);
					const o = this.buildAttributesMap(e.tagExp, this.matcher, e.tagName, !0);
					if (o) {
						const t = o[this.options.attributeNamePrefix + "version"];
						this.entityDecoder.setXmlVersion(Number(t) || 1), r.setXmlVersion(Number(t) || 1);
					}
					if (s.ignoreDeclaration && "?xml" === e.tagName || s.ignorePiTags);
					else {
						const t = new $(e.tagName);
						t.add(s.textNodeName, ""), e.tagName !== e.tagExp && e.attrExpPresent && !0 !== s.ignoreAttributes && (t[":@"] = o), this.addChild(n, t, this.readonlyMatcher, a);
					}
					a = e.closeIndex + 1;
				} else if (33 === h && 45 === t.charCodeAt(a + 2) && 45 === t.charCodeAt(a + 3)) {
					const e = vt(t, "-->", a + 4, "Comment is not closed.");
					if (s.commentPropName) {
						const r = t.substring(a + 4, e - 2);
						i = this.saveTextToParentTag(i, n, this.readonlyMatcher), n.add(s.commentPropName, [{ [s.textNodeName]: r }]);
					}
					a = e;
				} else if (33 === h && 68 === t.charCodeAt(a + 2)) {
					const e = r.readDocType(t, a);
					this.entityDecoder.addInputEntities(e.entities), a = e.i;
				} else if (33 === h && 91 === t.charCodeAt(a + 2)) {
					const e = vt(t, "]]>", a, "CDATA is not closed.") - 2, r = t.substring(a + 9, e);
					i = this.saveTextToParentTag(i, n, this.readonlyMatcher);
					let o = this.parseTextData(r, n.tagname, this.readonlyMatcher, !0, !1, !0, !0);
					o ??= "", s.cdataPropName ? n.add(s.cdataPropName, [{ [s.textNodeName]: r }]) : n.add(s.textNodeName, o), a = e + 2;
				} else {
					let r = _t(t, a, s.removeNSPrefix);
					if (!r) {
						const e = t.substring(Math.max(0, a - 50), Math.min(o, a + 50));
						throw new Error(`readTagExp returned undefined at position ${a}. Context: "${e}"`);
					}
					let h = r.tagName;
					const l = r.rawTagName;
					let u = r.tagExp, p = r.attrExpPresent, c = r.closeIndex;
					if ({tagName: h, tagExp: u} = Ct(s.transformTagName, h, u, s), s.strictReservedNames && (h === s.commentPropName || h === s.cdataPropName || h === s.textNodeName || h === s.attributesGroupName)) throw new Error(`Invalid tag name: ${h}`);
					n && i && "!xml" !== n.tagname && (i = this.saveTextToParentTag(i, n, this.readonlyMatcher, !1));
					const d = n;
					d && s.unpairedTagsSet.has(d.tagname) && (n = this.tagsNodeStack.pop(), this.matcher.pop());
					let f = !1;
					u.length > 0 && u.lastIndexOf("/") === u.length - 1 && (f = !0, "/" === h[h.length - 1] ? (h = h.substr(0, h.length - 1), u = h) : u = u.substr(0, u.length - 1), p = h !== u);
					let g, m = null;
					g = ct(l), h !== e.tagname && this.matcher.push(h, {}, g), h !== u && p && (m = this.buildAttributesMap(u, this.matcher, h), m && pt(m, s)), h !== e.tagname && (this.isCurrentNodeStopNode = this.isItStopNode());
					const N = a;
					if (this.isCurrentNodeStopNode) {
						let e = "";
						if (f) a = r.closeIndex;
						else if (s.unpairedTagsSet.has(h)) a = r.closeIndex;
						else {
							const n = this.readStopNodeData(t, l, c + 1);
							if (!n) throw new Error(`Unexpected end of ${l}`);
							a = n.i, e = n.tagContent;
						}
						const i = new $(h);
						m && (i[":@"] = m), i.add(s.textNodeName, e), this.matcher.pop(), this.isCurrentNodeStopNode = !1, this.addChild(n, i, this.readonlyMatcher, N);
					} else {
						if (f) {
							({tagName: h, tagExp: u} = Ct(s.transformTagName, h, u, s));
							const t = new $(h);
							m && (t[":@"] = m), this.addChild(n, t, this.readonlyMatcher, N), this.matcher.pop(), this.isCurrentNodeStopNode = !1;
						} else {
							if (s.unpairedTagsSet.has(h)) {
								const t = new $(h);
								m && (t[":@"] = m), this.addChild(n, t, this.readonlyMatcher, N), this.matcher.pop(), this.isCurrentNodeStopNode = !1, a = r.closeIndex;
								continue;
							}
							{
								const t = new $(h);
								if (this.tagsNodeStack.length > s.maxNestedTags) throw new Error("Maximum nested tags exceeded");
								this.tagsNodeStack.push(n), m && (t[":@"] = m), this.addChild(n, t, this.readonlyMatcher, N), n = t;
							}
						}
						i = "", a = c;
					}
				}
			} else i += t[a];
			return e.child;
		};
		function bt(t, e, n, i) {
			this.options.captureMetaData || (i = void 0);
			const s = this.options.jPath ? n.toString() : n, r = this.options.updateTag(e.tagname, s, e[":@"]);
			!1 === r || ("string" == typeof r ? (e.tagname = r, t.addChild(e, i)) : t.addChild(e, i));
		}
		function yt(t, e, n) {
			const i = this.options.processEntities;
			if (!i || !i.enabled) return t;
			if (i.allowedTags) {
				const s = this.options.jPath ? n.toString() : n;
				if (!(Array.isArray(i.allowedTags) ? i.allowedTags.includes(e) : i.allowedTags(e, s))) return t;
			}
			if (i.tagFilter) {
				const s = this.options.jPath ? n.toString() : n;
				if (!i.tagFilter(e, s)) return t;
			}
			return this.entityDecoder.decode(t);
		}
		function Et(t, e, n, i) {
			return t && (void 0 === i && (i = 0 === e.child.length), void 0 !== (t = this.parseTextData(t, e.tagname, n, !1, !!e[":@"] && 0 !== Object.keys(e[":@"]).length, i)) && "" !== t && e.add(this.options.textNodeName, t), t = ""), t;
		}
		function wt() {
			return 0 !== this.stopNodeExpressionsSet.size && this.matcher.matchesAny(this.stopNodeExpressionsSet);
		}
		function vt(t, e, n, i) {
			const s = t.indexOf(e, n);
			if (-1 === s) throw new Error(i);
			return s + e.length - 1;
		}
		function St(t, e, n, i) {
			const s = t.indexOf(e, n);
			if (-1 === s) throw new Error(i);
			return s;
		}
		function _t(t, e, n, i = ">") {
			const s = function(t, e, n = ">") {
				let i = 0;
				const s = t.length, r = n.charCodeAt(0), o = n.length > 1 ? n.charCodeAt(1) : -1;
				let a = "", h = e;
				for (let n = e; n < s; n++) {
					const e = t.charCodeAt(n);
					if (i) e === i && (i = 0);
					else if (34 === e || 39 === e) i = e;
					else if (e === r) {
						if (-1 === o) return a += t.substring(h, n), {
							data: a,
							index: n
						};
						if (t.charCodeAt(n + 1) === o) return a += t.substring(h, n), {
							data: a,
							index: n
						};
					} else 9 !== e || i || (a += t.substring(h, n) + " ", h = n + 1);
				}
			}(t, e + 1, i);
			if (!s) return;
			let r = s.data;
			const o = s.index, a = r.search(/\s/);
			let h = r, l = !0;
			-1 !== a && (h = r.substring(0, a), r = r.substring(a + 1).trimStart());
			const u = h;
			if (n) {
				const t = h.indexOf(":");
				-1 !== t && (h = h.substr(t + 1), l = h !== s.data.substr(t + 1));
			}
			return {
				tagName: h,
				tagExp: r,
				closeIndex: o,
				attrExpPresent: l,
				rawTagName: u
			};
		}
		function At(t, e, n) {
			const i = n;
			let s = 1;
			const r = t.length;
			for (; n < r; n++) if ("<" === t[n]) {
				const r = t.charCodeAt(n + 1);
				if (47 === r) {
					const r = St(t, ">", n, `${e} is not closed`);
					if (t.substring(n + 2, r).trim() === e && (s--, 0 === s)) return {
						tagContent: t.substring(i, n),
						i: r
					};
					n = r;
				} else if (63 === r) n = vt(t, "?>", n + 1, "StopNode is not closed.");
				else if (33 === r && 45 === t.charCodeAt(n + 2) && 45 === t.charCodeAt(n + 3)) n = vt(t, "-->", n + 3, "StopNode is not closed.");
				else if (33 === r && 91 === t.charCodeAt(n + 2)) n = vt(t, "]]>", n, "StopNode is not closed.") - 2;
				else {
					const i = _t(t, n, !1);
					i && ((i && i.tagName) === e && "/" !== i.tagExp[i.tagExp.length - 1] && s++, n = i.closeIndex);
				}
			}
		}
		function Tt(t, e, n) {
			if (e && "string" == typeof t) {
				const e = t.trim();
				return "true" === e || "false" !== e && function(t, e = {}) {
					if (e = Object.assign({}, X, e), !t || "string" != typeof t) return t;
					let n = t.trim();
					if (0 === n.length) return t;
					if (void 0 !== e.skipLike && e.skipLike.test(n)) return t;
					if ("0" === n) return 0;
					if (e.hex && U.test(n)) return q(n, 16);
					if (e.binary && B.test(n)) return q(n, 2);
					if (e.octal && W.test(n)) return q(n, 8);
					if (isFinite(n)) {
						if (n.includes("e") || n.includes("E")) return function(t, e, n) {
							if (!n.eNotation) return t;
							const i = e.match(Y);
							if (i) {
								let s = i[1] || "";
								const r = -1 === i[3].indexOf("e") ? "E" : "e", o = i[2], a = s ? t[o.length + 1] === r : t[o.length] === r;
								return o.length > 1 && a ? t : (1 !== o.length || !i[3].startsWith(`.${r}`) && i[3][0] !== r) && o.length > 0 ? n.leadingZeros && !a ? (e = (i[1] || "") + i[3], Number(e)) : t : Number(e);
							}
							return t;
						}(t, n, e);
						{
							const s = z.exec(n);
							if (s) {
								const r = s[1] || "", o = s[2];
								let a = (i = s[3]) && -1 !== i.indexOf(".") ? ("." === (i = i.replace(/0+$/, "")) ? i = "0" : "." === i[0] ? i = "0" + i : "." === i[i.length - 1] && (i = i.substring(0, i.length - 1)), i) : i;
								const h = r ? "." === t[o.length + 1] : "." === t[o.length];
								if (!e.leadingZeros && (o.length > 1 || 1 === o.length && !h)) return t;
								{
									const i = Number(n), s = String(i);
									if (0 === i) return i;
									if (-1 !== s.search(/[eE]/)) return e.eNotation ? i : t;
									if (-1 !== n.indexOf(".")) return "0" === s || s === a || s === `${r}${a}` ? i : t;
									let h = o ? a : n;
									return o ? h === s || r + h === s ? i : t : h === s || h === r + s ? i : t;
								}
							}
							return t;
						}
					}
					var i;
					return function(t, e, n) {
						const i = e === Infinity;
						switch (n.infinity.toLowerCase()) {
							case "null": return null;
							case "infinity": return e;
							case "string": return i ? "Infinity" : "-Infinity";
							default: return t;
						}
					}(t, Number(n), e);
				}(t, n);
			}
			return void 0 !== t ? t : "";
		}
		function Ct(t, e, n, i) {
			if (t) {
				const i = t(e);
				n === e && (n = i), e = i;
			}
			return {
				tagName: e = Pt(e, i),
				tagExp: n
			};
		}
		function Pt(t, e) {
			if (a.includes(t)) throw new Error(`[SECURITY] Invalid name: "${t}" is a reserved JavaScript keyword that could cause prototype pollution`);
			return o.includes(t) ? e.onDangerousProperty(t) : t;
		}
		const $t = $.getMetaDataSymbol();
		function Ot(t, e) {
			if (!t || "object" != typeof t) return {};
			if (!e) return t;
			const n = {};
			for (const i in t) i.startsWith(e) ? n[i.substring(e.length)] = t[i] : n[i] = t[i];
			return n;
		}
		function It(t, e, n, i) {
			return Vt(t, e, n, i);
		}
		function Vt(t, e, n, i) {
			let s;
			const r = {};
			for (let o = 0; o < t.length; o++) {
				const a = t[o], h = Dt(a);
				if (void 0 !== h && h !== e.textNodeName) {
					const t = Ot(a[":@"] || {}, e.attributeNamePrefix);
					n.push(h, t);
				}
				if (h === e.textNodeName) void 0 === s ? s = a[h] : s += "" + a[h];
				else {
					if (void 0 === h) continue;
					if (a[h]) {
						let t = Vt(a[h], e, n, i);
						const s = jt(t, e);
						if (0 === Object.keys(t).length && e.alwaysCreateTextNode && (t[e.textNodeName] = ""), a[":@"] ? Mt(t, a[":@"], i, e) : 1 !== Object.keys(t).length || void 0 === t[e.textNodeName] || e.alwaysCreateTextNode ? 0 === Object.keys(t).length && (e.alwaysCreateTextNode ? t[e.textNodeName] = "" : t = "") : t = t[e.textNodeName], void 0 !== a[$t] && "object" == typeof t && null !== t && (t[$t] = a[$t]), void 0 !== r[h] && Object.prototype.hasOwnProperty.call(r, h)) Array.isArray(r[h]) || (r[h] = [r[h]]), r[h].push(t);
						else {
							const n = e.jPath ? i.toString() : i;
							e.isArray(h, n, s) ? r[h] = [t] : r[h] = t;
						}
						void 0 !== h && h !== e.textNodeName && n.pop();
					}
				}
			}
			return "string" == typeof s ? s.length > 0 && (r[e.textNodeName] = s) : void 0 !== s && (r[e.textNodeName] = s), r;
		}
		function Dt(t) {
			const e = Object.keys(t);
			for (let t = 0; t < e.length; t++) {
				const n = e[t];
				if (":@" !== n) return n;
			}
		}
		function Mt(t, e, n, i) {
			if (e) {
				const s = Object.keys(e), r = s.length;
				for (let o = 0; o < r; o++) {
					const r = s[o], a = r.startsWith(i.attributeNamePrefix) ? r.substring(i.attributeNamePrefix.length) : r, h = i.jPath ? n.toString() + "." + a : n;
					i.isArray(r, h, !0, !0) ? t[r] = [e[r]] : t[r] = e[r];
				}
			}
		}
		function jt(t, e) {
			const { textNodeName: n } = e, i = Object.keys(t).length;
			return 0 === i || !(1 !== i || !t[n] && "boolean" != typeof t[n] && 0 !== t[n]);
		}
		class Lt {
			constructor(t) {
				this.externalEntities = {}, this.options = C(t);
			}
			parse(t, e) {
				if ("string" != typeof t && t.toString) t = t.toString();
				else if ("string" != typeof t) throw new Error("XML data is accepted in String or Bytes[] form.");
				if (e) {
					!0 === e && (e = {});
					const n = l(t, e);
					if (!0 !== n) throw Error(`${n.err.msg}:${n.err.line}:${n.err.col}`);
				}
				const n = new dt(this.options, this.externalEntities), i = n.parseXml(t);
				return this.options.preserveOrder || void 0 === i ? i : It(i, this.options, n.matcher, n.readonlyMatcher);
			}
			addEntity(t, e) {
				if (-1 !== e.indexOf("&")) throw new Error("Entity value can't have '&'");
				if (-1 !== t.indexOf("&") || -1 !== t.indexOf(";")) throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
				if ("&" === e) throw new Error("An entity with value '&' is not permitted");
				this.externalEntities[t] = e;
			}
			static getMetaDataSymbol() {
				return $.getMetaDataSymbol();
			}
		}
		function kt(t) {
			return String(t).replace(/--/g, "- -").replace(/--/g, "- -").replace(/-$/, "- ");
		}
		function Rt(t) {
			return String(t).replace(/\]\]>/g, "]]]]><![CDATA[>");
		}
		function Ft(t) {
			return String(t).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
		}
		function Gt(t, e, n, i, s) {
			return n.sanitizeName ? L(t, { xmlVersion: s }) ? t : n.sanitizeName(t, {
				isAttribute: e,
				matcher: i.readOnly()
			}) : t;
		}
		function Ut(t, e) {
			let n = "";
			e.format && (n = "\n");
			const i = [];
			if (e.stopNodes && Array.isArray(e.stopNodes)) for (let t = 0; t < e.stopNodes.length; t++) {
				const n = e.stopNodes[t];
				"string" == typeof n ? i.push(new K(n)) : n instanceof K && i.push(n);
			}
			const s = function(t, e) {
				if (!Array.isArray(t) || 0 === t.length) return "1.0";
				const n = t[0];
				if ("?xml" === Yt(n)) {
					const t = n[":@"];
					if (t) {
						const n = e.attributeNamePrefix + "version";
						if (t[n]) return t[n];
					}
				}
				return "1.0";
			}(t, e);
			return Bt(t, e, n, new J(), i, s);
		}
		function Bt(t, e, n, i, s, r) {
			let o = "", a = !1;
			if (e.maxNestedTags && i.getDepth() > e.maxNestedTags) throw new Error("Maximum nested tags exceeded");
			if (!Array.isArray(t)) {
				if (null != t) {
					let n = t.toString();
					return n = Jt(n, e), n;
				}
				return "";
			}
			for (let h = 0; h < t.length; h++) {
				const l = t[h], u = Yt(l);
				if (void 0 === u) continue;
				const p = u === e.textNodeName || u === e.cdataPropName || u === e.commentPropName || "?" === u[0] ? u : Gt(u, !1, e, i, r), c = Wt(l[":@"], e);
				i.push(p, c);
				const d = Zt(i, s);
				if (p === e.textNodeName) {
					let t = l[u];
					d || (t = e.tagValueProcessor(p, t), t = Jt(t, e)), a && (o += n), o += t, a = !1, i.pop();
					continue;
				}
				if (p === e.cdataPropName) {
					a && (o += n), o += `<![CDATA[${Rt(l[u][0][e.textNodeName])}]]>`, a = !1, i.pop();
					continue;
				}
				if (p === e.commentPropName) {
					o += n + `\x3c!--${kt(l[u][0][e.textNodeName])}--\x3e`, a = !0, i.pop();
					continue;
				}
				if ("?" === p[0]) {
					o += ("?xml" === p ? "" : n) + `<${p}${qt(l[":@"], e, d, i, r)}?>`, a = !0, i.pop();
					continue;
				}
				let f = n;
				"" !== f && (f += e.indentBy);
				const g = n + `<${p}${qt(l[":@"], e, d, i, r)}`;
				let m;
				m = d ? zt(l[u], e) : Bt(l[u], e, f, i, s, r), -1 !== e.unpairedTags.indexOf(p) ? e.suppressUnpairedNode ? o += g + ">" : o += g + "/>" : m && 0 !== m.length || !e.suppressEmptyNode ? m && m.endsWith(">") ? o += g + `>${m}${n}</${p}>` : (o += g + ">", m && "" !== n && (m.includes("/>") || m.includes("</")) ? o += n + e.indentBy + m + n : o += m, o += `</${p}>`) : o += g + "/>", a = !0, i.pop();
			}
			return o;
		}
		function Wt(t, e) {
			if (!t || e.ignoreAttributes) return null;
			const n = {};
			let i = !1;
			for (let s in t) Object.prototype.hasOwnProperty.call(t, s) && (n[s.startsWith(e.attributeNamePrefix) ? s.substr(e.attributeNamePrefix.length) : s] = Ft(t[s]), i = !0);
			return i ? n : null;
		}
		function zt(t, e) {
			if (!Array.isArray(t)) return null != t ? t.toString() : "";
			let n = "";
			for (let i = 0; i < t.length; i++) {
				const s = t[i], r = Yt(s);
				if (r === e.textNodeName) n += s[r];
				else if (r === e.cdataPropName) n += s[r][0][e.textNodeName];
				else if (r === e.commentPropName) n += s[r][0][e.textNodeName];
				else {
					if (r && "?" === r[0]) continue;
					if (r) {
						const t = Xt(s[":@"], e), i = zt(s[r], e);
						i && 0 !== i.length ? n += `<${r}${t}>${i}</${r}>` : n += `<${r}${t}/>`;
					}
				}
			}
			return n;
		}
		function Xt(t, e) {
			let n = "";
			if (t && !e.ignoreAttributes) for (let i in t) {
				if (!Object.prototype.hasOwnProperty.call(t, i)) continue;
				let s = t[i];
				!0 === s && e.suppressBooleanAttributes ? n += ` ${i.substr(e.attributeNamePrefix.length)}` : n += ` ${i.substr(e.attributeNamePrefix.length)}="${Ft(s)}"`;
			}
			return n;
		}
		function Yt(t) {
			const e = Object.keys(t);
			for (let n = 0; n < e.length; n++) {
				const i = e[n];
				if (Object.prototype.hasOwnProperty.call(t, i) && ":@" !== i) return i;
			}
		}
		function qt(t, e, n, i, s) {
			let r = "";
			if (t && !e.ignoreAttributes) for (let o in t) {
				if (!Object.prototype.hasOwnProperty.call(t, o)) continue;
				const a = o.substr(e.attributeNamePrefix.length), h = n ? a : Gt(a, !0, e, i, s);
				let l;
				n ? l = t[o] : (l = e.attributeValueProcessor(o, t[o]), l = Jt(l, e)), !0 === l && e.suppressBooleanAttributes ? r += ` ${h}` : r += ` ${h}="${Ft(l)}"`;
			}
			return r;
		}
		function Zt(t, e) {
			if (!e || 0 === e.length) return !1;
			for (let n = 0; n < e.length; n++) if (t.matches(e[n])) return !0;
			return !1;
		}
		function Jt(t, e) {
			if (t && t.length > 0 && e.processEntities) for (let n = 0; n < e.entities.length; n++) {
				const i = e.entities[n];
				t = t.replace(i.regex, i.val);
			}
			return t;
		}
		const Kt = {
			attributeNamePrefix: "@_",
			attributesGroupName: !1,
			textNodeName: "#text",
			ignoreAttributes: !0,
			cdataPropName: !1,
			format: !1,
			indentBy: "  ",
			suppressEmptyNode: !1,
			suppressUnpairedNode: !0,
			suppressBooleanAttributes: !0,
			tagValueProcessor: function(t, e) {
				return e;
			},
			attributeValueProcessor: function(t, e) {
				return e;
			},
			preserveOrder: !1,
			commentPropName: !1,
			unpairedTags: [],
			entities: [
				{
					regex: /* @__PURE__ */ new RegExp("&", "g"),
					val: "&amp;"
				},
				{
					regex: /* @__PURE__ */ new RegExp(">", "g"),
					val: "&gt;"
				},
				{
					regex: /* @__PURE__ */ new RegExp("<", "g"),
					val: "&lt;"
				},
				{
					regex: /* @__PURE__ */ new RegExp("'", "g"),
					val: "&apos;"
				},
				{
					regex: /* @__PURE__ */ new RegExp("\"", "g"),
					val: "&quot;"
				}
			],
			processEntities: !0,
			stopNodes: [],
			oneListGroup: !1,
			maxNestedTags: 100,
			jPath: !0,
			sanitizeName: !1
		};
		function Qt(t) {
			if (this.options = Object.assign({}, Kt, t), this.options.stopNodes && Array.isArray(this.options.stopNodes) && (this.options.stopNodes = this.options.stopNodes.map((t) => "string" == typeof t && t.startsWith("*.") ? ".." + t.substring(2) : t)), this.stopNodeExpressions = [], this.options.stopNodes && Array.isArray(this.options.stopNodes)) for (let t = 0; t < this.options.stopNodes.length; t++) {
				const e = this.options.stopNodes[t];
				"string" == typeof e ? this.stopNodeExpressions.push(new K(e)) : e instanceof K && this.stopNodeExpressions.push(e);
			}
			var e;
			!0 === this.options.ignoreAttributes || this.options.attributesGroupName ? this.isAttribute = function() {
				return !1;
			} : (this.ignoreAttributesFn = "function" == typeof (e = this.options.ignoreAttributes) ? e : Array.isArray(e) ? (t) => {
				for (const n of e) {
					if ("string" == typeof n && t === n) return !0;
					if (n instanceof RegExp && n.test(t)) return !0;
				}
			} : () => !1, this.attrPrefixLen = this.options.attributeNamePrefix.length, this.isAttribute = ne), this.processTextOrObjNode = te, this.options.format ? (this.indentate = ee, this.tagEndChar = ">\n", this.newLine = "\n") : (this.indentate = function() {
				return "";
			}, this.tagEndChar = ">", this.newLine = "");
		}
		function Ht(t, e, n, i, s) {
			return n.sanitizeName ? L(t, { xmlVersion: s }) ? t : n.sanitizeName(t, {
				isAttribute: e,
				matcher: i.readOnly()
			}) : t;
		}
		function te(t, e, n, i, s) {
			const r = this.extractAttributes(t);
			if (i.push(e, r), this.checkStopNode(i)) {
				const s = this.buildRawContent(t), r = this.buildAttributesForStopNode(t);
				return i.pop(), this.buildObjectNode(s, e, r, n);
			}
			const o = this.j2x(t, n + 1, i, s);
			return i.pop(), "?" === e[0] ? this.buildTextValNode("", e, o.attrStr, n, i) : void 0 !== t[this.options.textNodeName] && 1 === Object.keys(t).length ? this.buildTextValNode(t[this.options.textNodeName], e, o.attrStr, n, i) : this.buildObjectNode(o.val, e, o.attrStr, n);
		}
		function ee(t) {
			return this.options.indentBy.repeat(t);
		}
		function ne(t) {
			return !(!t.startsWith(this.options.attributeNamePrefix) || t === this.options.textNodeName) && t.substr(this.attrPrefixLen);
		}
		Qt.prototype.build = function(t) {
			if (this.options.preserveOrder) return Ut(t, this.options);
			{
				Array.isArray(t) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1 && (t = { [this.options.arrayNodeName]: t });
				const e = new J(), n = function(t, e) {
					const n = t["?xml"];
					if (n && "object" == typeof n) {
						if (e.attributesGroupName && n[e.attributesGroupName]) {
							const t = n[e.attributesGroupName][e.attributeNamePrefix + "version"];
							if (t) return t;
						}
						const t = n[e.attributeNamePrefix + "version"];
						if (t) return t;
					}
					return "1.0";
				}(t, this.options);
				return this.j2x(t, 0, e, n).val;
			}
		}, Qt.prototype.j2x = function(t, e, n, i) {
			let s = "", r = "";
			if (this.options.maxNestedTags && n.getDepth() >= this.options.maxNestedTags) throw new Error("Maximum nested tags exceeded");
			const o = this.options.jPath ? n.toString() : n, a = this.checkStopNode(n);
			for (let h in t) {
				if (!Object.prototype.hasOwnProperty.call(t, h)) continue;
				const l = h === this.options.textNodeName || h === this.options.cdataPropName || h === this.options.commentPropName || this.options.attributesGroupName && h === this.options.attributesGroupName || this.isAttribute(h) || "?" === h[0] ? h : Ht(h, !1, this.options, n, i);
				if (void 0 === t[h]) this.isAttribute(h) && (r += "");
				else if (null === t[h]) this.isAttribute(h) || l === this.options.cdataPropName || l === this.options.commentPropName ? r += "" : "?" === l[0] ? r += this.indentate(e) + "<" + l + "?" + this.tagEndChar : r += this.indentate(e) + "<" + l + "/" + this.tagEndChar;
				else if (t[h] instanceof Date) r += this.buildTextValNode(t[h], l, "", e, n);
				else if ("object" != typeof t[h]) {
					const u = this.isAttribute(h);
					if (u && !this.ignoreAttributesFn(u, o)) {
						const e = Ht(u, !0, this.options, n, i);
						s += this.buildAttrPairStr(e, "" + t[h], a);
					} else if (!u) if (h === this.options.textNodeName) {
						let e = this.options.tagValueProcessor(h, "" + t[h]);
						r += this.replaceEntitiesValue(e);
					} else {
						n.push(l);
						const i = this.checkStopNode(n);
						if (n.pop(), i) {
							const n = "" + t[h];
							r += "" === n ? this.indentate(e) + "<" + l + this.closeTag(l) + this.tagEndChar : this.indentate(e) + "<" + l + ">" + n + "</" + l + this.tagEndChar;
						} else r += this.buildTextValNode(t[h], l, "", e, n);
					}
				} else if (Array.isArray(t[h])) {
					const s = t[h].length;
					let o = "", a = "";
					for (let u = 0; u < s; u++) {
						const s = t[h][u];
						if (void 0 === s);
						else if (null === s) "?" === l[0] ? r += this.indentate(e) + "<" + l + "?" + this.tagEndChar : r += this.indentate(e) + "<" + l + "/" + this.tagEndChar;
						else if ("object" == typeof s) if (this.options.oneListGroup) {
							n.push(l);
							const t = this.j2x(s, e + 1, n, i);
							n.pop(), o += t.val, this.options.attributesGroupName && s.hasOwnProperty(this.options.attributesGroupName) && (a += t.attrStr);
						} else o += this.processTextOrObjNode(s, l, e, n, i);
						else if (this.options.oneListGroup) {
							let t = this.options.tagValueProcessor(l, s);
							t = this.replaceEntitiesValue(t), o += t;
						} else {
							n.push(l);
							const t = this.checkStopNode(n);
							if (n.pop(), t) {
								const t = "" + s;
								o += "" === t ? this.indentate(e) + "<" + l + this.closeTag(l) + this.tagEndChar : this.indentate(e) + "<" + l + ">" + t + "</" + l + this.tagEndChar;
							} else o += this.buildTextValNode(s, l, "", e, n);
						}
					}
					this.options.oneListGroup && (o = this.buildObjectNode(o, l, a, e)), r += o;
				} else if (this.options.attributesGroupName && h === this.options.attributesGroupName) {
					const e = Object.keys(t[h]), r = e.length;
					for (let o = 0; o < r; o++) {
						const r = Ht(e[o], !0, this.options, n, i);
						s += this.buildAttrPairStr(r, "" + t[h][e[o]], a);
					}
				} else r += this.processTextOrObjNode(t[h], l, e, n, i);
			}
			return {
				attrStr: s,
				val: r
			};
		}, Qt.prototype.buildAttrPairStr = function(t, e, n) {
			return n || (e = this.options.attributeValueProcessor(t, "" + e), e = this.replaceEntitiesValue(e)), this.options.suppressBooleanAttributes && "true" === e ? " " + t : " " + t + "=\"" + Ft(e) + "\"";
		}, Qt.prototype.extractAttributes = function(t) {
			if (!t || "object" != typeof t) return null;
			const e = {};
			let n = !1;
			if (this.options.attributesGroupName && t[this.options.attributesGroupName]) {
				const i = t[this.options.attributesGroupName];
				for (let t in i) Object.prototype.hasOwnProperty.call(i, t) && (e[t.startsWith(this.options.attributeNamePrefix) ? t.substring(this.options.attributeNamePrefix.length) : t] = Ft(i[t]), n = !0);
			} else for (let i in t) {
				if (!Object.prototype.hasOwnProperty.call(t, i)) continue;
				const s = this.isAttribute(i);
				s && (e[s] = Ft(t[i]), n = !0);
			}
			return n ? e : null;
		}, Qt.prototype.buildRawContent = function(t) {
			if ("string" == typeof t) return t;
			if ("object" != typeof t || null === t) return String(t);
			if (void 0 !== t[this.options.textNodeName]) return t[this.options.textNodeName];
			let e = "";
			for (let n in t) {
				if (!Object.prototype.hasOwnProperty.call(t, n)) continue;
				if (this.isAttribute(n)) continue;
				if (this.options.attributesGroupName && n === this.options.attributesGroupName) continue;
				const i = t[n];
				if (n === this.options.textNodeName) e += i;
				else if (Array.isArray(i)) {
					for (let t of i) if ("string" == typeof t || "number" == typeof t) e += `<${n}>${t}</${n}>`;
					else if ("object" == typeof t && null !== t) {
						const i = this.buildRawContent(t), s = this.buildAttributesForStopNode(t);
						e += "" === i ? `<${n}${s}/>` : `<${n}${s}>${i}</${n}>`;
					}
				} else if ("object" == typeof i && null !== i) {
					const t = this.buildRawContent(i), s = this.buildAttributesForStopNode(i);
					e += "" === t ? `<${n}${s}/>` : `<${n}${s}>${t}</${n}>`;
				} else e += `<${n}>${i}</${n}>`;
			}
			return e;
		}, Qt.prototype.buildAttributesForStopNode = function(t) {
			if (!t || "object" != typeof t) return "";
			let e = "";
			if (this.options.attributesGroupName && t[this.options.attributesGroupName]) {
				const n = t[this.options.attributesGroupName];
				for (let t in n) {
					if (!Object.prototype.hasOwnProperty.call(n, t)) continue;
					const i = t.startsWith(this.options.attributeNamePrefix) ? t.substring(this.options.attributeNamePrefix.length) : t, s = n[t];
					!0 === s && this.options.suppressBooleanAttributes ? e += " " + i : e += " " + i + "=\"" + s + "\"";
				}
			} else for (let n in t) {
				if (!Object.prototype.hasOwnProperty.call(t, n)) continue;
				const i = this.isAttribute(n);
				if (i) {
					const s = t[n];
					!0 === s && this.options.suppressBooleanAttributes ? e += " " + i : e += " " + i + "=\"" + s + "\"";
				}
			}
			return e;
		}, Qt.prototype.buildObjectNode = function(t, e, n, i) {
			if ("" === t) return "?" === e[0] ? this.indentate(i) + "<" + e + n + "?" + this.tagEndChar : this.indentate(i) + "<" + e + n + this.closeTag(e) + this.tagEndChar;
			if ("?" === e[0]) return this.indentate(i) + "<" + e + n + "?" + this.tagEndChar;
			{
				let s = "</" + e + this.tagEndChar, r = "";
				return "?" === e[0] && (r = "?", s = ""), !n && "" !== n || -1 !== t.indexOf("<") ? !1 !== this.options.commentPropName && e === this.options.commentPropName && 0 === r.length ? this.indentate(i) + `\x3c!--${t}--\x3e` + this.newLine : this.indentate(i) + "<" + e + n + r + this.tagEndChar + t + this.indentate(i) + s : this.indentate(i) + "<" + e + n + r + ">" + t + s;
			}
		}, Qt.prototype.closeTag = function(t) {
			let e = "";
			return -1 !== this.options.unpairedTags.indexOf(t) ? this.options.suppressUnpairedNode || (e = "/") : e = this.options.suppressEmptyNode ? "/" : `></${t}`, e;
		}, Qt.prototype.checkStopNode = function(t) {
			if (!this.stopNodeExpressions || 0 === this.stopNodeExpressions.length) return !1;
			for (let e = 0; e < this.stopNodeExpressions.length; e++) if (t.matches(this.stopNodeExpressions[e])) return !0;
			return !1;
		}, Qt.prototype.buildTextValNode = function(t, e, n, i, s) {
			if (!1 !== this.options.cdataPropName && e === this.options.cdataPropName) {
				const e = Rt(t);
				return this.indentate(i) + `<![CDATA[${e}]]>` + this.newLine;
			}
			if (!1 !== this.options.commentPropName && e === this.options.commentPropName) {
				const e = kt(t);
				return this.indentate(i) + `\x3c!--${e}--\x3e` + this.newLine;
			}
			if ("?" === e[0]) return this.indentate(i) + "<" + e + n + "?" + this.tagEndChar;
			{
				let s = this.options.tagValueProcessor(e, t);
				return s = this.replaceEntitiesValue(s), "" === s ? this.indentate(i) + "<" + e + n + this.closeTag(e) + this.tagEndChar : this.indentate(i) + "<" + e + n + ">" + s + "</" + e + this.tagEndChar;
			}
		}, Qt.prototype.replaceEntitiesValue = function(t) {
			if (t && t.length > 0 && this.options.processEntities) for (let e = 0; e < this.options.entities.length; e++) {
				const n = this.options.entities[e];
				t = t.replace(n.regex, n.val);
			}
			return t;
		};
		const ie = Qt, se = { validate: l };
		module.exports = e;
	})();
}));
//#endregion
//#region electron/services/scanner.ts
/** Safely send IPC to renderer — no-op if the window was already closed */
function safeSend(sender, channel, data) {
	if (!sender.isDestroyed()) sender.send(channel, data);
}
var XMLParser, ScannerService;
var init_scanner = __esmMin((() => {
	init_logger();
	init_storage();
	init_settings();
	({XMLParser} = require_fxp());
	ScannerService = class {
		constructor() {
			this.activeScans = /* @__PURE__ */ new Map();
			this.scanStats = /* @__PURE__ */ new Map();
			this.statEmitIntervals = /* @__PURE__ */ new Map();
		}
		/** Check if a CLI tool is available on PATH */
		async checkTool(name) {
			try {
				if (path.default.isAbsolute(name) && fs.default.existsSync(name)) return {
					available: true,
					resolvedPath: name
				};
				if (process.platform === "win32" && [
					"httpx",
					"subfinder",
					"nuclei"
				].includes(name)) {
					const goPath = path.default.join(os.default.homedir(), "go", "bin", `${name}.exe`);
					if (fs.default.existsSync(goPath)) return {
						available: true,
						resolvedPath: goPath
					};
				}
				return {
					available: true,
					resolvedPath: (0, child_process.execSync)(process.platform === "win32" ? `where ${name}` : `which ${name}`, { stdio: "pipe" }).toString().trim().split("\n")[0].trim()
				};
			} catch {
				if (process.platform === "win32" && name === "nmap") {
					for (const p of ["C:\\Program Files (x86)\\Nmap\\nmap.exe", "C:\\Program Files\\Nmap\\nmap.exe"]) if (fs.default.existsSync(p)) return {
						available: true,
						resolvedPath: p
					};
				}
				return { available: false };
			}
		}
		async startScan(sender, targetUrl, config) {
			try {
				let finalUrl = targetUrl.trim();
				if (!finalUrl.startsWith("http")) finalUrl = `https://${finalUrl}`;
				try {
					const parsed = new URL(finalUrl);
					if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return {
						success: false,
						error: "Invalid URL protocol"
					};
					targetUrl = finalUrl;
				} catch {
					return {
						success: false,
						error: "Invalid URL format"
					};
				}
				const settings = settingsStore.get();
				const domain = new URL(targetUrl).hostname;
				const requestedTools = config.tools || ["nuclei", "wapiti"];
				const toolBinaries = {
					nuclei: settings.nucleiPath || "nuclei",
					wapiti: settings.wapitiPath || "wapiti",
					subfinder: settings.subfinderPath || "subfinder",
					httpx: settings.httpxPath || "httpx",
					nmap: settings.nmapPath || "nmap",
					zap: settings.zapPath || "zap.bat",
					katana: settings.katanaPath || "katana",
					ffuf: settings.ffufPath || "ffuf",
					appscan: settings.appscanPath || "C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe",
					netsparker: settings.netsparkerPath || path.default.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Invicti Professional Edition", "Netsparker.exe"),
					acunetix: process.execPath,
					wpscan: "docker"
				};
				const toolsToRun = requestedTools.filter((t) => toolBinaries[t]);
				const checks = await Promise.all(toolsToRun.map((t) => this.checkTool(toolBinaries[t])));
				const missing = [];
				toolsToRun.forEach((t, idx) => {
					if (!checks[idx].available) missing.push(`${t} ("${toolBinaries[t]}")`);
					else if (checks[idx].resolvedPath) toolBinaries[t] = checks[idx].resolvedPath;
				});
				if (missing.length > 0) return {
					success: false,
					error: `Tool not found on PATH: ${missing.join(", ")}. Install them or configure the binary path in Settings.`
				};
				const { scanId, scanDir, nucleiDir, wapitiDir } = storage.createScanDirectory(domain);
				storage.saveMetadata(scanId, {
					scanId,
					target: targetUrl,
					domain,
					startTime: (/* @__PURE__ */ new Date()).toISOString(),
					status: "RUNNING",
					config: {
						...config,
						tools: toolsToRun
					}
				});
				this.activeScans.set(scanId, {});
				this.scanStats.set(scanId, {
					nuclei: {
						info: 0,
						low: 0,
						medium: 0,
						high: 0,
						critical: 0
					},
					wapiti: {
						vulns: 0,
						pages: 0
					}
				});
				this.statEmitIntervals.set(scanId, setInterval(() => {
					const stats = this.scanStats.get(scanId);
					if (stats) safeSend(sender, "scan:stats", {
						scanId,
						stats
					});
				}, 1e3));
				for (const tool of toolsToRun) {
					const outDir = tool === "nuclei" ? nucleiDir : tool === "wapiti" ? wapitiDir : scanDir;
					this.runGenericTool(sender, scanId, targetUrl, domain, tool, toolBinaries[tool], outDir, config);
				}
				return {
					success: true,
					scanId
				};
			} catch (error) {
				logger.error("Failed to start scan", error);
				return {
					success: false,
					error: error.message
				};
			}
		}
		runGenericTool(sender, scanId, targetUrl, domain, scannerName, bin, outDir, config) {
			const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "");
			const outputFile = path.default.join(outDir, `${scannerName}_${domain}_${timestamp}.txt`);
			const jsonFile = path.default.join(outDir, `${scannerName}_${domain}_${timestamp}.json`);
			const xmlFile = path.default.join(outDir, `${scannerName}_${domain}_${timestamp}.xml`);
			let args = [];
			const isWordpress = config?.isWordpress;
			switch (scannerName) {
				case "nuclei":
					let nucleiArgs = [
						"-u",
						targetUrl,
						"-severity",
						"info,low,medium,high,critical",
						"-stats",
						"-duc",
						"-ni",
						"-v",
						"-o",
						outputFile,
						"-je",
						jsonFile
					];
					if (isWordpress) nucleiArgs.splice(2, 0, "-tags", "wordpress,wp-plugin,wp-theme");
					if (settingsStore.get().nucleiTemplatesPath) nucleiArgs.push("-t", settingsStore.get().nucleiTemplatesPath);
					args = nucleiArgs;
					break;
				case "wapiti":
					args = [
						"-u",
						targetUrl,
						"-l",
						"2",
						"-v",
						"2",
						"-f",
						"json",
						"-dr",
						"2",
						"-o",
						jsonFile
					];
					break;
				case "subfinder":
					args = [
						"-d",
						domain,
						"-json",
						"-o",
						jsonFile
					];
					break;
				case "alterx":
					args = ["-o", outputFile];
					break;
				case "dnsx":
					args = [
						"-json",
						"-o",
						jsonFile
					];
					break;
				case "naabu":
					args = [
						"-host",
						domain,
						"-top-ports",
						"100",
						"-json",
						"-o",
						jsonFile
					];
					break;
				case "tlsx":
					args = [
						"-u",
						domain,
						"-json",
						"-o",
						jsonFile
					];
					break;
				case "httpx":
					args = [
						"-u",
						targetUrl,
						"-title",
						"-tech-detect",
						"-status-code",
						"-json",
						"-o",
						jsonFile
					];
					break;
				case "nmap":
					args = [
						"-sV",
						"-sC",
						domain,
						"-oN",
						outputFile
					];
					break;
				case "zap":
					const zapHome = path.default.join(outDir, `zap_home_${timestamp}`);
					if (!fs.default.existsSync(zapHome)) fs.default.mkdirSync(zapHome, { recursive: true });
					args = [
						"-cmd",
						"-quickurl",
						targetUrl,
						"-quickout",
						jsonFile,
						"-quickprogress",
						"-dir",
						zapHome
					];
					break;
				case "wpscan":
					args = [
						"run",
						"--rm",
						"-v",
						`${outDir}:/mnt`,
						"wpscanteam/wpscan",
						"--url",
						targetUrl,
						"-f",
						"cli-no-color",
						"-f",
						"json",
						"-o",
						`/mnt/${path.default.basename(jsonFile)}`,
						"--random-user-agent",
						"--force",
						"--disable-tls-checks"
					];
					if (settingsStore.get().wpscanApiToken) args.push("--api-token", settingsStore.get().wpscanApiToken);
					break;
				case "katana":
					args = [
						"-u",
						targetUrl,
						"-j",
						"-o",
						jsonFile
					];
					break;
				case "ffuf":
					const wordlist = settingsStore.get().wordlistPath ? path.default.resolve(process.cwd(), settingsStore.get().wordlistPath) : "C:\\wordlists\\common.txt";
					if (!fs.default.existsSync(wordlist)) {
						setTimeout(() => {
							safeSend(sender, "scan:output", {
								scanId,
								scanner: scannerName,
								type: "stderr",
								message: `[ERROR] Wordlist not found at ${wordlist}. Please configure Wordlist Path in Settings.`
							});
							storage.updateStatus(scanId, scannerName, "FAILED");
							safeSend(sender, "scan:status", {
								scanId,
								scanner: scannerName,
								status: "FAILED"
							});
						}, 500);
						return;
					}
					args = [
						"-u",
						`${targetUrl}/FUZZ`,
						"-w",
						wordlist,
						"-v",
						"-o",
						jsonFile,
						"-of",
						"json"
					];
					break;
				case "appscan":
					args = [
						"exec",
						"/su",
						targetUrl,
						"/dest",
						path.default.join(outDir, `appscan_${timestamp}.scan`),
						"/rf",
						xmlFile,
						"/rt",
						"xml",
						"/v"
					];
					break;
				case "netsparker":
					args = [
						"/a",
						"/url",
						targetUrl,
						"/r",
						xmlFile,
						"/silent"
					];
					break;
				case "acunetix":
					const runnerPath = require("electron").app.isPackaged ? path.default.join(process.resourcesPath, "scripts", "acunetix_runner.js") : path.default.join(process.cwd(), "electron", "scripts", "acunetix_runner.js");
					const s = settingsStore.get();
					args = [
						runnerPath,
						targetUrl,
						jsonFile,
						xmlFile,
						s.acunetixUrl || "https://127.0.0.1:13443",
						"",
						s.acunetixProfileId || "11111111-1111-1111-1111-111111111111"
					];
					break;
				default: args = [targetUrl];
			}
			let env = { ...process.env };
			if (scannerName === "wapiti") env.PYTHONIOENCODING = "utf-8";
			else if (scannerName === "acunetix") {
				env.ELECTRON_RUN_AS_NODE = "1";
				const s = settingsStore.get();
				if (s.acunetixApiKey) env.ACUNETIX_API_KEY = s.acunetixApiKey;
				if (s.acunetixEmail) env.ACUNETIX_EMAIL = s.acunetixEmail;
				if (s.acunetixPassword) env.ACUNETIX_PASSWORD = s.acunetixPassword;
			}
			const isBat = bin.toLowerCase().endsWith(".bat") || bin.toLowerCase().endsWith(".cmd");
			const cwd = scannerName === "zap" ? path.default.dirname(bin) : process.cwd();
			const executable = scannerName === "zap" && isBat ? path.default.basename(bin) : bin;
			let spawnExecutable = executable;
			let spawnArgs = args;
			let useShell = false;
			if (scannerName === "netsparker") {
				spawnExecutable = "powershell.exe";
				const script = `Start-Process -Wait -NoNewWindow -FilePath '${executable}' -ArgumentList ${args.map((a) => `'${a.replace(/'/g, "''")}'`).join(", ")}`;
				spawnArgs = [
					"-NoProfile",
					"-ExecutionPolicy",
					"Bypass",
					"-EncodedCommand",
					Buffer.from(script, "utf16le").toString("base64")
				];
			} else if (isBat && process.platform === "win32") {
				spawnExecutable = process.env.comspec || "cmd.exe";
				spawnArgs = [
					"/c",
					executable,
					...args
				];
				useShell = false;
			} else if (isBat) useShell = true;
			const processInstance = (0, child_process.spawn)(spawnExecutable, spawnArgs, {
				env,
				cwd,
				shell: useShell,
				windowsVerbatimArguments: false
			});
			if (processInstance.stdin) {
				if (["alterx", "dnsx"].includes(scannerName)) processInstance.stdin.write(domain + "\n");
				processInstance.stdin.end();
			}
			const scanSession = this.activeScans.get(scanId);
			if (scanSession) scanSession[scannerName] = processInstance;
			processInstance.stdout?.on("data", (data) => {
				const msg = data.toString();
				safeSend(sender, "scan:output", {
					scanId,
					scanner: scannerName,
					type: "stdout",
					message: msg
				});
				const stats = this.scanStats.get(scanId);
				if (stats) {
					if (scannerName === "nuclei") {
						const lines = msg.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "").split("\n");
						for (const line of lines) {
							const sev = line.match(/\[(info|low|medium|high|critical)\]/i);
							if (sev && !line.includes("[WRN]") && !line.includes("[DBG]") && !line.includes("[VER]")) {
								const key = sev[1].toLowerCase();
								stats.nuclei[key]++;
							}
						}
					} else if (scannerName === "wapiti") {
						const cleanMsg = msg.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
						const urlsMatch = cleanMsg.match(/found (\d+) URLs/);
						if (urlsMatch) stats.wapiti.pages = parseInt(urlsMatch[1]);
						if (cleanMsg.includes("vulnerability found in")) stats.wapiti.vulns++;
						else for (const pat of [/\[\+\] .*vulnerability found/, /\[!!\]/]) if (pat.test(cleanMsg) && !cleanMsg.includes("vulnerability found in")) {
							stats.wapiti.vulns++;
							break;
						}
					}
				}
			});
			processInstance.stderr?.on("data", (data) => {
				safeSend(sender, "scan:output", {
					scanId,
					scanner: scannerName,
					type: "stderr",
					message: data.toString()
				});
			});
			processInstance.on("error", (err) => {
				logger.error(`Failed to start ${scannerName}:`, err);
				safeSend(sender, "scan:output", {
					scanId,
					scanner: scannerName,
					type: "stderr",
					message: `[SYSTEM ERROR] Failed to spawn process: ${err.message}\nPlease check if the tool is installed and the path is correct in Settings.`
				});
				storage.updateStatus(scanId, scannerName, "FAILED");
				safeSend(sender, "scan:status", {
					scanId,
					scanner: scannerName,
					status: "FAILED"
				});
			});
			processInstance.on("exit", (code) => {
				logger.info(`${scannerName} process for ${scanId} exited with code ${code}`);
				const fileToRead = ["alterx", "nmap"].includes(scannerName) ? outputFile : ["appscan", "netsparker"].includes(scannerName) ? xmlFile : jsonFile;
				if (fs.default.existsSync(fileToRead)) try {
					const stats = fs.default.statSync(fileToRead);
					if (stats.size > 0 && stats.size < 5 * 1024 * 1024) {
						const content = fs.default.readFileSync(fileToRead, "utf-8");
						const lines = content.split("\n").filter((l) => l.trim() !== "");
						if (lines.length > 30) safeSend(sender, "scan:output", {
							scanId,
							scanner: scannerName,
							type: "stdout",
							message: `\n[SYSTEM] Tool finished. Generated ${lines.length} items. Last 10 lines:\n${lines.slice(-10).join("\n")}`
						});
						else safeSend(sender, "scan:output", {
							scanId,
							scanner: scannerName,
							type: "stdout",
							message: `\n[SYSTEM] Tool finished. Output:\n${content}`
						});
					} else if (stats.size > 0) safeSend(sender, "scan:output", {
						scanId,
						scanner: scannerName,
						type: "stdout",
						message: `\n[SYSTEM] Tool finished. Output file generated (Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB)`
					});
				} catch (e) {
					logger.error(`Error reading output file for ${scannerName}:`, e);
				}
				else safeSend(sender, "scan:output", {
					scanId,
					scanner: scannerName,
					type: "stderr",
					message: `\n[SYSTEM] Tool finished but no output file was generated.`
				});
				this.parseAndSendFindings(sender, scanId, scannerName, jsonFile, outputFile, xmlFile);
				const scanSession = this.activeScans.get(scanId);
				let allDone = true;
				if (scanSession) {
					for (const proc of Object.values(scanSession)) if (proc.exitCode === null && !proc.killed) {
						allDone = false;
						break;
					}
				}
				if (allDone) {
					const interval = this.statEmitIntervals.get(scanId);
					if (interval) {
						clearInterval(interval);
						this.statEmitIntervals.delete(scanId);
					}
				}
				storage.updateStatus(scanId, scannerName, code === 0 ? "COMPLETED" : "FAILED");
				safeSend(sender, "scan:status", {
					scanId,
					scanner: scannerName,
					status: code === 0 ? "COMPLETED" : "FAILED",
					code
				});
			});
			processInstance.on("error", (err) => {
				logger.error(`${scannerName} process error for ${scanId}`, err);
				storage.updateStatus(scanId, scannerName, "FAILED");
				safeSend(sender, "scan:status", {
					scanId,
					scanner: scannerName,
					status: "FAILED",
					error: err.message
				});
			});
		}
		async stopScan(scanId) {
			const processes = this.activeScans.get(scanId);
			if (processes) {
				for (const proc of Object.values(processes)) this.killProcess(proc);
				this.activeScans.delete(scanId);
				const interval = this.statEmitIntervals.get(scanId);
				if (interval) {
					clearInterval(interval);
					this.statEmitIntervals.delete(scanId);
				}
				storage.updateStatus(scanId, null, "STOPPED");
				logger.info(`Scan ${scanId} stopped by user`);
				return { success: true };
			}
			return {
				success: false,
				error: "Scan not found"
			};
		}
		parseAndSendFindings(sender, scanId, scannerName, jsonFile, outputFile, xmlFile) {
			if (!fs.default.existsSync(jsonFile) && !fs.default.existsSync(outputFile) && (!xmlFile || !fs.default.existsSync(xmlFile))) return;
			try {
				if (scannerName === "appscan" && xmlFile && fs.default.existsSync(xmlFile)) {
					const content = fs.default.readFileSync(xmlFile, "utf-8");
					const data = new XMLParser({
						ignoreAttributes: false,
						attributeNamePrefix: "@_"
					}).parse(content);
					const findings = [];
					const issues = data?.XmlReport?.Issues?.Issue || data?.Issues?.Issue || [];
					const issuesArray = Array.isArray(issues) ? issues : [issues];
					for (const issue of issuesArray) {
						if (!issue) continue;
						findings.push({
							id: issue["@_IssueTypeID"] || "appscan-finding",
							name: issue.IssueType?.name || issue["@_IssueType"] || "AppScan Finding",
							severity: issue["@_Severity"]?.toLowerCase() || "medium",
							scanner: "appscan",
							url: issue.Entity?.name || issue["@_Url"] || "",
							description: issue.Variant?.[0]?.Difference || issue.Difference || "",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						});
					}
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "netsparker" && xmlFile && fs.default.existsSync(xmlFile)) {
					const content = fs.default.readFileSync(xmlFile, "utf-8");
					const data = new XMLParser({
						ignoreAttributes: false,
						attributeNamePrefix: "@_"
					}).parse(content);
					const findings = [];
					const vulns = data?.netsparker?.vulnerabilities?.vulnerability || data?.vulnerabilities?.vulnerability || [];
					const vulnsArray = Array.isArray(vulns) ? vulns : [vulns];
					for (const vuln of vulnsArray) {
						if (!vuln) continue;
						findings.push({
							id: vuln.type || "netsparker-finding",
							name: vuln.name || "Netsparker Finding",
							severity: vuln.severity?.toLowerCase() || "medium",
							scanner: "netsparker",
							url: vuln.url || "",
							description: vuln.description || "",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						});
					}
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "acunetix") {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const vulns = JSON.parse(content);
					const findings = [];
					for (const vuln of vulns) {
						if (!vuln) continue;
						let severity = "info";
						if (vuln.severity === 3) severity = "high";
						else if (vuln.severity === 2) severity = "medium";
						else if (vuln.severity === 1) severity = "low";
						findings.push({
							id: vuln.vt_id || vuln.vuln_id || "acunetix-finding",
							name: vuln.vt_name || "Acunetix Finding",
							severity,
							scanner: "acunetix",
							url: vuln.affects_url || vuln.affects_detail || "",
							description: vuln.tags ? vuln.tags.join(", ") : "",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						});
					}
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "nuclei") {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const findings = [];
					const lines = content.split("\n").filter((l) => l.trim() !== "");
					for (const line of lines) try {
						const data = JSON.parse(line);
						findings.push({
							id: data["template-id"] || "nuclei-finding",
							name: data.info?.name || "Unknown",
							severity: data.info?.severity || "info",
							scanner: "nuclei",
							url: data["matched-at"] || data.host || "",
							description: data.info?.description || "",
							timestamp: data.timestamp || (/* @__PURE__ */ new Date()).toISOString()
						});
					} catch (e) {}
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "wapiti") {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const data = JSON.parse(content);
					const findings = [];
					if (data.vulnerabilities) for (const [vulnType, vulns] of Object.entries(data.vulnerabilities)) {
						const vulnArray = vulns;
						for (const v of vulnArray) findings.push({
							id: vulnType,
							name: vulnType,
							severity: v.level === 1 ? "low" : v.level === 2 ? "medium" : "high",
							scanner: "wapiti",
							url: v.path || "",
							description: v.info || "",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						});
					}
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if ([
					"naabu",
					"dnsx",
					"tlsx",
					"subfinder",
					"httpx"
				].includes(scannerName)) {
					if (!fs.default.existsSync(jsonFile)) return;
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const findings = [];
					const lines = content.split("\n").filter((l) => l.trim() !== "");
					for (const line of lines) try {
						const data = JSON.parse(line);
						findings.push({
							id: `${scannerName}-finding`,
							name: data.host || data.url || data.title || "Discovered Item",
							severity: "info",
							scanner: scannerName,
							url: data.url || data.host || "",
							description: JSON.stringify(data),
							timestamp: data.timestamp || (/* @__PURE__ */ new Date()).toISOString()
						});
					} catch (e) {}
					if (findings.length > 0) safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "nmap" && fs.default.existsSync(outputFile)) {
					const openPorts = fs.default.readFileSync(outputFile, "utf-8").split("\n").filter((l) => l.includes(" open "));
					if (openPorts.length > 0) safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings: [{
							id: "nmap-open-ports",
							name: "Nmap Open Ports",
							severity: "medium",
							scanner: "nmap",
							url: "",
							description: openPorts.join("\n"),
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						}]
					});
				} else if (scannerName === "alterx" && fs.default.existsSync(outputFile)) {
					const lines = fs.default.readFileSync(outputFile, "utf-8").split("\n").filter((l) => l.trim() !== "");
					if (lines.length > 0) safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings: [{
							id: "alterx-findings",
							name: "Alterx Permutations",
							severity: "info",
							scanner: "alterx",
							url: "",
							description: `Generated ${lines.length} domain permutations.`,
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						}]
					});
				} else if (scannerName === "wpscan" && fs.default.existsSync(jsonFile)) {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					try {
						const data = JSON.parse(content);
						const findings = [];
						if (data.interesting_findings) data.interesting_findings.forEach((f) => {
							findings.push({
								id: f.type || "wpscan-interesting",
								name: f.to_s || "Interesting Finding",
								severity: "info",
								scanner: "wpscan",
								url: f.url || "",
								description: f.interesting_entries?.join("\n") || "",
								timestamp: (/* @__PURE__ */ new Date()).toISOString()
							});
						});
						if (data.vulns) data.vulns.forEach((v) => {
							findings.push({
								id: v.title || "wpscan-vuln",
								name: v.title || "WPScan Vulnerability",
								severity: "high",
								scanner: "wpscan",
								url: "",
								description: v.references?.url?.join("\n") || "",
								timestamp: (/* @__PURE__ */ new Date()).toISOString()
							});
						});
						if (findings.length > 0) safeSend(sender, "scan:findings", {
							scanId,
							scanner: scannerName,
							findings
						});
					} catch (e) {
						logger.error("Failed to parse WPScan JSON:", e);
					}
				} else if (scannerName === "zap") {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const data = JSON.parse(content);
					const findings = [];
					const site = data?.site?.[0];
					if (site && site.alerts) for (const alert of site.alerts) findings.push({
						id: alert.pluginid || "zap-alert",
						name: alert.name || "ZAP Finding",
						severity: alert.riskdesc?.toLowerCase().includes("high") ? "high" : alert.riskdesc?.toLowerCase().includes("medium") ? "medium" : alert.riskdesc?.toLowerCase().includes("low") ? "low" : "info",
						scanner: "zap",
						url: alert.instances?.[0]?.uri || site["@name"] || "",
						description: alert.desc || "",
						timestamp: (/* @__PURE__ */ new Date()).toISOString()
					});
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "katana") {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const findings = [];
					const lines = content.split("\n").filter((l) => l.trim() !== "");
					for (const line of lines) try {
						const data = JSON.parse(line);
						findings.push({
							id: "katana-endpoint",
							name: "Endpoint Discovered",
							severity: "info",
							scanner: "katana",
							url: data.request?.endpoint || data.url || "",
							description: `Method: ${data.request?.method || "GET"}`,
							timestamp: data.timestamp || (/* @__PURE__ */ new Date()).toISOString()
						});
					} catch (e) {}
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "ffuf") {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const data = JSON.parse(content);
					const findings = [];
					if (data.results) for (const res of data.results) findings.push({
						id: "ffuf-directory",
						name: "Hidden Path Discovered",
						severity: "info",
						scanner: "ffuf",
						url: res.url || "",
						description: `Status: ${res.status}, Length: ${res.length}, Words: ${res.words}`,
						timestamp: (/* @__PURE__ */ new Date()).toISOString()
					});
					safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				} else if (scannerName === "wpscan" && fs.default.existsSync(jsonFile)) {
					const content = fs.default.readFileSync(jsonFile, "utf-8");
					const data = JSON.parse(content);
					const findings = [];
					if (data.scan_aborted) findings.push({
						id: "wpscan-aborted",
						name: "Scan Aborted",
						severity: "info",
						scanner: "wpscan",
						url: data.target_url || "",
						description: data.scan_aborted,
						timestamp: (/* @__PURE__ */ new Date()).toISOString()
					});
					if (data.interesting_findings) data.interesting_findings.forEach((finding) => {
						findings.push({
							id: "wpscan-finding",
							name: finding.type || finding.to_s || "Interesting Finding",
							severity: "info",
							scanner: "wpscan",
							url: finding.url || "",
							description: finding.to_s || "",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						});
					});
					if (data.version && data.version.vulnerabilities) data.version.vulnerabilities.forEach((v) => {
						findings.push({
							id: v.id || "wpscan-vuln",
							name: v.title || "WP Core Vulnerability",
							severity: "high",
							scanner: "wpscan",
							url: "",
							description: v.title || "",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						});
					});
					if (data.plugins) {
						for (const [pluginName, pluginData] of Object.entries(data.plugins)) if (pluginData.vulnerabilities) pluginData.vulnerabilities.forEach((v) => {
							findings.push({
								id: v.id || `wpscan-plugin-${pluginName}`,
								name: `Plugin Vuln: ${pluginName}`,
								severity: "medium",
								scanner: "wpscan",
								url: pluginData.location || "",
								description: v.title || "",
								timestamp: (/* @__PURE__ */ new Date()).toISOString()
							});
						});
					}
					if (data.themes) {
						for (const [themeName, themeData] of Object.entries(data.themes)) if (themeData.vulnerabilities) themeData.vulnerabilities.forEach((v) => {
							findings.push({
								id: v.id || `wpscan-theme-${themeName}`,
								name: `Theme Vuln: ${themeName}`,
								severity: "medium",
								scanner: "wpscan",
								url: themeData.location || "",
								description: v.title || "",
								timestamp: (/* @__PURE__ */ new Date()).toISOString()
							});
						});
					}
					if (findings.length > 0) safeSend(sender, "scan:findings", {
						scanId,
						scanner: scannerName,
						findings
					});
				}
			} catch (e) {
				logger.error(`Error parsing findings for ${scannerName}: ${e.message}`, e);
			}
		}
		/** Kill all running scans — called on app quit */
		killAll() {
			for (const [scanId, processes] of this.activeScans) {
				for (const proc of Object.values(processes)) this.killProcess(proc);
				logger.info(`Killed processes for scan ${scanId} (app quit)`);
			}
			this.activeScans.clear();
			for (const interval of this.statEmitIntervals.values()) clearInterval(interval);
			this.statEmitIntervals.clear();
		}
		/** Platform-safe process kill (Windows needs taskkill for tree-kill) */
		killProcess(proc) {
			if (!proc || proc.killed) return;
			try {
				if (process.platform === "win32" && proc.pid) (0, child_process.execSync)(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
				else proc.kill("SIGTERM");
			} catch {}
		}
	};
}));
//#endregion
//#region electron/services/updater.ts
var UpdaterService, updaterService;
var init_updater = __esmMin((() => {
	init_logger();
	UpdaterService = class {
		async updateTools(sender) {
			const sendOutput = (msg) => {
				logger.info(msg, "Updater");
				sender.send("update:output", msg);
			};
			sendOutput("[*] Starting tools update process...");
			try {
				const settings = (init_settings(), __toCommonJS(settings_exports)).settingsStore.get();
				const resolveTool = (name, settingPath) => {
					if (settingPath) return settingPath;
					if (process.platform === "win32" && [
						"httpx",
						"subfinder",
						"nuclei"
					].includes(name)) {
						const goPath = path.default.join(os.default.homedir(), "go", "bin", `${name}.exe`);
						if (fs.default.existsSync(goPath)) return goPath;
					}
					return name;
				};
				const nucleiBin = resolveTool("nuclei", settings.nucleiPath);
				settings.wapitiPath;
				const subfinderBin = resolveTool("subfinder", settings.subfinderPath);
				const httpxBin = resolveTool("httpx", settings.httpxPath);
				sendOutput("[+] Updating Nuclei Engine...");
				await this.runCommand(nucleiBin, ["-update"], sendOutput);
				sendOutput("[+] Updating Nuclei Templates...");
				await this.runCommand(nucleiBin, ["-update-templates"], sendOutput);
				sendOutput("[+] Updating Wapiti via pip...");
				await this.runCommand("pip", [
					"install",
					"--upgrade",
					"wapiti3"
				], sendOutput);
				sendOutput("[+] Updating Subfinder...");
				await this.runCommand(subfinderBin, ["-update"], sendOutput);
				sendOutput("[+] Updating httpx...");
				await this.runCommand(httpxBin, ["-update"], sendOutput);
				sendOutput("[*] Tools update completed successfully.");
				sender.send("update:status", "DONE");
			} catch (err) {
				sendOutput(`[-] Error during update: ${err.message}`);
				sender.send("update:status", "ERROR");
			}
		}
		runCommand(command, args, sendOutput) {
			return new Promise((resolve, reject) => {
				const proc = (0, child_process.spawn)(command, args, { shell: true });
				proc.stdout.on("data", (data) => {
					sendOutput(data.toString().trim());
				});
				proc.stderr.on("data", (data) => {
					sendOutput(data.toString().trim());
				});
				proc.on("close", (code) => {
					if (code === 0) resolve();
					else reject(/* @__PURE__ */ new Error(`Command ${command} failed with exit code ${code}`));
				});
				proc.on("error", (err) => {
					reject(err);
				});
			});
		}
	};
	updaterService = new UpdaterService();
}));
//#endregion
//#region electron/services/aiService.ts
var AIService, aiService;
var init_aiService = __esmMin((() => {
	init_logger();
	init_settings();
	AIService = class {
		async analyzeLogs(sender, logs, prompt) {
			const settings = settingsStore.get();
			const provider = settings.aiProvider;
			const apiKey = settings.aiApiKey;
			if (!apiKey && provider !== "ollama") throw new Error("AI API Key is not configured in Settings.");
			try {
				if (provider === "gemini") return await this.callGemini(apiKey, logs, prompt);
				else if (provider === "openai") return await this.callOpenAI(apiKey, logs, prompt);
				else if (provider === "anthropic") return await this.callAnthropic(apiKey, logs, prompt);
				else if (provider === "ollama") return await this.callOllama(sender, apiKey, logs, prompt);
				else throw new Error("Unknown AI Provider");
			} catch (err) {
				logger.error(`AI Analysis failed: ${err.message}`, err);
				throw new Error(`AI Analysis failed: ${err.message}`);
			}
		}
		async callGemini(apiKey, logs, prompt) {
			const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
			const payload = { contents: [{ parts: [{ text: `${prompt}\n\nLogs:\n${logs}` }] }] };
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`Gemini API Error: ${errText}`);
			}
			return (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
		}
		async callOpenAI(apiKey, logs, prompt) {
			const url = "https://api.openai.com/v1/chat/completions";
			const payload = {
				model: "gpt-4o",
				messages: [{
					role: "system",
					content: "You are a cybersecurity expert."
				}, {
					role: "user",
					content: `${prompt}\n\nLogs:\n${logs}`
				}]
			};
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${apiKey}`
				},
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`OpenAI API Error: ${errText}`);
			}
			return (await response.json()).choices?.[0]?.message?.content || "No response generated.";
		}
		async callAnthropic(apiKey, logs, prompt) {
			const url = "https://api.anthropic.com/v1/messages";
			const payload = {
				model: "claude-3-7-sonnet-20250219",
				max_tokens: 4096,
				messages: [{
					role: "user",
					content: `${prompt}\n\nLogs:\n${logs}`
				}]
			};
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01"
				},
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`Anthropic API Error: ${errText}`);
			}
			return (await response.json()).content?.[0]?.text || "No response generated.";
		}
		async callOllama(sender, apiKey, logs, prompt) {
			let baseUrl = "http://127.0.0.1:11434";
			let model = "qwen2.5:7b";
			if (apiKey) if (apiKey.includes(",")) {
				const parts = apiKey.split(",");
				baseUrl = parts[0].trim() || baseUrl;
				model = parts[1].trim() || model;
			} else if (apiKey.startsWith("http")) baseUrl = apiKey.trim();
			else model = apiKey.trim();
			baseUrl = baseUrl.replace("http://localhost", "http://127.0.0.1");
			const url = `${baseUrl}/api/generate`;
			const truncatedLogs = logs.length > 15e3 ? logs.substring(logs.length - 15e3) : logs;
			const finalPrompt = model.toLowerCase().startsWith("qwen3") ? `/no_think\n${prompt}\n\nLogs:\n${truncatedLogs}` : `${prompt}\n\nLogs:\n${truncatedLogs}`;
			const payload = {
				model,
				prompt: finalPrompt,
				stream: true
			};
			let response;
			try {
				response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
					signal: AbortSignal.timeout(15e3)
				});
			} catch (e) {
				if (e.name === "TimeoutError") throw new Error(`Connection to Ollama at ${baseUrl} timed out after 15s. Is the IP correct and firewall open?`);
				if (e.message?.includes("fetch failed") || e.code === "ECONNREFUSED") if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) try {
					sender.send("ai:progress", `Starting local Ollama daemon...`);
					(0, child_process.exec)("ollama serve");
					await new Promise((r) => setTimeout(r, 3e3));
					response = await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
						signal: AbortSignal.timeout(15e3)
					});
				} catch (startErr) {
					throw new Error(`Ollama is not running locally and could not be started. Please install it from https://ollama.com`);
				}
				else throw new Error(`Could not connect to Ollama at ${baseUrl}. (Internal: ${e.message || e.code})`);
				else throw new Error(`Ollama Request Failed: ${e.message || e.code || e}`);
			}
			if (!response || !response.ok) {
				const status = response ? response.status : 500;
				let errText = "";
				try {
					errText = await response?.text() || "";
				} catch {}
				if (status === 404) {
					sender.send("ai:progress", `Model "${model}" not found locally. Downloading automatically (this may take a few minutes depending on your internet speed)...`);
					try {
						const pullRes = await fetch(`${baseUrl}/api/pull`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ name: model })
						});
						if (!pullRes.ok) throw new Error("Pull failed: " + await pullRes.text());
						const reader = pullRes.body?.getReader();
						if (reader) {
							const decoder = new TextDecoder();
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								const lines = decoder.decode(value).split("\n").filter((l) => l.trim());
								for (const line of lines) try {
									const data = JSON.parse(line);
									if (data.status) {
										let progressText = `Downloading ${model}: ${data.status}`;
										if (data.total && data.completed) {
											const percent = Math.round(data.completed / data.total * 100);
											progressText += ` (${percent}%)`;
										}
										sender.send("ai:progress", progressText);
									}
								} catch (e) {}
							}
						}
						sender.send("ai:progress", `Download complete! Starting analysis...`);
						response = await fetch(url, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(payload)
						});
						if (!response.ok) throw new Error(`Analysis failed after pulling model. Error: ${await response.text()}`);
					} catch (pullError) {
						throw new Error(`Failed to automatically download model "${model}". Error: ${pullError.message}`);
					}
				} else throw new Error(`Ollama API Error (${status}): ${errText}`);
			}
			if (!response.body) throw new Error("Ollama returned empty body");
			let fullText = "";
			const reader = response.body.getReader?.();
			if (reader) {
				const decoder = new TextDecoder();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const lines = decoder.decode(value, { stream: true }).split("\n");
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const parsed = JSON.parse(line);
							if (parsed.response) fullText += parsed.response;
						} catch (e) {}
					}
				}
			} else fullText = (await response.json()).response || "No response generated.";
			return fullText || "No response generated.";
		}
	};
	aiService = new AIService();
}));
//#endregion
//#region electron/ipc.ts
var ipc_exports = /* @__PURE__ */ __exportAll({ scannerService: () => scannerService });
var scannerService;
var init_ipc = __esmMin((() => {
	init_scanner();
	init_updater();
	init_storage();
	init_settings();
	init_aiService();
	scannerService = new ScannerService();
	electron.ipcMain.handle("tools:update", async (event) => {
		return await updaterService.updateTools(event.sender);
	});
	electron.ipcMain.handle("scan:start", async (event, targetUrl, config) => {
		return await scannerService.startScan(event.sender, targetUrl, config);
	});
	electron.ipcMain.handle("scan:stop", async (event, scanId) => {
		return await scannerService.stopScan(scanId);
	});
	electron.ipcMain.handle("storage:getHistory", async () => {
		return storage.getHistory();
	});
	electron.ipcMain.handle("storage:openFolder", async (event, scanId) => {
		storage.openFolder(scanId);
	});
	electron.ipcMain.handle("settings:get", async () => {
		return settingsStore.get();
	});
	electron.ipcMain.handle("settings:save", async (event, settings) => {
		return settingsStore.save(settings);
	});
	electron.ipcMain.handle("ai:analyzeLogs", async (event, logs, prompt) => {
		return await aiService.analyzeLogs(event.sender, logs, prompt);
	});
	electron.ipcMain.handle("shell:openExternal", async (event, url) => {
		await electron.shell.openExternal(url);
	});
}));
//#endregion
//#region electron/main.ts
init_ipc();
var mainWindow = null;
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		width: 1400,
		height: 900,
		webPreferences: {
			preload: path.default.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true
		},
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: "#0f172a",
			symbolColor: "#f8fafc"
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile(path.default.join(__dirname, "../dist/index.html"));
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (!url.startsWith(process.env.VITE_DEV_SERVER_URL || "file://")) {
			event.preventDefault();
			electron.shell.openExternal(url);
		}
	});
}
electron.app.whenReady().then(() => {
	createWindow();
	electron.app.on("activate", function() {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
	try {
		const { scannerService } = (init_ipc(), __toCommonJS(ipc_exports));
		scannerService.killAll();
	} catch {}
});
//#endregion
