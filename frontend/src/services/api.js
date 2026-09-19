import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const serverError = error?.response?.data?.error;

    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      message.warning('登录状态失效，请重新登录');
    } else if (status === 429) {
      message.warning('请求频率过高，请稍后重试');
    } else if (!error?.response) {
      message.error('网络连接失败，请确认服务已启动');
    } else if (serverError) {
      message.error(serverError);
    }

    return Promise.reject(error);
  }
);

export const login = async (payload) => {
  const { data } = await api.post('/auth/login', payload);
  return data;
};

export const getProfile = async () => {
  const { data } = await api.get('/auth/profile');
  return data;
};

export const changePassword = async (payload) => {
  const { data } = await api.post('/auth/change-password', payload);
  return data;
};

export const fetchResource = async (resource) => {
  const { data } = await api.get(`/${resource}`);
  return data;
};

export const createResource = async (resource, payload) => {
  const { data } = await api.post(`/${resource}`, payload);
  return data;
};

export const updateResource = async (resource, id, payload) => {
  const { data } = await api.put(`/${resource}/${id}`, payload);
  return data;
};

export const deleteResource = async (resource, id) => {
  const { data } = await api.delete(`/${resource}/${id}`);
  return data;
};

export const createBackup = async () => {
  const { data } = await api.post('/data/backup');
  return data;
};

export const listBackups = async () => {
  const { data } = await api.get('/data/backups');
  return data;
};

export const restoreBackup = async (fileName) => {
  const { data } = await api.post('/data/restore', { fileName });
  return data;
};

export const listAuditLogs = async (limit = 200) => {
  const { data } = await api.get('/system/audit-logs', { params: { limit } });
  return data;
};

export default api;
