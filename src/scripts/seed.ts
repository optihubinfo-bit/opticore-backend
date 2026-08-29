import { assertSupabaseConfigured } from '../config/env.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

// Fixed demo password so the printed credentials below stay usable
// across re-runs. Dev/demo seed data only, never used in production.
const DEMO_PASSWORD = 'OptiCore!Demo123';
const ORG_NAME = 'OptiCore Demo Opticians';

async function main() {
  assertSupabaseConfigured();
  const admin = getSupabaseAdmin();

  const { data: existingOrg } = await admin
    .from('organizations')
    .select('*')
    .eq('name', ORG_NAME)
    .maybeSingle();

  const org =
    existingOrg ??
    (await (async () => {
      const { data, error } = await admin.from('organizations').insert({ name: ORG_NAME }).select().single();
      if (error) throw error;
      console.log(`Organization created: ${data.name} (${data.id})`);
      return data;
    })());
  if (existingOrg) console.log(`Organization already exists: ${org.name} (${org.id})`);

  const { data: existingRegion } = await admin
    .from('regions')
    .select('*')
    .eq('organization_id', org.id)
    .eq('name', 'North Region')
    .maybeSingle();

  const region =
    existingRegion ??
    (await (async () => {
      const { data, error } = await admin
        .from('regions')
        .insert({ organization_id: org.id, name: 'North Region' })
        .select()
        .single();
      if (error) throw error;
      console.log(`Region created: ${data.name} (${data.id})`);
      return data;
    })());
  if (existingRegion) console.log(`Region already exists: ${region.name} (${region.id})`);

  async function ensureStore(name: string, address: string) {
    const { data: existing } = await admin
      .from('stores')
      .select('*')
      .eq('region_id', region.id)
      .eq('name', name)
      .maybeSingle();
    if (existing) {
      console.log(`Store already exists: ${existing.name} (${existing.id})`);
      return existing;
    }
    const { data, error } = await admin
      .from('stores')
      .insert({ region_id: region.id, name, address })
      .select()
      .single();
    if (error) throw error;
    console.log(`Store created: ${data.name} (${data.id})`);
    return data;
  }

  const storeDowntown = await ensureStore('Downtown Store', '12 Market Street');
  const storeUptown = await ensureStore('Uptown Store', '88 Hilltop Avenue');

  async function ensureStaffUser(params: {
    email: string;
    fullName: string;
    role: string;
    primaryStoreId?: string;
  }) {
    const { data: existingStaff } = await admin
      .from('staff')
      .select('*')
      .eq('email', params.email)
      .maybeSingle();
    if (existingStaff) {
      console.log(`Staff already exists: ${params.fullName} <${params.email}> role=${existingStaff.role}`);
      return existingStaff.id as string;
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: params.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        organization_id: org.id,
        full_name: params.fullName,
        ...(params.primaryStoreId ? { primary_store_id: params.primaryStoreId } : {}),
      },
    });
    if (createError) throw createError;

    // Role starts null (per the "no role until an owner_admin assigns
    // one" rule); the service role sets it directly here since it
    // bypasses RLS and the trigger's authenticated-session check.
    const { error: roleError } = await admin
      .from('staff')
      .update({ role: params.role })
      .eq('id', created.user.id);
    if (roleError) throw roleError;

    console.log(`Staff created: ${params.fullName} <${params.email}> role=${params.role} (${created.user.id})`);
    return created.user.id as string;
  }

  await ensureStaffUser({ email: 'owner@opticore.test', fullName: 'Ava Owner', role: 'owner_admin' });

  await ensureStaffUser({
    email: 'manager.downtown@opticore.test',
    fullName: 'Sam Manager',
    role: 'store_manager',
    primaryStoreId: storeDowntown.id,
  });

  await ensureStaffUser({
    email: 'manager.uptown@opticore.test',
    fullName: 'Priya Manager',
    role: 'store_manager',
    primaryStoreId: storeUptown.id,
  });

  await ensureStaffUser({
    email: 'cashier.downtown@opticore.test',
    fullName: 'Ravi Cashier',
    role: 'cashier',
    primaryStoreId: storeDowntown.id,
  });

  await ensureStaffUser({
    email: 'optometrist.downtown@opticore.test',
    fullName: 'Dr. Meera Rao',
    role: 'optometrist',
    primaryStoreId: storeDowntown.id,
  });

  await ensureStaffUser({
    email: 'salesman.downtown@opticore.test',
    fullName: 'Karan Salesman',
    role: 'salesman_optician',
    primaryStoreId: storeDowntown.id,
  });

  await ensureStaffUser({
    email: 'reception.downtown@opticore.test',
    fullName: 'Neha Reception',
    role: 'receptionist',
    primaryStoreId: storeDowntown.id,
  });

  console.log('\nSeed complete. Demo login password for all accounts: ' + DEMO_PASSWORD);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
