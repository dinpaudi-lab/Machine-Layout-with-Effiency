// ============ AUTHENTICATION & REDIRECT SYSTEM ============
// Mengatur redirect otomatis dan proteksi halaman

const SESSION_KEY = 'app_session_token'
const CURRENT_USER_KEY = 'current_user'
const LOGIN_PAGE = 'login.html'
const MAIN_PAGE = 'layout.html'

// ============ SESSION VALIDATION ============

function isSessionValid() {
  const token = localStorage.getItem(SESSION_KEY)
  const user = localStorage.getItem(CURRENT_USER_KEY)
  
  if (!token || !user) {
    return false
  }
  
  try {
    // Decode session token (format: base64(email:timestamp))
    const decoded = atob(token)
    const parts = decoded.split(':')
    
    if (parts.length !== 2) {
      return false
    }
    
    const timestamp = parseInt(parts[1])
    const now = Date.now()
    
    // Session expires after 24 hours
    const SESSION_DURATION = 24 * 60 * 60 * 1000
    
    if (now - timestamp > SESSION_DURATION) {
      console.log('⏰ Session expired')
      clearSession()
      return false
    }
    
    return true
  } catch (e) {
    console.error('❌ Session validation error:', e)
    return false
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(CURRENT_USER_KEY)
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentUserEmail')
}

// ============ PAGE PROTECTION ============

function getCurrentPage() {
  const path = window.location.pathname
  const page = path.substring(path.lastIndexOf('/') + 1) || 'index.html'
  return page
}

function isProtectedPage() {
  const currentPage = getCurrentPage()
  const protectedPages = [
    'layout.html',
    'efficiency.html',
    'index.html'
  ]
  
  return protectedPages.includes(currentPage)
}

function isLoginPage() {
  const currentPage = getCurrentPage()
  return currentPage === LOGIN_PAGE
}

// ============ REDIRECT LOGIC ============

function redirectToLogin() {
  const currentPage = getCurrentPage()
  
  if (currentPage !== LOGIN_PAGE) {
    console.log('🔒 Not authenticated, redirecting to login...')
    
    // Save return URL
    sessionStorage.setItem('return_url', currentPage)
    
    window.location.href = LOGIN_PAGE
  }
}

function redirectToMain() {
  // Check if there's a return URL
  const returnUrl = sessionStorage.getItem('return_url')
  sessionStorage.removeItem('return_url')
  
  if (returnUrl && returnUrl !== LOGIN_PAGE) {
    console.log('↩️ Redirecting to:', returnUrl)
    window.location.href = returnUrl
  } else {
    console.log('✅ Redirecting to main page...')
    window.location.href = MAIN_PAGE
  }
}

// ============ INITIALIZATION ============

function initAuthRedirect() {
  console.log('🔐 Initializing auth redirect...')
  console.log('📍 Current page:', getCurrentPage())
  
  const hasValidSession = isSessionValid()
  console.log('🎫 Session valid:', hasValidSession)
  
  // If on login page and already logged in -> redirect to main
  if (isLoginPage() && hasValidSession) {
    console.log('✅ Already logged in, redirecting to main...')
    redirectToMain()
    return
  }
  
  // If on protected page and NOT logged in -> redirect to login
  if (isProtectedPage() && !hasValidSession) {
    console.log('🔒 Protected page without session, redirecting to login...')
    redirectToLogin()
    return
  }
  
  console.log('✅ Auth redirect check complete')
}

// ============ AUTO-RUN ON PAGE LOAD ============

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthRedirect)
} else {
  initAuthRedirect()
}

// ============ LOGOUT HELPER ============

function logout() {
  console.log('👋 Logging out...')
  clearSession()
  
  // Cleanup Supabase listeners
  if (typeof supabaseSignOut !== 'undefined') {
    supabaseSignOut().catch(e => console.warn('Supabase signout error:', e))
  }
  
  window.location.href = LOGIN_PAGE
}

// ============ SESSION REFRESH ============

function refreshSession() {
  const user = localStorage.getItem(CURRENT_USER_KEY)
  if (user && isSessionValid()) {
    // Update timestamp
    const newToken = btoa(user + ':' + Date.now())
    localStorage.setItem(SESSION_KEY, newToken)
    console.log('🔄 Session refreshed')
    return true
  }
  return false
}

// Auto-refresh session every 30 minutes
setInterval(() => {
  if (isProtectedPage()) {
    if (!refreshSession()) {
      console.log('⏰ Session cannot be refreshed, logging out...')
      logout()
    }
  }
}, 30 * 60 * 1000)

// ============ VISIBILITY CHANGE HANDLER ============
// Check session when user returns to tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isProtectedPage()) {
    if (!isSessionValid()) {
      console.log('🔒 Session invalid on tab focus, redirecting...')
      redirectToLogin()
    }
  }
})

// ============ EXPOSE GLOBALLY ============

window.authRedirect = {
  isSessionValid,
  logout,
  redirectToLogin,
  redirectToMain,
  clearSession,
  getCurrentPage,
  isProtectedPage,
  refreshSession
}

console.log('✅ Auth redirect system loaded')
