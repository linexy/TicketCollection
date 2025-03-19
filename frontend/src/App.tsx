import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TicketList from './components/TicketList';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import MobileLayout from './components/MobileLayout';
import HomePage from './components/HomePage';
import Statistics from './components/Statistics';
import RouteStatistics from './components/RouteStatistics';
import StationStatistics from './components/StationStatistics';
import VehicleTypeStatistics from './components/VehicleTypeStatistics';
import { isMobile } from 'react-device-detect';
import { format } from 'date-fns';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'stats'>('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 为Statistics组件添加默认的日期范围
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultStartDate = format(firstDayOfMonth, 'yyyy-MM-dd');
  const defaultEndDate = format(today, 'yyyy-MM-dd');

  // 使用useCallback优化性能
  const handleTabChange = useCallback((tab: 'home' | 'history' | 'stats') => {
    setActiveTab(tab);
  }, []);

  const handleAddTicket = useCallback(() => {
    // 切换到历史页面并打开添加车票模态框
    setActiveTab('history');
    setIsModalOpen(true);
  }, []);

  // 预渲染所有页面组件，但只显示当前活动的页面
  // 这样可以保持页面状态，使切换更流畅
  const renderMobileContent = () => {
    return (
      <MobileLayout activeTab={activeTab} onTabChange={handleTabChange}>
        <div style={{ display: activeTab === 'home' ? 'block' : 'none', height: '100%' }}>
          <HomePage onAddTicket={handleAddTicket} />
        </div>
        <div style={{ display: activeTab === 'history' ? 'block' : 'none', height: '100%' }}>
          <TicketList 
            isMobileView={true} 
            isModalOpen={isModalOpen}
            setIsModalOpen={setIsModalOpen}
            onTabChange={handleTabChange}
          />
        </div>
        <div style={{ display: activeTab === 'stats' ? 'block' : 'none', height: '100%' }}>
          <Statistics 
            isMobileView={true} 
            startDate={defaultStartDate}
            endDate={defaultEndDate}
          />
        </div>
      </MobileLayout>
    );
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              {isMobile ? renderMobileContent() : (
                <TicketList 
                  isMobileView={false}
                  isModalOpen={isModalOpen}
                  setIsModalOpen={setIsModalOpen}
                />
              )}
            </PrivateRoute>
          }
        />
        <Route 
          path="/routes" 
          element={
            <PrivateRoute>
              <RouteStatistics />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/stations" 
          element={
            <PrivateRoute>
              <StationStatistics />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/vehicle-types" 
          element={
            <PrivateRoute>
              <VehicleTypeStatistics />
            </PrivateRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
