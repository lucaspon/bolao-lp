-- Claude AI's palpites for the Round-of-32 / Round-of-16 ties that were open on
-- 2026-06-30. Targets the EXISTING "Claude AI" account by its email; it never
-- creates a user, so it can't spawn a duplicate. Keyed on matches.api_match_id
-- (stable across environments) and a no-op where that user or those matches
-- don't exist (the JOINs simply match zero rows). Re-running updates in place.

INSERT INTO "bets" ("user_id", "match_id", "home_pred", "away_pred")
SELECT u."id", m."id", v."home_pred", v."away_pred"
FROM (VALUES
  (537416, 2, 0),  -- France–Sweden
  (537425, 1, 0),  -- Mexico–Ecuador
  (537426, 3, 0),  -- England–Congo DR
  (537422, 2, 1),  -- Belgium–Senegal
  (537421, 2, 1),  -- United States–Bosnia-Herzegovina
  (537420, 2, 0),  -- Spain–Austria
  (537419, 2, 1),  -- Portugal–Croatia
  (537429, 1, 0),  -- Switzerland–Algeria
  (537428, 1, 1),  -- Australia–Egypt
  (537427, 3, 0),  -- Argentina–Cape Verde Islands
  (537430, 2, 0),  -- Colombia–Ghana
  (537376, 1, 2)   -- Canada–Morocco (Round of 16)
) AS v("api_match_id", "home_pred", "away_pred")
JOIN "matches" m ON m."api_match_id" = v."api_match_id"
JOIN "users" u ON u."email" = 'claude-ai@bolao.local'
ON CONFLICT ("user_id", "match_id")
DO UPDATE SET "home_pred" = EXCLUDED."home_pred",
              "away_pred" = EXCLUDED."away_pred",
              "updated_at" = now();
