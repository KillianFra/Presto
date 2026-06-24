export interface AuthUser {
  id: string
  email: string
}

export interface AuthSessionResult {
  user: AuthUser
  token: string
  expiresAt: Date
}

export interface PasswordResetResult {
  resetToken?: string
  expiresAt?: Date
}

export interface RegisterInput {
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthSessionResult>
  login(input: LoginInput): Promise<AuthSessionResult>
  logout(token: string | null): Promise<void>
  getCurrentUser(token: string | null): Promise<AuthUser | null>
  requestPasswordReset(email: string): Promise<PasswordResetResult>
  resetPassword(token: string, password: string): Promise<void>
}
