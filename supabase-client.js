const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

module.exports = { getSupabase };

