import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// AUTH
export const registerUser = (data) =>
  API.post('/users/register', data);

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

export const getSubmissions = (assignmentId) =>
  API.get(`/submissions?assignmentId=${assignmentId}`);

export default API;
