function isMarketOpen() {
    const now = new Date();

    const day = now.getDay();

    // Sunday=0 Saturday=6
    if (day === 0 || day === 6)
        return false;

    const minutes =
        now.getHours() * 60 +
        now.getMinutes();

    // 9:15 AM to 3:30 PM
    return minutes >= 555 && minutes <= 930;
 
}

module.exports = {isMarketOpen};
