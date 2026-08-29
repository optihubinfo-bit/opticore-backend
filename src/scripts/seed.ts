import { createClient } from '@supabase/supabase-js';
import { assertSupabaseConfigured, env } from '../config/env.js';
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

  const optometristId = await ensureStaffUser({
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

  // -----------------------------------------------------------------
  // Realistic operational data (Phase 13: "a fresh checkout, seed, and
  // npm run dev produces a fully navigable, believable demo across all
  // screens"). Everything below is idempotent, keyed by a natural
  // field, same as the bootstrap section above.
  //
  // Uses the service-role admin client directly wherever a table's own
  // triggers don't depend on auth.uid() (patients, prescriptions,
  // products, store_stock, appointments, message_templates - RLS is
  // bypassed but the scope-deriving triggers still run normally).
  // invoices and transfer_requests are the two exceptions - their
  // triggers/functions read auth.uid() (create_invoice's role check,
  // transfer_requests' requested_by stamp), which is null under the
  // service role, so those go through a real signed-in session using
  // the same RPC/insert path the app itself uses.
  // -----------------------------------------------------------------

  async function ensurePatient(params: {
    name: string;
    phone: string;
    storeId: string;
    loyaltyTier?: string;
    loyaltyPoints?: number;
  }) {
    const { data: existing } = await admin.from('patients').select('*').eq('name', params.name).maybeSingle();
    if (existing) return existing;
    const { data, error } = await admin
      .from('patients')
      .insert({
        assigned_store_id: params.storeId,
        name: params.name,
        phone: params.phone,
        loyalty_tier: params.loyaltyTier ?? 'bronze',
        loyalty_points: params.loyaltyPoints ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function ensurePrescription(params: { patientId: string; eye: 'OD' | 'OS'; issuedDate: string; expiryDate: string; sph?: number }) {
    const { data: existing } = await admin
      .from('prescriptions')
      .select('*')
      .eq('patient_id', params.patientId)
      .eq('eye', params.eye)
      .eq('issued_date', params.issuedDate)
      .maybeSingle();
    if (existing) return existing;
    const { error } = await admin.from('prescriptions').insert({
      patient_id: params.patientId,
      eye: params.eye,
      sph: params.sph ?? -1.25,
      issued_date: params.issuedDate,
      expiry_date: params.expiryDate,
    });
    if (error) throw error;
  }

  async function ensureProduct(params: {
    name: string;
    sku: string;
    category: string;
    costPrice: number;
    sellingPrice: number;
    madeToOrder?: boolean;
    requiresLabWork?: boolean;
    labJobType?: string;
  }) {
    const { data: existing } = await admin.from('products').select('*').eq('sku', params.sku).maybeSingle();
    if (existing) return existing;
    const { data, error } = await admin
      .from('products')
      .insert({
        organization_id: org.id,
        name: params.name,
        sku: params.sku,
        category: params.category,
        cost_price: params.costPrice,
        selling_price: params.sellingPrice,
        made_to_order: params.madeToOrder ?? false,
        requires_lab_work: params.requiresLabWork ?? false,
        lab_job_type: params.requiresLabWork ? params.labJobType ?? 'Other' : null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function ensureStock(productId: string, storeId: string, quantity: number, lowStockThreshold = 5) {
    const { data: existing } = await admin
      .from('store_stock')
      .select('*')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .maybeSingle();
    if (existing) return existing;
    const { error } = await admin
      .from('store_stock')
      .insert({ product_id: productId, store_id: storeId, quantity, low_stock_threshold: lowStockThreshold });
    if (error) throw error;
  }

  async function ensureAppointment(params: {
    patientId: string;
    doctorId: string;
    type: string;
    startTime: string;
    endTime: string;
  }) {
    const { data: existing } = await admin
      .from('appointments')
      .select('*')
      .eq('patient_id', params.patientId)
      .eq('start_time', params.startTime)
      .maybeSingle();
    if (existing) return existing;
    const { error } = await admin.from('appointments').insert({
      patient_id: params.patientId,
      doctor_user_id: params.doctorId,
      type: params.type,
      start_time: params.startTime,
      end_time: params.endTime,
    });
    if (error) throw error;
  }

  async function ensureTemplate(params: { name: string; channel: string; body: string }) {
    const { data: existing } = await admin.from('message_templates').select('*').eq('name', params.name).maybeSingle();
    if (existing) return existing;
    const { error } = await admin
      .from('message_templates')
      .insert({ organization_id: org.id, name: params.name, channel: params.channel, body: params.body });
    if (error) throw error;
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const tomorrowISO = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const soonExpiryISO = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const farExpiryISO = new Date(today.getTime() + 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oneYearAgoISO = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const patientAisha = await ensurePatient({ name: 'Aisha Khan', phone: '9820011122', storeId: storeDowntown.id, loyaltyTier: 'gold', loyaltyPoints: 340 });
  const patientRohan = await ensurePatient({ name: 'Rohan Mehta', phone: '9820011133', storeId: storeDowntown.id, loyaltyTier: 'silver', loyaltyPoints: 120 });
  const patientFatima = await ensurePatient({ name: 'Fatima Sheikh', phone: '9820011144', storeId: storeDowntown.id, loyaltyTier: 'bronze' });
  const patientVikram = await ensurePatient({ name: 'Vikram Nair', phone: '9820011155', storeId: storeUptown.id, loyaltyTier: 'platinum', loyaltyPoints: 890 });
  const patientDivya = await ensurePatient({ name: 'Divya Iyer', phone: '9820011166', storeId: storeUptown.id, loyaltyTier: 'bronze' });

  await ensurePrescription({ patientId: patientAisha.id, eye: 'OD', issuedDate: oneYearAgoISO, expiryDate: soonExpiryISO, sph: -2.0 });
  await ensurePrescription({ patientId: patientAisha.id, eye: 'OS', issuedDate: oneYearAgoISO, expiryDate: soonExpiryISO, sph: -1.75 });
  await ensurePrescription({ patientId: patientRohan.id, eye: 'OD', issuedDate: todayISO, expiryDate: farExpiryISO, sph: -0.75 });
  await ensurePrescription({ patientId: patientVikram.id, eye: 'OD', issuedDate: todayISO, expiryDate: farExpiryISO, sph: -3.25 });

  const productFrame = await ensureProduct({ name: 'Classic Acetate Frame', sku: 'FRM-CLASSIC-01', category: 'Frame', costPrice: 600, sellingPrice: 2200 });
  const productLens = await ensureProduct({
    name: 'Progressive Lens Pair',
    sku: 'LNS-PROG-01',
    category: 'Lens',
    costPrice: 900,
    sellingPrice: 4500,
    madeToOrder: true,
    requiresLabWork: true,
    labJobType: 'Progressive',
  });
  const productSingleVision = await ensureProduct({
    name: 'Single Vision Lens Pair',
    sku: 'LNS-SV-01',
    category: 'Lens',
    costPrice: 400,
    sellingPrice: 1800,
    madeToOrder: true,
    requiresLabWork: true,
    labJobType: 'Single Vision',
  });
  const productContacts = await ensureProduct({ name: 'Monthly Contact Lens (Box)', sku: 'CTL-MONTHLY-01', category: 'Contact Lens', costPrice: 350, sellingPrice: 1200 });
  const productSunglasses = await ensureProduct({ name: 'Polarized Sunglasses', sku: 'SUN-POL-01', category: 'Sunglasses', costPrice: 800, sellingPrice: 2800 });
  const productCase = await ensureProduct({ name: 'Hard Shell Case', sku: 'ACC-CASE-01', category: 'Accessory', costPrice: 60, sellingPrice: 250 });

  await ensureStock(productFrame.id, storeDowntown.id, 18);
  await ensureStock(productFrame.id, storeUptown.id, 3, 5); // low stock at Uptown
  await ensureStock(productContacts.id, storeDowntown.id, 25);
  await ensureStock(productContacts.id, storeUptown.id, 0); // out of stock at Uptown
  await ensureStock(productSunglasses.id, storeDowntown.id, 10);
  await ensureStock(productSunglasses.id, storeUptown.id, 12);
  await ensureStock(productCase.id, storeDowntown.id, 40);
  await ensureStock(productCase.id, storeUptown.id, 30);

  await ensureAppointment({
    patientId: patientAisha.id,
    doctorId: optometristId,
    type: 'Eye Exam',
    startTime: `${todayISO}T10:00:00Z`,
    endTime: `${todayISO}T10:30:00Z`,
  });
  await ensureAppointment({
    patientId: patientRohan.id,
    doctorId: optometristId,
    type: 'Follow-up',
    startTime: `${todayISO}T14:00:00Z`,
    endTime: `${todayISO}T14:30:00Z`,
  });
  await ensureAppointment({
    patientId: patientFatima.id,
    doctorId: optometristId,
    type: 'Contact Lens Fit',
    startTime: `${tomorrowISO}T11:00:00Z`,
    endTime: `${tomorrowISO}T11:30:00Z`,
  });

  await ensureTemplate({
    name: 'Order ready (SMS)',
    channel: 'SMS',
    body: 'Hi {patient_name}, your order is ready for pickup at {store_name}. See you soon!',
  });
  await ensureTemplate({
    name: 'Recall reminder (WhatsApp)',
    channel: 'WhatsApp',
    body: 'Hi {patient_name}, it has been a while since your last eye exam. Visit {store_name} to book a recall.',
  });

  // Invoices go through create_invoice() as a real signed-in session,
  // not a direct admin insert, so the demo data exercises the exact
  // same GST/loyalty math and stock-decrement path the app itself
  // uses (and, for the lens line item, auto-creates a real lab job).
  const anon = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: 'owner@opticore.test',
    password: DEMO_PASSWORD,
  });
  if (signInError) throw signInError;

  const { data: existingInvoices } = await anon.from('invoices').select('id').limit(1);
  if (!existingInvoices || existingInvoices.length === 0) {
    const { error: invoice1Error } = await anon.rpc('create_invoice', {
      p_patient_id: patientAisha.id,
      p_store_id: storeDowntown.id,
      p_payment_method: 'Card',
      p_line_items: [
        { product_id: productFrame.id, qty: 1 },
        { product_id: productLens.id, qty: 1 },
      ],
    });
    if (invoice1Error) throw invoice1Error;
    console.log('Invoice created: frame + progressive lens for Aisha Khan (Downtown) - spawns a lab job');

    const { error: invoice2Error } = await anon.rpc('create_invoice', {
      p_patient_id: patientRohan.id,
      p_store_id: storeDowntown.id,
      p_payment_method: 'UPI',
      p_line_items: [{ product_id: productContacts.id, qty: 2 }],
    });
    if (invoice2Error) throw invoice2Error;
    console.log('Invoice created: contact lenses for Rohan Mehta (Downtown)');

    const { error: invoice3Error } = await anon.rpc('create_invoice', {
      p_patient_id: patientVikram.id,
      p_store_id: storeUptown.id,
      p_payment_method: 'Cash',
      p_line_items: [{ product_id: productSunglasses.id, qty: 1 }],
    });
    if (invoice3Error) throw invoice3Error;
    console.log('Invoice created: sunglasses for Vikram Nair (Uptown)');
  } else {
    console.log('Invoices already exist, skipping.');
  }

  // Move one lab job further along the board for visual variety - a
  // plain status update, no auth.uid()-dependent trigger involved.
  const { data: labJobs } = await admin.from('lab_jobs').select('*').eq('stage', 'received').limit(1);
  if (labJobs && labJobs.length > 0) {
    await admin.from('lab_jobs').update({ stage: 'edging' }).eq('id', labJobs[0].id);
  }

  // A transfer request has to go through the same signed-in session -
  // its trigger stamps requested_by from auth.uid(), which is null
  // under the service role.
  const { data: existingTransfers } = await anon.from('transfer_requests').select('id').limit(1);
  if (!existingTransfers || existingTransfers.length === 0) {
    const { error: transferError } = await anon
      .from('transfer_requests')
      .insert({
        from_store_id: storeDowntown.id,
        to_store_id: storeUptown.id,
        product_id: productContacts.id,
        quantity: 5,
      });
    if (transferError) throw transferError;
    console.log('Transfer request created: contact lenses, Downtown -> Uptown (pending approval)');
  } else {
    console.log('Transfer requests already exist, skipping.');
  }

  await anon.auth.signOut();

  console.log('\nSeed complete. Demo login password for all accounts: ' + DEMO_PASSWORD);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
