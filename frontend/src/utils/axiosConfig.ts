import axios from 'axios';
import { toast } from 'react-hot-toast';

// 设置基础URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// 请求拦截器
axios.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    
    // 如果token存在，则添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // 处理401未授权错误
    if (error.response?.status === 401) {
      // 清除本地存储的token和用户信息
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // 显示提示信息
      toast.error('登录已过期，请重新登录');
      
      // 重定向到登录页面
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default axios; 