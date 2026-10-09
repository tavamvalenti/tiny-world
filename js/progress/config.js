// Global leaderboard service. Empty = not switched on: the game says so and keeps scores waiting locally.
// To switch it on with Supabase, fill in the project's URL and its PUBLIC "anon" key (safe in the browser: the
// database only accepts scores through the checked submit_score function, see server/leaderboard.sql). Never put a
// service-role key here.
export const LEADERBOARD = {
  provider: '',          // 'supabase'
  url: '',               // e.g. 'https://abcdefgh.supabase.co'
  anonKey: '',
};
