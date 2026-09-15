/** Authentication types matching backend app.models.auth */

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}
