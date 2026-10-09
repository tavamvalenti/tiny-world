// Global leaderboard service. Empty = not switched on: the game says so and keeps scores waiting locally.
// To switch it on with Supabase, fill in the project's URL and its PUBLIC "anon" key (safe in the browser: the
// database only accepts scores through the checked submit_score function, see server/leaderboard.sql). Never put a
// service-role key here.
export const LEADERBOARD = {
  provider: 'supabase',
  url: 'https://qfmvnctlbthopdmuuaxt.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbXZuY3RsYnRob3BkbXV1YXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDg0MTIsImV4cCI6MjEwNzA4NDQxMn0.Tg6dbqrHbQPTXYMFYT8NI0ibytFnDdistMnpLJKKnWw',   // the public anon key
};
