import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';

const ProtectedRoute = ({ children, role }) => {
  const { token, role: userRole } = useAuth();

  if (!token) return <Navigate to="/login" />;
  if (role && role !== userRole) return <Navigate to="/login" />;

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />

          <Route
  path="/teacher"
  element={
    <ProtectedRoute role="teacher">
      <TeacherDashboard />
    </ProtectedRoute>
  }
/>


          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <div className="p-6">Student Dashboard (placeholder)</div>
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
