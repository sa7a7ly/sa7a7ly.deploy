import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

export const registerUser = (data) =>
  API.post('/users/register', data);

export const registerAssistant = (data) =>
  API.post('/users/register-assistant', data);

export const loginUser = (data) =>
  API.post('/users/login', data);

export const getUsers = () =>
  API.get('/users');

export const getClassrooms = () =>
  API.get('/classrooms');

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

export default API;
