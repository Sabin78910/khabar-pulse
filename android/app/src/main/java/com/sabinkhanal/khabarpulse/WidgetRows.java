package com.sabinkhanal.khabarpulse;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Maps news.json to the few headline rows the home-screen widget shows. */
final class WidgetRows {
    private WidgetRows() {}

    static final class Row {
        final String title;
        final String sources;

        Row(String title, String sources) {
            this.title = title;
            this.sources = sources;
        }
    }

    static List<Row> parse(String json, int max) throws JSONException {
        JSONObject root = new JSONObject(json);
        Map<String, String> names = new HashMap<>();
        JSONArray srcs = root.optJSONArray("sources");
        for (int i = 0; srcs != null && i < srcs.length(); i++) {
            JSONObject s = srcs.getJSONObject(i);
            names.put(s.optString("id"), s.optString("name"));
        }
        List<Row> rows = new ArrayList<>();
        JSONArray clusters = root.getJSONArray("clusters");
        for (int i = 0; i < clusters.length() && rows.size() < max; i++) {
            JSONObject c = clusters.getJSONObject(i);
            String title = c.optString("title").trim();
            if (title.isEmpty()) continue;
            Set<String> ids = new LinkedHashSet<>();
            ids.add(c.optString("sourceId"));
            JSONArray items = c.optJSONArray("items");
            for (int j = 0; items != null && j < items.length(); j++) {
                ids.add(items.getJSONObject(j).optString("sourceId"));
            }
            StringBuilder sb = new StringBuilder();
            for (String id : ids) {
                if (id.isEmpty()) continue;
                String name = names.get(id);
                if (sb.length() > 0) sb.append(" · ");
                sb.append(name == null || name.isEmpty() ? id : name);
            }
            rows.add(new Row(title, sb.toString()));
        }
        return rows;
    }

    static String encode(List<Row> rows) throws JSONException {
        JSONArray arr = new JSONArray();
        for (Row r : rows) arr.put(new JSONObject().put("t", r.title).put("s", r.sources));
        return arr.toString();
    }

    /** Never throws: a bad cache just means an empty widget until the next refresh. */
    static List<Row> decode(String s) {
        List<Row> rows = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(s);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                rows.add(new Row(o.getString("t"), o.optString("s")));
            }
        } catch (JSONException e) {
            rows.clear();
        }
        return rows;
    }
}
