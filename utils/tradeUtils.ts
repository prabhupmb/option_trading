export const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const getNextFriday = (date: Date = new Date()) => {
    const result = new Date(date);
    // If today is Friday, and it's late? Assume cutoff is handled elsewhere.
    // Logic: find next Friday (5).
    const day = result.getDay();
    const diff = (5 - day + 7) % 7;
    // If diff is 0 (today is Friday), we might want *next* Friday if market closed?
    // For simplicity, include today if Fri.
    result.setDate(result.getDate() + diff);
    return result;
};

export const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const getThirdFridayOfMonth = (date: Date) => {
    const d = new Date(date);
    d.setDate(1); // 1st
    // Find first Friday
    while (d.getDay() !== 5) {
        d.setDate(d.getDate() + 1);
    }
    // Add 2 weeks (14 days)
    d.setDate(d.getDate() + 14);
    return d;
};

export const getExpiryOptions = () => {
    const today = new Date();
    const options = [];

    // This Friday (or Next if today is Fri/Sat/Sun logic? Simplified: nearest upcoming Friday)
    // Actually, if today is Friday, it returns today.
    let thisFri = getNextFriday(today);
    // Check if today is Friday and late? Assume safe.

    options.push({ label: `This Friday (${formatDate(thisFri)})`, value: thisFri.toISOString().split('T')[0] });

    // Next Friday
    let nextFri = addDays(thisFri, 7);
    options.push({ label: `Next Friday (${formatDate(nextFri)})`, value: nextFri.toISOString().split('T')[0] });

    // 2 Weeks out (Fri + 14)
    let twoWeeks = addDays(thisFri, 14);
    options.push({ label: `2 Weeks (${formatDate(twoWeeks)})`, value: twoWeeks.toISOString().split('T')[0] });

    // Monthly: Next month's 3rd Friday
    let nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    let monthly = getThirdFridayOfMonth(nextMonth);
    options.push({ label: `Monthly (${formatDate(monthly)})`, value: monthly.toISOString().split('T')[0] });

    return options;
};

export const getStrikeSuggestions = (currentPrice: number, optionType: 'CALL' | 'PUT' | string = 'CALL') => {
    const rounded = Math.round(currentPrice);
    let step = 1;
    if (currentPrice > 200) step = 5;
    else if (currentPrice > 100) step = 2.5;
    else if (currentPrice > 50) step = 1;
    else step = 0.5;

    // Normalize to nearest step
    const atm = Math.round(currentPrice / step) * step;

    const lowerStrikes = [atm - step * 3, atm - step * 2, atm - step];
    const higherStrikes = [atm + step, atm + step * 2, atm + step * 3];

    // For CALL: ITM is lower (strik < price), OTM is higher (strike > price)
    // For PUT: ITM is higher (strike > price), OTM is lower (strike < price)

    // Note: Technically for CALL, ITM is Strike < Price. 
    // If price is 100. Strike 90 is ITM. (Lower) -> Correct.

    if (optionType === 'PUT') {
        return {
            itm: higherStrikes, // Higher strikes are ITM for Puts
            atm: [atm],
            otm: lowerStrikes   // Lower strikes are OTM for Puts
        };
    }

    return {
        itm: lowerStrikes,
        atm: [atm],
        otm: higherStrikes
    };
};
