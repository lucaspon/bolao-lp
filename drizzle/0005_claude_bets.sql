-- Claude AI's palpites for the currently-open Round-of-32 / Round-of-16 ties.
-- Keyed on stable identifiers (user email, matches.api_match_id) rather than
-- serial ids, so this is portable across environments and a harmless no-op on a
-- DB where those matches haven't been synced yet (the JOIN simply matches zero
-- rows). Re-running updates the picks in place.

INSERT INTO "users" ("email", "username")
VALUES ('claude@anthropic.com', 'Claude')
ON CONFLICT ("email") DO NOTHING;
--> statement-breakpoint
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
JOIN "users" u ON u."email" = 'claude@anthropic.com'
ON CONFLICT ("user_id", "match_id")
DO UPDATE SET "home_pred" = EXCLUDED."home_pred",
              "away_pred" = EXCLUDED."away_pred",
              "updated_at" = now();
