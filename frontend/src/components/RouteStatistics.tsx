import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Segmented, Tabs, Button } from 'antd';
import axios from 'axios';
import '../styles/RouteStatistics.css';
import '../styles/TicketList.css';
import dayjs from 'dayjs';
import { format } from 'date-fns';

interface RouteData {
  route: string;
  count: number;
}

interface LocationState {
  activeTab: 'train' | 'flight';
  startDate: string;
  endDate: string;
  routeData: RouteData[];
}

const RouteStatistics: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  
  const [activeTab, setActiveTab] = useState<'train' | 'flight'>(state?.activeTab || 'train');
  const [routeData, setRouteData] = useState<RouteData[]>(state?.routeData || []);
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

  // 获取路线数据
  const fetchRouteData = async () => {
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
        // 使用allRoutes替代routeData，显示全部路线数据
        const allRoutes = response.data.data.allRoutes || [];
        // 对所有路线按出行次数降序排序
        const sortedRoutes = [...allRoutes].sort((a, b) => b.count - a.count);
        setRouteData(sortedRoutes);
      }
    } catch (error) {
      console.error('获取路线数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 当日期或标签变化时获取数据
  useEffect(() => {
    fetchRouteData();
  }, [startDate, endDate, activeTab]);

  // 返回统计页面
  const navigateBack = () => {
    navigate(-1);
  };

  // 渲染路线排行榜
  const renderRouteRanking = () => {
    if (loading) {
      return <div className="loading-container">加载路线数据中...</div>;
    }
    
    if (!routeData || routeData.length === 0) {
      return <div className="no-data">暂无路线数据</div>;
    }
    
    return (
      <div className="route-section">

        
        <div className="route-bars">
          {routeData.map((item, index) => {
            // 确定TOP标签的样式和文本
            const getTopLabel = (index: number) => {
              if (index === 0) return 'TOP1';
              if (index === 1) return 'TOP2';
              if (index === 2) return 'TOP3';
              return `${index + 1}`;
            };
            
            // 根据位置设置不同的颜色
            const getTopColor = (index: number) => {
              if (index === 0) return '#19be6b'; // 绿色
              if (index === 1) return '#7b5af7'; // 紫色
              if (index === 2) return '#1890ff'; // 蓝色
              return '#666'; // 灰色
            };
            
            // 计算百分比宽度，最大的为100%
            const maxCount = routeData[0].count;
            const percentage = (item.count / maxCount) * 100;
            
            // 根据TOP位置设置不同的渐变色
            const getGradientStyle = (index: number) => {
              if (index === 0) {
                return { background: 'linear-gradient(90deg, #36d1dc 0%, #19be6b 100%)' };
              } else if (index === 1) {
                return { background: 'linear-gradient(90deg, #36d1dc 0%, #7b5af7 100%)' };
              } else if (index === 2) {
                return { background: 'linear-gradient(90deg, #36d1dc 0%, #1890ff 100%)' };
              } else {
                return { background: 'linear-gradient(90deg, #36d1dc 0%, #5b8def 100%)' };
              }
            };
            
            return (
              <div className="route-item" key={item.route}>
                <div className="route-content">
                  <div className="route-header">
                    <span className={`route-rank ${index < 3 ? `top-${index+1}-label` : 'normal-label'}`}>
                      {getTopLabel(index)}
                    </span>
                    <span className="route-name">{item.route}</span>
                  </div>
                  <div className="route-bar-wrapper">
                    <div className="route-bar-container">
                      <div 
                        className={`route-bar ${index < 3 ? `top-${index+1}-bar` : 'gradient-bar'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="route-count">{item.count}次</span>
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
    <div className={`route-statistics-container ${isMobileView ? 'mobile-view' : ''}`}>
      {/* 页面标题 */}
      <div className="route-statistics-header">
        <div className="header-left">
          <Button 
            type="text" 
            className="back-button"
            onClick={navigateBack}
          >
            &lt; 返回
          </Button>
          <h2 className="page-title"><img src="/line.svg" alt="线路" className="nav-icon2" />路线排行</h2>
        </div>
      </div>

      {/* 非移动端导航区域 */}
      {!isMobileView && (
        <>
          <div className="route-statistics-tabs">
            <button 
              className={`tab-button ${activeTab === 'train' ? 'active' : ''}`}
              onClick={() => setActiveTab('train')}
            >
              火车票路线
            </button>
            <button 
              className={`tab-button ${activeTab === 'flight' ? 'active' : ''}`}
              onClick={() => setActiveTab('flight')}
            >
              飞机票路线
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

      <div className="route-statistics-content">
        <div className="route-chart-container">
          {renderRouteRanking()}
        </div>
      </div>
    </div>
  );
};

export default RouteStatistics;