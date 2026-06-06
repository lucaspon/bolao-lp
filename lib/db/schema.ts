import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// The tournament unfolds in stages. We bet on group-stage and knockout matches.
export const stageEnum = pgEnum("stage", [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
]);

export type Stage = (typeof stageEnum.enumValues)[number];

// One row per person. We key on the full email; the username is the email prefix.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Short-lived one-time login codes. We store only the hash, never the plain code.
export const loginCodes = pgTable("login_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A scheduled match. Knockout teams may be undecided, so team codes are nullable
// and we keep a human placeholder (e.g. "Winner Group A") to show meanwhile.
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  extId: text("ext_id").notNull().unique(), // stable seed key, lets re-seeding skip edited rows
  stage: stageEnum("stage").notNull(),
  groupLabel: text("group_label"), // 'A'..'L' for group stage, null otherwise
  homeTeam: text("home_team"), // team code, null until a knockout slot is decided
  awayTeam: text("away_team"),
  homePlaceholder: text("home_placeholder"),
  awayPlaceholder: text("away_placeholder"),
  kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
  venue: text("venue"),
  homeScore: integer("home_score"), // null until the match is scored
  awayScore: integer("away_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A user's prediction for a match. Points are cached, recomputed when a result lands.
export const bets = pgTable(
  "bets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    homePred: integer("home_pred").notNull(),
    awayPred: integer("away_pred").notNull(),
    points: integer("points"), // null until the match is scored
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("bets_user_match_uq").on(table.userId, table.matchId)],
);

export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Bet = typeof bets.$inferSelect;
