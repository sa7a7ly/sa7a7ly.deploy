import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// AUTH
export const registerUser = (data) =>
  API.post('/users/register', data);

export const registerAssistant = (data) =>
  API.post('/users/register-assistant', data);

export const loginUser = (data) =>
  API.post('/users/login', data);

// EXISTING APIs (keep these so nothing breaks)

export const createUser = (data) =>
  API.post('/users', data);

export const createClassroom = (data) =>
  API.post('/classrooms', data);

export const joinClassroom = (data) =>
  API.post('/classrooms/join', data);

export const getClassrooms = () =>
  API.get('/classrooms');

export const getClassroom = (id) =>
  API.get(`/classrooms/${id}`);

export const getClassroomStudents = (id) =>
  API.get(`/classrooms/${id}/students`);
export const getUsers = () =>
  API.get('/users');

export const getUser = (id) =>
  API.get(`/users/${id}`);

export const getAllAssignments = () =>
  API.get('/assignments');

export const getAllSubmissions = () =>
  API.get('/submissions');

export const createTeacher = (data, adminSecret) =>
  API.post('/users/teachers', data, {
    headers: {
      'x-admin-secret': adminSecret,
    },
  });

export const updateTeacherSubscription = (teacherId, data, adminSecret) =>
  API.patch(`/users/teachers/${teacherId}/subscription`, data, {
    headers: {
      'x-admin-secret': adminSecret,
    },
  });

export const getTeacherAssistants = (teacherId) =>
  API.get(`/users/teachers/${teacherId}/assistants`);

export const getTeacherAssistantCode = (teacherId) =>
  API.get(`/users/teachers/${teacherId}/assistant-code`);

export const createAssignment = (formData) =>
  API.post('/assignments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getAssignments = (classroomId) =>
  API.get(`/assignments?classroomId=${classroomId}`);

export const getAssignmentById = (id) =>
  API.get(`/assignments/${id}`);

export const submitAssignment = (formData) =>
  API.post('/submissions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const submitAssignmentOnBehalf = (formData) =>
  API.post('/submissions/on-behalf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getSubmissions = (assignmentId, classroomId) => {
  if (classroomId) {
    return API.get(`/submissions?classroomId=${classroomId}`);
  }
  if (assignmentId) {
    return API.get(`/submissions?assignmentId=${assignmentId}`);
  }
  return API.get('/submissions');
};

export const getStudentSubmissions = (studentId) =>
  API.get(`/submissions?studentId=${studentId}`);

export const getStudentSubmission = (assignmentId, studentId) =>
  API.get(`/submissions/by-student?assignmentId=${assignmentId}&studentId=${studentId}`);

export const updateSubmission = (submissionId, data) =>
  API.patch(`/submissions/${submissionId}`, data);

export const getSubmissionPdf = (submissionId) =>
  API.get(`/submissions/${submissionId}/pdf`, { responseType: 'blob' });

export const getSubmissionById = (submissionId) =>
  API.get(`/submissions/${submissionId}`);

export const markSubmissionsReviewed = (data) =>
  API.post('/submissions/mark-reviewed', data);

export const createResubmissionRequest = (data) =>
  API.post('/resubmissions', data);

export const getResubmissionRequests = (userId, status) =>
  API.get(`/resubmissions?userId=${userId}${status ? `&status=${status}` : ''}`);

export const updateResubmissionRequest = (id, data) =>
  API.patch(`/resubmissions/${id}`, data);

export default API;
