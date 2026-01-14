/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

async function test() {
  console.log('Testing Supabase connection...');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log('URL:', url);

  if (!url || !key) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(url, key);

  const start = Date.now();
  console.log('Calling getUser()...');
  const { data, error } = await supabase.auth.getUser();
  console.log('Finished in', Date.now() - start, 'ms');

  if (error) {
    console.log('Error (expected if not logged in):', error.message);
  } else {
    console.log('User:', data.user ? 'Found' : 'None');
  }
}

test();
