import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TeacherDashboard from './pages/TeacherDashboard';
import ClassroomPageTeacher from './pages/ClassroomPageTeacher';
import StudentDashboard from './pages/StudentDashboard';
import ClassroomPageStudent from './pages/ClassroomPageStudent';
import SubmitAssignmentPage from './pages/SubmitAssignmentPage';

import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Teacher Routes */}
          <Route
            path="/teacher-dashboard"
            element={
              <PrivateRoute requiredRole="TEACHER">
                <TeacherDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/classroom/:classroomId"
            element={
              <PrivateRoute requiredRole="TEACHER">
                <ClassroomPageTeacher />
              </PrivateRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student-dashboard"
            element={
              <PrivateRoute requiredRole="STUDENT">
                <StudentDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/classroom/:classroomId/student"
            element={
              <PrivateRoute requiredRole="STUDENT">
                <ClassroomPageStudent />
              </PrivateRoute>
            }
          />
          <Route
            path="/submit-assignment/:assignmentId"
            element={
              <PrivateRoute requiredRole="STUDENT">
                <SubmitAssignmentPage />
              </PrivateRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
