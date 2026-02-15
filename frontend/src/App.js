import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import PrivateRoute from './components/PrivateRoute';
import LanguageToggle from './components/LanguageToggle';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TeacherDashboard from './pages/TeacherDashboard';
import AssistantDashboard from './pages/AssistantDashboard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminClassrooms from './pages/admin/AdminClassrooms';
import AdminAssignments from './pages/admin/AdminAssignments';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import ClassroomPageTeacher from './pages/ClassroomPageTeacher';
import StudentDashboard from './pages/StudentDashboard';
import ClassroomPageStudent from './pages/ClassroomPageStudent';
import SubmitAssignmentPage from './pages/SubmitAssignmentPage';
import ResubmissionRequestsPage from './pages/ResubmissionRequestsPage';
import StudentProgressPage from './pages/StudentProgressPage';
import ClassroomSubmissionsPage from './pages/ClassroomSubmissionsPage';
import GradeOnBehalfPage from './pages/GradeOnBehalfPage';

import './index.css';

function App() {
  return (
    <Router>
      <I18nProvider>
        <AuthProvider>
          <LanguageToggle />
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

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <PrivateRoute requiredRole="ADMIN">
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route path="users" element={<AdminUsers />} />
            <Route path="teachers" element={<AdminTeachers />} />
            <Route path="classrooms" element={<AdminClassrooms />} />
            <Route path="assignments" element={<AdminAssignments />} />
            <Route path="submissions" element={<AdminSubmissions />} />
            <Route path="*" element={<AdminUsers />} />
          </Route>

          <Route
            path="/admin-dashboard"
            element={<Navigate to="/admin/users" replace />}
          />
          <Route
            path="/classroom/:classroomId"
            element={
              <PrivateRoute requiredRole={['TEACHER', 'ASSISTANT']}>
                <ClassroomPageTeacher />
              </PrivateRoute>
            }
          />
          <Route
            path="/classroom/:classroomId/submissions"
            element={
              <PrivateRoute requiredRole={['TEACHER', 'ASSISTANT']}>
                <ClassroomSubmissionsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/classroom/:classroomId/grade-on-behalf"
            element={
              <PrivateRoute requiredRole={['TEACHER', 'ASSISTANT']}>
                <GradeOnBehalfPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/resubmission-requests"
            element={
              <PrivateRoute requiredRole={['TEACHER', 'ASSISTANT']}>
                <ResubmissionRequestsPage />
              </PrivateRoute>
            }
          />

          {/* Assistant Routes */}
          <Route
            path="/assistant-dashboard"
            element={
              <PrivateRoute requiredRole="ASSISTANT">
                <AssistantDashboard />
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
            path="/student-progress"
            element={
              <PrivateRoute requiredRole="STUDENT">
                <StudentProgressPage />
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
      </I18nProvider>
    </Router>
  );
}

export default App;
