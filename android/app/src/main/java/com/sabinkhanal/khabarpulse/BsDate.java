package com.sabinkhanal.khabarpulse;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

/** Gregorian to Bikram Sambat (BS 2070-2090), mirroring src/lib/bs.ts. */
final class BsDate {
    private BsDate() {}

    private static final int FIRST_YEAR = 2070;
    private static final int[][] DAYS = {
        {31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30},
        {31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31},
        {31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31},
        {31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31},
        {31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31},
        {30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31},
        {31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30},
        {31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30},
        {30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30},
        {30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30},
        {30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30},
    };
    private static final String[] MONTHS = {"Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj",
        "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"};

    /** "24 Asoj 2083", or "" when outside the supported calendar range. */
    static String format(int year, int month, int day) {
        long days = LocalDate.of(year, month, day).toEpochDay() - LocalDate.of(2013, 4, 14).toEpochDay();
        if (days < 0) return "";
        int y = 0;
        while (y < DAYS.length && days >= sum(DAYS[y])) days -= sum(DAYS[y++]);
        if (y >= DAYS.length) return "";
        int m = 0;
        while (days >= DAYS[y][m]) days -= DAYS[y][m++];
        return (days + 1) + " " + MONTHS[m] + " " + (FIRST_YEAR + y);
    }

    /** Today's BS date in Nepal (UTC+5:45), whatever the device time zone. */
    static String today() {
        ZonedDateTime n = ZonedDateTime.now(ZoneOffset.ofHoursMinutes(5, 45));
        return format(n.getYear(), n.getMonthValue(), n.getDayOfMonth());
    }

    private static int sum(int[] a) {
        int t = 0;
        for (int v : a) t += v;
        return t;
    }
}
