import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Auth API
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    apiClient.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),

  me: () => apiClient.get('/auth/me'),
}

// Users API
export const usersApi = {
  getAll: () => apiClient.get('/users'),
  getById: (id: string) => apiClient.get(`/users/${id}`),
  update: (id: string, data: any) => apiClient.put(`/users/${id}`, data),
}

// Proposals API
export const proposalsApi = {
  getAll: () => apiClient.get('/proposals'),
  getById: (id: string) => apiClient.get(`/proposals/${id}`),
  create: (data: any) => apiClient.post('/proposals', data),
  vote: (id: string, voteOption: string) =>
    apiClient.post(`/proposals/${id}/vote`, { voteOption }),
}

// Courses API
export const coursesApi = {
  getAll: () => apiClient.get('/courses'),
  getById: (id: string) => apiClient.get(`/courses/${id}`),
  enroll: (id: string) => apiClient.post(`/courses/${id}/enroll`),
  updateProgress: (id: string, progress: number) =>
    apiClient.put(`/courses/${id}/progress`, { progress }),
}

// Chat API
export const chatApi = {
  sendMessage: (data: { message: string; conversationHistory?: any[] }) =>
    apiClient.post('/chat', data),
}
