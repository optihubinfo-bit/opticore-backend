export type StaffRole =
  | 'owner_admin'
  | 'store_manager'
  | 'cashier'
  | 'optometrist'
  | 'salesman_optician'
  | 'receptionist';

export type StaffRecord = {
  id: string;
  organization_id: string;
  primary_store_id: string | null;
  role: StaffRole | null;
};
