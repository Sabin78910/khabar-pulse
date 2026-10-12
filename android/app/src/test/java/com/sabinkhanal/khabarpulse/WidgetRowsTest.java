package com.sabinkhanal.khabarpulse;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.List;
import org.junit.Test;

public class WidgetRowsTest {
    private static final String JSON = "{\"version\":1,\"generatedAt\":1,\"sources\":["
        + "{\"id\":\"a\",\"name\":\"Alpha\"},{\"id\":\"b\",\"name\":\"Beta\"},{\"id\":\"c\",\"name\":\"Gamma\"}],"
        + "\"clusters\":["
        + "{\"title\":\"One\",\"sourceId\":\"a\",\"items\":[{\"sourceId\":\"a\"},{\"sourceId\":\"b\"},{\"sourceId\":\"a\"}]},"
        + "{\"title\":\"  \",\"sourceId\":\"a\",\"items\":[]},"
        + "{\"title\":\"Two\",\"sourceId\":\"zzz\",\"items\":[]},"
        + "{\"title\":\"Three\",\"sourceId\":\"c\"},"
        + "{\"title\":\"Four\",\"sourceId\":\"a\"}]}";

    @Test
    public void takesTopThreeWithTitles() throws Exception {
        List<WidgetRows.Row> rows = WidgetRows.parse(JSON, 3);
        assertEquals(3, rows.size());
        assertEquals("One", rows.get(0).title);
        assertEquals("Two", rows.get(1).title);
        assertEquals("Three", rows.get(2).title);
    }

    @Test
    public void creditsEveryDistinctOutlet() throws Exception {
        assertEquals("Alpha · Beta", WidgetRows.parse(JSON, 3).get(0).sources);
    }

    @Test
    public void unknownSourceFallsBackToId() throws Exception {
        assertEquals("zzz", WidgetRows.parse(JSON, 3).get(1).sources);
    }

    @Test
    public void mainSourceUsedWhenNoItems() throws Exception {
        assertEquals("Gamma", WidgetRows.parse(JSON, 3).get(2).sources);
    }

    @Test
    public void roundTripsThroughCacheString() throws Exception {
        List<WidgetRows.Row> rows = WidgetRows.parse(JSON, 3);
        List<WidgetRows.Row> back = WidgetRows.decode(WidgetRows.encode(rows));
        assertEquals(rows.size(), back.size());
        assertEquals(rows.get(0).sources, back.get(0).sources);
    }

    @Test
    public void garbageDecodesToEmpty() {
        assertTrue(WidgetRows.decode("not json").isEmpty());
    }

    @Test
    public void bsDateMatchesCalendar() {
        // 10 Oct 2026 = Asoj 24, 2083
        assertEquals("24 Asoj 2083", BsDate.format(2026, 10, 10));
        // anchor: 14 Apr 2013 = 1 Baisakh 2070
        assertEquals("1 Baisakh 2070", BsDate.format(2013, 4, 14));
    }
}
