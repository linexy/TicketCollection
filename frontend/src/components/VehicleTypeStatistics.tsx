import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Segmented, Tabs, Button } from 'antd';
import axios from 'axios';
import '../styles/VehicleTypeStatistics.css';
import '../styles/TicketList.css';
import dayjs from 'dayjs';
import { format } from 'date-fns';

interface VehicleTypeData {
  type: string;
  count: number;
}

interface LocationState {
  activeTab: 'train' | 'flight';
  startDate: string;
  endDate: string;
  vehicleTypesData: VehicleTypeData[];
}

const VehicleTypeStatistics: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  
  const [activeTab, setActiveTab] = useState<'train' | 'flight'>(state?.activeTab || 'train');
  const [vehicleTypesData, setVehicleTypesData] = useState<VehicleTypeData[]>(state?.vehicleTypesData || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeQuickDate, setActiveQuickDate] = useState<string>('currentMonth');
  const [startDate, setStartDate] = useState<string>(state?.startDate || '');
  const [endDate, setEndDate] = useState<string>(state?.endDate || '');
  const [isMobileView, setIsMobileView] = useState<boolean>(window.innerWidth <= 768);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 设置快速日期范围
  const setQuickDateRange = (range: 'currentMonth' | 'lastMonth' | 'currentYear' | 'lastYear' | 'all') => {
    setActiveQuickDate(range);
    
    let start = null;
    let end = null;
    
    switch(range) {
      case 'currentMonth':
        const now = dayjs().tz('Asia/Shanghai');
        const startDate = now.startOf('month');
        const endDate = now.endOf('month');
        start = startDate.toDate();
        end = endDate.toDate();
        break;
      case 'lastMonth':
        const lastMonth = dayjs().tz('Asia/Shanghai').subtract(1, 'month');
        const startDateLastMonth = lastMonth.startOf('month');
        const endDateLastMonth = lastMonth.endOf('month');
        start = startDateLastMonth.toDate();
        end = endDateLastMonth.toDate();
        break;
      case 'currentYear':
        const startDateYear = dayjs().tz('Asia/Shanghai').startOf('year');
        const endDateYear = dayjs().tz('Asia/Shanghai').endOf('year');
        start = startDateYear.toDate();
        end = endDateYear.toDate();
        break;
      case 'lastYear':
        const lastYear = dayjs().tz('Asia/Shanghai').subtract(1, 'year').year();
        const startDateLastYear = dayjs().tz('Asia/Shanghai').year(lastYear).startOf('year');
        const endDateLastYear = dayjs().tz('Asia/Shanghai').year(lastYear).endOf('year');
        start = startDateLastYear.toDate();
        end = endDateLastYear.toDate();
        break;
      case 'all':
        // 全部数据，设置为实际数据开始的日期
        start = new Date(2012, 3, 1); // 2013年4月1日
        end = dayjs().tz('Asia/Shanghai').endOf('month').toDate(); // 当前月的最后一天
        break;
    }
    
    setStartDate(start ? format(start, 'yyyy-MM-dd') : '');
    setEndDate(end ? format(end, 'yyyy-MM-dd') : '');
  };

  // 初始化时，如果没有传入日期，则设置为本月
  useEffect(() => {
    if (!startDate || !endDate) {
      setQuickDateRange('currentMonth');
    }
  }, []);

  // 获取车型数据
  const fetchVehicleTypeData = async () => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    
    try {
      const endpoint = activeTab === 'train' ? '/api/statistics/train' : '/api/statistics/flight';
      
      // 计算时间跨度，如果超过3年或选择全部，则按年统计
      const startYear = startDate ? new Date(startDate).getFullYear() : 2013;
      const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
      const isAllData = !startDate || startDate.includes('2012-04');
      const groupBy = (endYear - startYear > 3 || isAllData) ? 'year' : 'month';
      
      const response = await axios.get(endpoint, {
        params: {
          startDate,
          endDate,
          groupBy
        }
      });
      
      if (response.data.success && response.data.data) {
        const vehicleTypes = response.data.data.vehicleTypes || [];
        // 对所有车型按乘坐次数降序排序
        const sortedVehicleTypes = [...vehicleTypes].sort((a, b) => b.count - a.count);
        setVehicleTypesData(sortedVehicleTypes);
      }
    } catch (error) {
      console.error('获取车型数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 当日期或标签变化时获取数据
  useEffect(() => {
    fetchVehicleTypeData();
  }, [startDate, endDate, activeTab]);

  // 返回统计页面
  const navigateBack = () => {
    navigate(-1);
  };

  // 渲染车型排行榜
  const renderVehicleTypeRanking = () => {
    if (loading) {
      return <div className="loading-container">加载车型数据中...</div>;
    }
    
    if (!vehicleTypesData || vehicleTypesData.length === 0) {
      return <div className="no-data">暂无车型数据</div>;
    }
    
    return (
      <div className="vehicle-type-section">
        
        <div className="vehicle-type-bars">
          {vehicleTypesData.map((item, index) => {
            // 确定TOP标签的样式和文本
            const getTopLabel = (index: number) => {
              if (index === 0) return 'TOP1';
              if (index === 1) return 'TOP2';
              if (index === 2) return 'TOP3';
              return `${index + 1}`;
            };
            
            // 计算百分比宽度，最大的为100%
            const maxCount = vehicleTypesData[0].count;
            const percentage = (item.count / maxCount) * 100;
            
            return (
              <div className="vehicle-type-item" key={item.type}>
                <div className="vehicle-type-content">
                  <div className="vehicle-type-header">
                    <span className={`vehicle-type-rank ${index < 3 ? `top-${index+1}-label` : 'normal-label'}`}>
                      {getTopLabel(index)}
                    </span>
                    <span className="vehicle-type-name">{item.type}</span>
                  </div>
                  <div className="vehicle-type-bar-wrapper">
                    <div className="vehicle-type-bar-container">
                      <div 
                        className={`vehicle-type-bar ${index < 3 ? `top-${index+1}-bar` : 'gradient-bar'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="vehicle-type-count">{item.count}次</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`vehicle-type-statistics-container ${isMobileView ? 'mobile-view' : ''}`}>
      {/* 页面标题 */}
      <div className="vehicle-type-statistics-header">
        <div className="header-left">
          <Button 
            type="text" 
            className="back-button"
            onClick={navigateBack}
          >
            &lt; 返回
          </Button>
          <h2 className="page-title">
            <img src="/static2.svg" alt="车型" className="nav-icon2" />
            {activeTab === 'train' ? '车型排行' : '机型排行'}
          </h2>
        </div>
      </div>

      {/* 非移动端导航区域 */}
      {!isMobileView && (
        <>
          <div className="vehicle-type-statistics-tabs">
            <button 
              className={`tab-button ${activeTab === 'train' ? 'active' : ''}`}
              onClick={() => setActiveTab('train')}
            >
              火车车型
            </button>
            <button 
              className={`tab-button ${activeTab === 'flight' ? 'active' : ''}`}
              onClick={() => setActiveTab('flight')}
            >
              飞机机型
            </button>
          </div>

          {/* 添加时间选择区间 */}
          <div className="date-range-filter">
            <div className="filter-buttons">
              <div className="quick-date-buttons">
                <Segmented
                  value={activeQuickDate}
                  onChange={(value) => setQuickDateRange(value as 'currentMonth' | 'lastMonth' | 'currentYear' | 'lastYear' | 'all')}
                  options={[
                    { label: '本月', value: 'currentMonth' },
                    { label: '上月', value: 'lastMonth' },
                    { label: '今年', value: 'currentYear' },
                    { label: '去年', value: 'lastYear' },
                    { label: '全部', value: 'all' }
                  ]}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 排行榜内容 */}
      <div className="vehicle-type-statistics-content">
        <div className="vehicle-type-chart-container">
        {renderVehicleTypeRanking()}
        </div>
      </div>
    </div>
  );
};

export default VehicleTypeStatistics; 