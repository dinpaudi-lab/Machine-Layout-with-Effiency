document.addEventListener('DOMContentLoaded', function(){
  const form = document.getElementById('login-form')
  const usernameInput = document.getElementById('username')
  const passwordInput = document.getElementById('password')
  const errorMessage = document.getElementById('error-message')
  const loginBtn = form.querySelector('.login-btn')
  
  const users = {
    'didin@company.com': '86532',
    'indra@company.com': '86086',
    'nur@company.com': '80229',
    'desi@company.com': '82847'
  }
  
  form.addEventListener('submit', function(e){
    e.preventDefault()
    
    const email = usernameInput.value.trim()
    const password = passwordInput.value
    
    if(!email || !password){
      showError('Email dan sandi harus diisi')
      return
    }
    
    loginBtn.disabled = true
    loginBtn.textContent = 'Memproses...'
    
    if(users[email] && users[email] === password){
      localStorage.setItem('app_session_token', btoa(email + ':' + Date.now()))
      localStorage.setItem('current_user', email)
      localStorage.setItem('currentUserId', email.replace(/[^a-z0-9]/g, '_'))
      localStorage.setItem('currentUserEmail', email)
      
      showSuccess('Login berhasil! Mengalihkan...')
      
      setTimeout(() => {
        window.location.href = 'layout.html'
      }, 500)
    } else {
      showError('Email atau sandi salah')
      passwordInput.value = ''
      passwordInput.focus()
      loginBtn.disabled = false
      loginBtn.textContent = 'Masuk'
    }
  })
  
  function showError(message){
    errorMessage.textContent = '❌ ' + message
    errorMessage.style.background = 'rgba(239, 68, 68, 0.1)'
    errorMessage.style.borderColor = 'rgba(239, 68, 68, 0.3)'
    errorMessage.style.color = '#fca5a5'
    errorMessage.classList.add('show')
    setTimeout(() => errorMessage.classList.remove('show'), 4000)
  }
  
  function showSuccess(message){
    errorMessage.textContent = '✅ ' + message
    errorMessage.style.background = 'rgba(34, 197, 94, 0.1)'
    errorMessage.style.borderColor = 'rgba(34, 197, 94, 0.3)'
    errorMessage.style.color = '#86efac'
    errorMessage.classList.add('show')
  }
})
