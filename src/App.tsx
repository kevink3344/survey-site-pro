import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PublicSurveyPage } from './pages/PublicSurveyPage'
import { ResponsesPage } from './pages/ResponsesPage'
import { SettingsPage } from './pages/SettingsPage'
import { SurveyDeletePage } from './pages/SurveyDeletePage'
import { SurveyEditorPage } from './pages/SurveyEditorPage'
import { SurveyResultsPage } from './pages/SurveyResultsPage'
import { SurveysPage } from './pages/SurveysPage'

function AppRouter() {
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const next = stored === 'dark'
    setDarkMode(next)
    document.documentElement.classList.toggle('dark', next)
  }, [])

  const toggleMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  if (location.pathname.startsWith('/s/')) {
    return (
      <Routes>
        <Route path="/s/:slug/:code" element={<PublicSurveyPage />} />
      </Routes>
    )
  }

  return (
    <AppShell darkMode={darkMode} onToggleMode={toggleMode}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/surveys/new" element={<SurveyEditorPage />} />
        <Route path="/surveys/:id/edit" element={<SurveyEditorPage />} />
        <Route path="/surveys/:id/delete" element={<SurveyDeletePage />} />
        <Route path="/surveys/:id/results" element={<SurveyResultsPage />} />
        <Route path="/responses" element={<ResponsesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
