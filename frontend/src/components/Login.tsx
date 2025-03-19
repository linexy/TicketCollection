import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';
import { toast } from 'react-hot-toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password
      });
      
      if (response.data.success) {
        // 保存token到localStorage
        localStorage.setItem('token', response.data.token);
        // 保存用户信息
        localStorage.setItem('user', JSON.stringify(response.data.user));
        // 设置axios默认header
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        
        toast.success('登录成功');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '登录失败');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>票据管理系统</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="请输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="请输入密码"
            />
          </div>
          <button type="submit" className="login-button">
            登录
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login; 