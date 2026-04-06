import axios from 'axios';

let accessToken = null;
let refreshPromise = null;
let onUnauthorized = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const setOnUnauthorized = (handler) => {
  onUnauthorized = typeof handler === 'function' ? handler : null;
};

const API = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const requestAccessTokenRefresh = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/users/refresh-token')
      .then((res) => {
        const nextToken = res.data?.accessToken || null;
        setAccessToken(nextToken);
        return nextToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const refreshAccessToken = () => requestAccessTokenRefresh();

API.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config || {};
    const status = err.response?.status;
    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/users/login') ||
      url.includes('/users/signup') ||
      url.includes('/users/register') ||
      url.includes('/users/refresh-token') ||
      url.includes('/users/logout');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const nextToken = await requestAccessTokenRefresh();
        if (nextToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          return API(originalRequest);
        }
      } catch (refreshError) {
        if (onUnauthorized) {
          onUnauthorized();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);


const PAGED_FETCH_LIMIT = 100;
const MAX_PAGED_FETCH_LOOPS = 100;

const buildQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  return query.toString();
};

const fetchAllPages = async (path, params = {}) => {
  let page = 1;
  let allItems = [];
  let totalCount = Infinity;
  let firstResponse = null;

  while (page <= MAX_PAGED_FETCH_LOOPS && allItems.length < totalCount) {
    const query = buildQueryString({
      ...params,
      page,
      limit: PAGED_FETCH_LIMIT,
    });
    const response = await API.get(`${path}${query ? `?${query}` : ''}`);

    if (!firstResponse) {
      firstResponse = response;
    }

    const pageItems = Array.isArray(response.data) ? response.data : [];
    const headerTotal = Number(response.headers?.['x-total-count']);

    if (Number.isFinite(headerTotal) && headerTotal >= 0) {
      totalCount = headerTotal;
    }

    allItems = allItems.concat(pageItems);

    if (pageItems.length < PAGED_FETCH_LIMIT) {
      break;
    }

    page += 1;
  }

  if (!firstResponse) {
    return {
      data: [],
      headers: {},
      status: 200,
      statusText: 'OK',
      config: {},
      request: undefined,
    };
  }

  const normalizedTotal =
    Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : allItems.length;

  return {
    ...firstResponse,
    data: allItems,
    headers: {
      ...firstResponse.headers,
      'x-total-count': String(normalizedTotal),
      'x-page': '1',
      'x-limit': String(Math.max(allItems.length, 1)),
    },
  };
};

// AUTH
export const registerUser = (data) =>
  API.post('/users/signup', data);

export const registerAssistant = (data) =>
  API.post('/users/register-assistant', data);

export const loginUser = (data) =>
  API.post('/users/login', data);

export const continueWithGoogle = (credential) =>
  API.post('/auth/google', { credential });

export const getMe = () =>
  API.get('/users/me');

export const logoutUser = () =>
  API.post('/users/logout');

export const forgotPassword = (data) =>
  API.post('/users/forgot-password', data);

export const resetPassword = (data) =>
  API.post('/users/reset-password', data);

// EXISTING APIs (keep these so nothing breaks)

export const createUser = (data) =>
  API.post('/users', data);

export const createClassroom = (data) =>
  API.post('/classrooms', data);

export const joinClassroom = (data) =>
  API.post('/classrooms/join', data);

export const getClassrooms = () =>
  fetchAllPages('/classrooms');

export const getClassroom = (id) =>
  API.get(`/classrooms/${id}`);

export const getClassroomStudents = (id) =>
  fetchAllPages(`/classrooms/${id}/students`);

export const removeClassroomStudent = (classroomId, studentId) =>
  API.delete(`/classrooms/${classroomId}/students/${studentId}`);
export const getUsers = () =>
  fetchAllPages('/users');

export const getUser = (id) =>
  API.get(`/users/${id}`);

export const getAllAssignments = () =>
  fetchAllPages('/assignments');

export const getAllSubmissions = () =>
  fetchAllPages('/submissions');

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
  fetchAllPages(`/users/teachers/${teacherId}/assistants`);

export const getTeacherAssistantCode = (teacherId) =>
  API.get(`/users/teachers/${teacherId}/assistant-code`);

export const removeTeacherAssistant = (teacherId, assistantId) =>
  API.delete(`/users/teachers/${teacherId}/assistants/${assistantId}`);

export const createAssignment = (formData) =>
  API.post('/assignments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getAssignments = (classroomId) =>
  fetchAllPages('/assignments', { classroomId });

export const getAssignmentById = (id) =>
  API.get(`/assignments/${id}`);

export const updateAssignment = (id, data) =>
  API.put(`/assignments/${id}`, data);

export const deleteAssignment = (id) =>
  API.delete(`/assignments/${id}`);

export const submitAssignment = (formData) =>
  API.post('/submissions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const submitAssignmentOnBehalf = (formData) =>
  API.post('/submissions/on-behalf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getSubmissions = (assignmentId, classroomId, options = {}) => {
  const params = new URLSearchParams();

  if (classroomId) {
    params.set('classroomId', classroomId);
  } else if (assignmentId) {
    params.set('assignmentId', assignmentId);
  }

  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.limit) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  return API.get(`/submissions${query ? `?${query}` : ''}`);
};

export const getStudentSubmissions = (studentId) =>
  fetchAllPages('/submissions', { studentId });

export const getStudentSubmission = (assignmentId, studentId) =>
  API.get(`/submissions/by-student?assignmentId=${assignmentId}&studentId=${studentId}`);

export const updateSubmission = (submissionId, data) =>
  API.patch(`/submissions/${submissionId}`, data);

export const getSubmissionPdf = (submissionId) =>
  API.get(`/submissions/${submissionId}/pdf`, { responseType: 'blob' });

export const getSubmissionById = (submissionId) =>
  API.get(`/submissions/${submissionId}`);

export const deleteSubmission = (submissionId) =>
  API.delete(`/submissions/${submissionId}`);

export const markSubmissionsReviewed = (data) =>
  API.post('/submissions/mark-reviewed', data);

export const createResubmissionRequest = (data) =>
  API.post('/resubmissions', data);

export const getResubmissionRequests = (userId, status) =>
  API.get(`/resubmissions?userId=${userId}${status ? `&status=${status}` : ''}`);

export const updateResubmissionRequest = (id, data) =>
  API.patch(`/resubmissions/${id}`, data);

export default API;
