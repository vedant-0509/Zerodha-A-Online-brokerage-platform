function partsInIndia(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour12: false, weekday: 'short',
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

function isMarketOpen(date = new Date()) {
  const p = partsInIndia(date);
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30;
}

function indiaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata' }).format(date);
}

module.exports = { isMarketOpen, indiaDate, partsInIndia };
