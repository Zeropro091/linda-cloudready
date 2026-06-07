const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('articles').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Count:', data.length);
    console.log('Sample Title:', data[0]?.title);
  }
}

check();
