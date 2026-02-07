import { Outlet, NavLink } from 'react-router-dom'
import { FileSpreadsheet, History, LogOut, Workflow } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { Button } from './Button'

const navItems = [
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/history', label: 'History', icon: History },
]

export function Layout() {
  const { user, login, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 bg-primary-600 rounded-lg shadow-md shadow-primary-600/30">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-slate-900">
                Sheet Workflow
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Navigation */}
              <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary-100 text-primary-700 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {/* Auth */}
              {user ? (
                <>
                  <div className="mx-3 h-6 w-px bg-slate-200" />
                  <span className="text-sm text-slate-500 truncate max-w-[180px] px-2">
                    {user.email}
                  </span>
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </>
              ) : (
                <Button variant="primary" size="sm" onClick={login}>
                  Sign in with Google
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
