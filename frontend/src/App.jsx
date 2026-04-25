import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import InputPage from './pages/InputPage'
import QCPage from './pages/QCPage'
import PlanPage from './pages/PlanPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"     element={<InputPage />} />
        <Route path="/qc"   element={<QCPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="*"     element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
