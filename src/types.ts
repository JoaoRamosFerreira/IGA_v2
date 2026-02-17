export type AppRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  full_name: string | null;
}
