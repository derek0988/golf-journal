import { createClient } from "@supabase/supabase-js";

// These are safe to keep in client-side code — the anon key is designed to
// be public. Access control is enforced by the Row Level Security policies
// in the database, not by hiding this key.
const SUPABASE_URL = "https://sfqjdrfiyldtrtbkqyqr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcWpkcmZpeWxkdHJ0YmtxeXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzYzMTIsImV4cCI6MjEwMDUxMjMxMn0.I9CopkfSPv0I-SbG2aQ257ses51sZxaWhuePz0ug6m0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
