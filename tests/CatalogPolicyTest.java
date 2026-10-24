package com.tvhome.launcher;
public class CatalogPolicyTest {
    private static int count;
    private static void check(boolean value) { count++; if (!value) throw new AssertionError("policy check " + count); }
    public static void main(String[] args) {
        check(CatalogPolicy.pathAllowed("tmdb", "/movie/550"));
        check(CatalogPolicy.pathAllowed("tmdb", "/tv/1396/season/1"));
        check(CatalogPolicy.pathAllowed("tmdb", "/movie/550/watch/providers"));
        check(CatalogPolicy.pathAllowed("mdblist", "/tmdb/movie/550/"));
        check(CatalogPolicy.pathAllowed("mdblist", "/lists/official/trending/items"));
        check(!CatalogPolicy.pathAllowed("tmdb", "https://evil.invalid/"));
        check(!CatalogPolicy.pathAllowed("tmdb", "/movie/../../account"));
        check(!CatalogPolicy.pathAllowed("tmdb", "/account"));
        check(!CatalogPolicy.pathAllowed("mdblist", "/sync/ratings/remove"));
        check(!CatalogPolicy.paramAllowed("apikey", "secret"));
        check(!CatalogPolicy.paramAllowed("api_key", "secret"));
        check(!CatalogPolicy.paramAllowed("Authorization", "secret"));
        check(!CatalogPolicy.paramAllowed("query", "x\nAuthorization:y"));
        check(CatalogPolicy.paramAllowed("query", "ação e coração"));
        check(CatalogPolicy.budgetAllowed(799, 949));
        check(CatalogPolicy.budgetAllowed(999, 1));
        check(!CatalogPolicy.budgetAllowed(1000, 1));
        check(!CatalogPolicy.budgetAllowed(1, 950));
        check(CatalogPolicy.dailyResetAt(86400000L * 100 + 1) == 86400000L * 101);
        check(CatalogPolicy.dailyResetAt(86400000L * 100) == 86400000L * 101);
        check(CatalogPolicy.dailyLimitFailure(429, "Daily API limit exceeded!", -1));
        check(CatalogPolicy.dailyLimitFailure(429, "", 0));
        check(!CatalogPolicy.dailyLimitFailure(429, "API rate limit exceeded!", -1));
        check(!CatalogPolicy.dailyLimitFailure(503, "", 0));
        check(CatalogPolicy.ttl("mdblist", "/tmdb/movie/550/") == 86400000L);
        check(CatalogPolicy.ttl("mdblist", "/lists/123/items") == 21600000L);
        check(CatalogPolicy.ttl("tmdb", "/search/movie") == 900000L);
        check(CatalogPolicy.transientFailure(202) && CatalogPolicy.transientFailure(429) && CatalogPolicy.transientFailure(503));
        check(!CatalogPolicy.transientFailure(401) && !CatalogPolicy.transientFailure(403));
        System.out.println(count + " native policy checks passed");
    }
}
