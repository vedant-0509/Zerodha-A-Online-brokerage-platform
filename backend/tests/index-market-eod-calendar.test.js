const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isMarketOpen,
    isTradingDay,
    hasVerifiedHolidayCalendar,
} = require('../indexMarket/isMarketOpen');

test('known NSE equity holiday is never treated as a trading day', () => {
    // 20 Oct 2026 (Dussehra), represented at 10:30 IST.
    const date = new Date('2026-10-20T05:00:00.000Z');
    assert.equal(hasVerifiedHolidayCalendar(date), true);
    assert.equal(isTradingDay(date), false);
    assert.equal(isMarketOpen(date), false);
});

test('normal weekday during the regular session is open', () => {
    // 21 Oct 2026, 10:30 IST.
    const date = new Date('2026-10-21T05:00:00.000Z');
    assert.equal(hasVerifiedHolidayCalendar(date), true);
    assert.equal(isTradingDay(date), true);
    assert.equal(isMarketOpen(date), true);
});

test('weekends remain closed', () => {
    const saturday = new Date('2026-10-24T05:00:00.000Z');
    assert.equal(isTradingDay(saturday), false);
    assert.equal(isMarketOpen(saturday), false);
});

test('an unknown future-year calendar does not block live weekday sessions, but is not verified for EOD sync', () => {
    const date = new Date('2027-01-04T05:00:00.000Z'); // Monday, 10:30 IST
    assert.equal(hasVerifiedHolidayCalendar(date), false);
    assert.equal(isTradingDay(date), true);
    assert.equal(isMarketOpen(date), true);
});
