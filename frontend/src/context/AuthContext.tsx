import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { authApi, type AuthUser } from '../lib/api'

type AuthState = {
  user: AuthUser | null
  loading: boolean
  driveConnected: boolean  // NEW: convenience accessor
  login: () => void
  loginWithDrive: () => void  // NEW: login requesting Drive scopes
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    try {
      const u = await authApi.me()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = useCallback(() => {
    window.location.href = authApi.loginUrl()
  }, [])

  const loginWithDrive = useCallback(() => {
    window.location.href = authApi.loginUrl() + '?scope=drive'
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, driveConnected: user?.driveConnected ?? false, login, loginWithDrive, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
