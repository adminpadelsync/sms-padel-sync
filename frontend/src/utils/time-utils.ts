/**
 * Shared utility for formatting match and player times using the club's specific timezone.
 * Standardizes date/time display across the dashboard.
 */

interface FormatOptions extends Intl.DateTimeFormatOptions {
    timeZone?: string;
}

/**
 * Formats an ISO string (usually UTC from the backend) into a localized human-readable string.
 * @param isoString The date string to format
 * @param timeZone The club's target timezone (e.g., 'America/New_York')
 * @param isUtc Whether the provided string should be treated as UTC if naive (defaults to true)
 * @returns A formatted string or 'Invalid Date'
 */
export function formatLocalizedTime(
    isoString: string | Date | undefined,
    timeZone: string | undefined,
    isUtc: boolean = true
): string {
    if (!isoString) return 'N/A';

    try {
        let date: Date;
        if (typeof isoString === 'string') {
            // Our backend standard is UTC, but some strings might arrive without the 'Z' suffix.
            // If it has 'T' but no timezone indicator ('Z' or '+'), append 'Z'.
            let normalizedIso = isoString;
            // If isUtc is true and it's naive, assume UTC by adding 'Z'
            if (isUtc && isoString.includes('T') && !isoString.includes('Z') && !isoString.includes('+')) {
                normalizedIso = isoString + 'Z';
            }
            date = new Date(normalizedIso);
        } else {
            date = isoString;
        }

        const options: FormatOptions = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timeZone || undefined
        };

        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (err) {
        console.error(`Error formatting time: ${err}`, { isoString, timeZone });
        return String(isoString);
    }
}

/**
 * Short date format (e.g., "Oct 24, 2024") localized to the club's timezone.
 */
export function formatLocalizedDate(
    isoString: string | Date | undefined,
    timeZone: string | undefined,
    isUtc: boolean = true
): string {
    if (!isoString) return 'N/A';

    try {
        let date: Date;
        if (typeof isoString === 'string') {
            let normalizedIso = isoString;
            if (isUtc && isoString.includes('T') && !isoString.includes('Z') && !isoString.includes('+')) {
                normalizedIso = isoString + 'Z';
            }
            date = new Date(normalizedIso);
        } else {
            date = isoString;
        }
        const options: FormatOptions = {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: timeZone || undefined
        };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (err) {
        return String(isoString);
    }
}

/**
 * Checks if a match time is in the past, relative to the club's localized 'now'.
 */
export function isPastTime(isoString: string | undefined): boolean {
    if (!isoString) return false;
    // For comparison, naive string needs Z too
    let normalized = isoString;
    if (isoString.includes('T') && !isoString.includes('Z') && !isoString.includes('+')) {
        normalized = isoString + 'Z';
    }
    return new Date(normalized).getTime() < Date.now();
}
