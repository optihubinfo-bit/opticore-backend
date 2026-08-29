import { createClient } from '@supabase/supabase-js';
import { assertSupabaseConfigured, env } from '../config/env.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

const DEMO_PASSWORD = 'OptiCore!Demo123';

function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${label}`);
  return pass;
}

async function main() {
  assertSupabaseConfigured();
  const admin = getSupabaseAdmin();

  const { data: downtown } = await admin.from('stores').select('id').eq('name', 'Downtown Store').single();
  const { data: uptown } = await admin.from('stores').select('id').eq('name', 'Uptown Store').single();
  if (!downtown || !uptown) {
    throw new Error('Seed data not found. Run `npm run seed` first.');
  }

  const anon = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: 'manager.downtown@opticore.test',
    password: DEMO_PASSWORD,
  });
  if (signInError) throw signInError;

  let allPassed = true;

  const { data: visibleStores, error: storesError } = await anon.from('stores').select('id, name');
  if (storesError) throw storesError;
  allPassed = check(
    'store_manager (downtown) sees exactly their own store in an unfiltered query',
    visibleStores.length === 1 && visibleStores[0].id === downtown.id
  ) && allPassed;

  const { data: uptownDirect, error: uptownError } = await anon
    .from('stores')
    .select('id')
    .eq('id', uptown.id);
  if (uptownError) throw uptownError;
  allPassed = check(
    'store_manager (downtown) gets zero rows querying the uptown store directly by id',
    uptownDirect.length === 0
  ) && allPassed;

  const { data: visibleStaff, error: staffError } = await anon.from('staff').select('id, full_name, primary_store_id');
  if (staffError) throw staffError;
  const leaksUptownManager = visibleStaff.some((s) => s.primary_store_id === uptown.id);
  allPassed = check(
    'store_manager (downtown) does not see uptown store\'s staff',
    !leaksUptownManager
  ) && allPassed;

  await anon.auth.signOut();

  if (!allPassed) {
    console.error('\nRLS verification FAILED.');
    process.exit(1);
  }
  console.log('\nRLS verification passed: store scoping is enforced by policy, not application code.');
}

main().catch((err) => {
  console.error('Verification errored:', err);
  process.exit(1);
});
