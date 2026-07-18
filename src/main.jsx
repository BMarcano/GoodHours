import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Hand off from the instant HTML splash to React's (identical) one
const boot = document.getElementById('boot-splash')
if (boot) {
  boot.style.opacity = '0'
  setTimeout(() => boot.remove(), 350)
}
