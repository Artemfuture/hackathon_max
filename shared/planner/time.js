export const END_OF_DAY = 24 * 60;
export const NIGHT_END = 28 * 60;
export const START_MARGIN_MIN = 5;
export const TIGHT_MARGIN_MIN = 10;

export const toMin = (clock) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

export const toClock = (minutes) => {
  const value = ((Math.round(minutes) % END_OF_DAY) + END_OF_DAY) % END_OF_DAY;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
