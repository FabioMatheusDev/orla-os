package com.tvhome.launcher;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Pure rules, shared by network validation and host tests. */
public final class CatalogPolicy {
    private static final Set<String> PARAMS = new HashSet<>(Arrays.asList(
        "language", "region", "watch_region", "include_adult", "include_video", "page", "query", "sort_by", "with_genres", "without_genres",
        "primary_release_date.gte", "primary_release_date.lte", "first_air_date.gte", "first_air_date.lte", "vote_average.gte", "vote_count.gte",
        "with_original_language", "with_status", "with_origin_country", "append_to_response", "include_video_language", "limit", "offset", "cursor",
        "mediatype", "lang", "sort", "order", "filter_genre", "genre_operator", "released_from", "released_to", "filter_score_min", "filter_score_max",
        "genre", "genre_mode", "country", "score_min", "score_max", "year_min", "year_max", "sort_order", "since", "runtime_min", "runtime_max"
    ));
    public static boolean pathAllowed(String provider, String path) {
        if (path == null || path.length() > 200) return false;
        if ("tmdb".equals(provider)) return path.matches("/(trending/(all|movie|tv)/(day|week)|discover/(movie|tv)|search/(movie|tv|multi)|genre/(movie|tv)/list|(movie|tv)/[1-9][0-9]*(/(watch/providers|season/[0-9]+(/episode/[0-9]+)?))?)");
        if ("mdblist".equals(provider)) return path.matches("/(tmdb/(movie|show)/[1-9][0-9]*/?|lists/[1-9][0-9]*/items|lists/official/(popular|trending|moviemeter|most-watched|most-watched-week|anticipated)/items|lists/user|catalog/(movie|show)|(movies|shows)/updates)");
        return false;
    }
    public static boolean paramAllowed(String key, String value) {
        return PARAMS.contains(key) && value != null && value.length() <= 1000 && value.indexOf('\n') < 0 && value.indexOf('\r') < 0;
    }
    public static long ttl(String provider, String path) {
        if ("mdblist".equals(provider)) return path.startsWith("/tmdb/") ? 86400000L : path.contains("/updates") ? 1800000L : 21600000L;
        if (path.contains("/search/")) return 900000L;
        if (path.contains("/trending/")) return 7200000L;
        if (path.contains("/discover/")) return 1800000L;
        if (path.contains("/season/")) return 43200000L;
        if (path.endsWith("/watch/providers")) return 43200000L;
        return path.startsWith("/movie/") ? 604800000L : 43200000L;
    }
    public static boolean budgetAllowed(int dayCalls, int windowCalls) { return dayCalls >= 0 && dayCalls < 1000 && windowCalls >= 0 && windowCalls < 950; }
    public static long dailyResetAt(long now) { return (now / 86400000L + 1) * 86400000L; }
    public static boolean dailyLimitFailure(int status, String error, int remaining) { return status == 429 && (remaining == 0 || "Daily API limit exceeded!".equals(error)); }
    public static boolean transientFailure(int status) { return status == 0 || status == 202 || status == 429 || status >= 500; }
}
