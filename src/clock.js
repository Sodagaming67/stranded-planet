// The game clock. 1 real second = 1 game minute, so a whole day takes 24 real minutes.
export const MINUTES_PER_SECOND = 1;
const DAY = 24 * 60;

const hourListeners = [];

export const clock = {
  day: 1,
  minutes: 8 * 60, // the game starts at 8:00 in the morning
  get hour() {
    return Math.floor(this.minutes / 60);
  },
  update(dt) {
    const before = (this.day - 1) * DAY + this.minutes;
    const after = before + dt * MINUTES_PER_SECOND;
    this.day = Math.floor(after / DAY) + 1;
    this.minutes = after % DAY;
    for (let h = Math.floor(before / 60) + 1; h <= Math.floor(after / 60); h++) {
      for (const { hour, fn } of hourListeners) if (h % 24 === hour) fn(Math.floor(h / 24) + 1);
    }
  },
  // Skips ahead (used by tests, and later for sleeping).
  advance(gameMinutes) {
    let left = gameMinutes;
    while (left > 0) {
      const step = Math.min(left, 30);
      this.update(step / MINUTES_PER_SECOND);
      left -= step;
    }
  },
  text() {
    const h = this.hour;
    const m = Math.floor(this.minutes % 60);
    const twelve = ((h + 11) % 12) + 1;
    return `Day ${this.day} · ${twelve}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  },
};

// Calls fn(day) every time the clock reaches `hour` (0-23).
export function atHour(hour, fn) {
  hourListeners.push({ hour, fn });
}
