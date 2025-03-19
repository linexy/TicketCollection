import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Segmented, Tabs, Button } from 'antd'; // 导入Ant Design组件
import '../styles/Statistics.css';
import '../styles/TicketList.css'; // 导入TicketList.css以使用其中的样式
import StationsMap from './StationsMap';
import dayjs from 'dayjs';
import { format, isWithinInterval, parse, startOfDay, endOfDay, subDays, subMonths, subYears, endOfMonth, startOfMonth, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import FilterPopup from './FilterPopup';
import YearSelector from './YearSelector';

// 注册 Chart.js 组件
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler
);

interface StatisticsProps {
  startDate: string;
  endDate: string;
  isMobileView?: boolean;
}

interface TrendData {
  date: string;
  count: number;
  expense: number;
}

interface RouteData {
  route: string;
  count: number;
}

interface VehicleTypeData {
  type: string;
  count: number;
}

interface StatisticsData {
  trendData: TrendData[];
  routeData: RouteData[];  // 前10名路线
  allRoutes: RouteData[];  // 所有路线
  totalHours: number;
  totalDistance: number;  // 添加总里程字段
  uniqueTrains: number;  // 添加不同车次/航班数量字段
  totalCount: number;
  totalExpense: number;
  vehicleTypes: VehicleTypeData[]; // 添加车型/机型统计数据
}

const Statistics: React.FC<StatisticsProps> = ({ startDate: initialStartDate, endDate: initialEndDate, isMobileView = false }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'train' | 'flight'>('train');
  const [trainData, setTrainData] = useState<StatisticsData | null>(null);
  const [flightData, setFlightData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeQuickDate, setActiveQuickDate] = useState<string>('currentMonth');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [summary, setSummary] = useState({
    totalTrips: 0,
    totalExpense: 0,
    totalStations: 0,
    totalRoutes: 0,
    totalTime: 0,
    uniqueTrains: 0,
    totalDistance: 0
  });
  // 添加年份选择相关状态
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showAllYears, setShowAllYears] = useState(false);
  // 增加筛选弹出框的状态
  const [filterVisible, setFilterVisible] = useState(false);
  
  // 计算可用年份
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2013; year <= currentYear; year++) {
      years.push(year);
    }
    setAvailableYears(years);
    
    
      setSelectedYear(currentYear);
      // 设置为当前年份
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setEndDate(format(end, 'yyyy-MM-dd'));
    
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
        start = new Date(2013, 3, 1); // 2013年4月1日
        end = dayjs().tz('Asia/Shanghai').endOf('month').toDate(); // 当前月的最后一天
        break;
    }
    
    setStartDate(start ? format(start, 'yyyy-MM-dd') : '');
    setEndDate(end ? format(end, 'yyyy-MM-dd') : '');
  };

  // 单独获取火车票数据
  const fetchTrainData = async () => {
    try {
      // 计算时间跨度，如果超过3年或选择全部，则按年统计
      const startYear = startDate ? new Date(startDate).getFullYear() : 2013;
      const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
      const isAllData = !startDate || startDate.includes('2013-04');
      const groupBy = (endYear - startYear > 3 || isAllData) ? 'year' : 'month';
      
      // 计算日期差
      const start = startDate ? new Date(startDate) : new Date(2013, 3, 1);
      const end = endDate ? new Date(endDate) : new Date();
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
       
      // 对于月视图，添加参数指示是否保留按周的趋势显示
      const trendGroupBy = diffDays <= 60 ? 'week' : groupBy;
      
      const response = await axios.get('/api/statistics/train', {
        params: { 
          startDate,
          endDate,
          groupBy,      // 用于计算总计数据的分组方式
          trendGroupBy  // 用于图表显示的分组方式
        }
      });
        
      if (response.data.success) {
        const data = response.data.data;
        
        // 添加模拟车型数据 (如果后端未提供)
        if (!data.vehicleTypes) {
          data.vehicleTypes = [
            { type: "CR400AFA", count: 90 },
            { type: "CR400BF", count: 60 },
            { type: "CRH380", count: 50 },
            { type: "CRH1E", count: 60 }
          ];
        }
        
        setTrainData(data);
        
        // 直接使用后端计算的总体统计数据
        if (data) {
          // 计算站点数和路线数
          const stations = new Set<string>();
          const routes = new Set<string>();
          if (data.allRoutes) {
            data.allRoutes.forEach((item: RouteData) => {
              const [from, to] = item.route.split('-');
              if (from) stations.add(from);
              if (to) stations.add(to);
              routes.add(item.route);
            });
          }
          
          setSummary({
            // 使用后端提供的总体统计数据
            totalTrips: data.totalCount || 0,
            totalExpense: data.totalExpense || 0,
            totalStations: stations.size,
            totalRoutes: routes.size,
            totalTime: data.totalHours || 0,
            uniqueTrains: data.uniqueTrains || 0,
            totalDistance: data.totalDistance || 0
          });
        }
      }
    } catch (error) {
      console.error('获取火车票统计数据失败:', error);
    }
  };
  
  // 单独获取飞机票数据
  const fetchFlightData = async () => {
    try {
      // 计算时间跨度，如果超过3年或选择全部，则按年统计
      const startYear = startDate ? new Date(startDate).getFullYear() : 2013;
      const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
      const isAllData = !startDate || startDate.includes('2013-04');
      const groupBy = (endYear - startYear > 3 || isAllData) ? 'year' : 'month';
      
      // 计算日期差
      const start = startDate ? new Date(startDate) : new Date(2013, 3, 1);
      const end = endDate ? new Date(endDate) : new Date();
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      // 对于月视图，添加参数指示是否保留按周的趋势显示
      const trendGroupBy = diffDays <= 60 ? 'week' : groupBy;
      
      const response = await axios.get('/api/statistics/flight', {
        params: {
          startDate,
          endDate,
          groupBy,      // 用于计算总计数据
          trendGroupBy  // 用于图表显示
        }
      });
      
      if (response.data.success) {
        const data = response.data.data;
        
        // 添加模拟机型数据 (如果后端未提供)
        if (!data.vehicleTypes) {
          data.vehicleTypes = [
            { type: "A320", count: 45 },
            { type: "B737", count: 38 },
            { type: "A330", count: 12 },
            { type: "B777", count: 5 }
          ];
        }
        
        setFlightData(data);
        
        // 直接使用后端计算的总体统计数据
        if (data) {
          // 计算站点数和路线数
          const stations = new Set<string>();
          const routes = new Set<string>();
          if (data.allRoutes) {
            data.allRoutes.forEach((item: RouteData) => {
              const [from, to] = item.route.split('-');
              if (from) stations.add(from);
              if (to) stations.add(to);
              routes.add(item.route);
            });
          }
          
          setSummary({
            // 使用后端提供的总体统计数据
            totalTrips: data.totalCount || 0,
            totalExpense: data.totalExpense || 0,
            totalStations: stations.size,
            totalRoutes: routes.size,
            totalTime: data.totalHours || 0,
            uniqueTrains: data.uniqueTrains || 0,
            totalDistance: data.totalDistance || 0
          });
        }
      }
    } catch (error) {
      console.error('获取飞机票统计数据失败:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      // 确保startDate和endDate都有值
      if (!startDate || !endDate) return;
      
      setLoading(true);
      
      if (activeTab === 'train') {
        await fetchTrainData();
      } else {
        await fetchFlightData();
      }
      
      setLoading(false);
    };

    fetchData();
  }, [startDate, endDate, activeTab]);

  // 当切换标签时更新统计数据
  useEffect(() => {
    if (activeTab === 'train' && trainData) {
      // 计算站点数和路线数
      const stations = new Set<string>();
      const routes = new Set<string>();
      if (trainData.allRoutes) {
        trainData.allRoutes.forEach((item: RouteData) => {
          const [from, to] = item.route.split('-');
          if (from) stations.add(from);
          if (to) stations.add(to);
          routes.add(item.route);
        });
      }
      
      // 直接使用后端返回的总体统计数据
      setSummary({
        totalTrips: trainData.totalCount || 0,
        totalExpense: trainData.totalExpense || 0,
        totalStations: stations.size,
        totalRoutes: routes.size,
        totalTime: trainData.totalHours || 0,
        uniqueTrains: trainData.uniqueTrains || 0,
        totalDistance: trainData.totalDistance || 0
      });
    } else if (activeTab === 'flight' && flightData) {
      // 计算站点数和路线数
      const stations = new Set<string>();
      const routes = new Set<string>();
      if (flightData.allRoutes) {
        flightData.allRoutes.forEach((item: RouteData) => {
          const [from, to] = item.route.split('-');
          if (from) stations.add(from);
          if (to) stations.add(to);
          routes.add(item.route);
        });
      }
      
      // 直接使用后端返回的总体统计数据
      setSummary({
        totalTrips: flightData.totalCount || 0,
        totalExpense: flightData.totalExpense || 0,
        totalStations: stations.size,
        totalRoutes: routes.size,
        totalTime: flightData.totalHours || 0,
        uniqueTrains: flightData.uniqueTrains || 0,
        totalDistance: flightData.totalDistance || 0
      });
    }
  }, [activeTab, trainData, flightData]);

  const getCurrentData = () => {
    return activeTab === 'train' ? trainData : flightData;
  };

  // 导航到路线统计页面
  const navigateToRouteStats = () => {
    navigate('/routes', { 
      state: { 
        activeTab, 
        startDate, 
        endDate,
        routeData: getCurrentData()?.allRoutes || []  // 使用allRoutes替代routeData，显示全部路线数据
      } 
    });
  };

  // 导航到车站统计页面
  const navigateToStationStats = () => {
    // 计算去过最多的车站和各车站访问次数
    const data = getCurrentData();
    if (!data) return;
    
    const stationCounts: Record<string, number> = {};
    if (data.allRoutes) {
      data.allRoutes.forEach((item: RouteData) => {
        const [from, to] = item.route.split('-');
        if (from) {
          stationCounts[from] = (stationCounts[from] || 0) + item.count;
        }
        if (to) {
          stationCounts[to] = (stationCounts[to] || 0) + item.count;
        }
      });
    }
    
    // 转换为数组并排序
    const stationData = Object.entries(stationCounts).map(([station, count]) => ({
      station,
      count
    })).sort((a, b) => b.count - a.count);
    
    navigate('/stations', { 
      state: { 
        activeTab, 
        startDate, 
        endDate,
        stationData
      } 
    });
  };

  // 修改年份选择处理函数
  const handleYearSelect = (year: number) => {
    // 设置选择的年份
    setSelectedYear(year);
    
    // 设置选择的年份范围
    const firstDayOfYear = new Date(year, 0, 1);
    const lastDayOfYear = new Date(year, 11, 31);
    setStartDate(format(firstDayOfYear, 'yyyy-MM-dd'));
    setEndDate(format(lastDayOfYear, 'yyyy-MM-dd'));
  };
  
  // 处理筛选确认
  const handleFilterConfirm = () => {
    if (activeTab === 'train') {
      fetchTrainData();
    } else {
      fetchFlightData();
    }
    setFilterVisible(false);
  };
  
  // 处理筛选清空
  const handleFilterClear = () => {
    // 重置日期选择
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(format(firstDayOfMonth, 'yyyy-MM-dd'));
    setEndDate(format(today, 'yyyy-MM-dd'));
    setSelectedYear(null);
    setFilterVisible(false);
  };

  const renderTrendChart = () => {
    const data = getCurrentData();
    if (!data || !data.trendData || data.trendData.length === 0) {
      return <div className="no-data">暂无趋势数据</div>;
    }
    
    // 筛选出count不为0的数据点
    const filteredTrendData = data.trendData.filter(item => item.count > 0);
    
    // 没有任何有效数据
    if (filteredTrendData.length === 0) {
      return <div className="no-data">暂无趋势数据</div>;
    }
    
    // 计算最大值，用于设置刻度
    const maxCount = Math.max(...filteredTrendData.map(item => item.count));
    const maxExpense = Math.max(...filteredTrendData.map(item => item.expense));
    
    // 计算合适的刻度步长
    const countStep = Math.ceil(maxCount / 5);
    const expenseStep = Math.ceil(maxExpense / 5);
    
    const chartData = {
      labels: filteredTrendData.map(item => item.date),
      datasets: [
        {
          label: activeTab === 'train' ? '出行次数' : '飞行次数',
          data: filteredTrendData.map(item => item.count),
          borderColor: '#1890ff',
          backgroundColor: 'rgba(24, 144, 255, 0.2)',
          borderWidth: 2,
          pointBackgroundColor: '#1890ff',
          pointRadius: 2,
          pointHoverRadius: 2,
          tension: 0.2,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: '出行费用',
          data: filteredTrendData.map(item => item.expense),
          borderColor: '#52c41a',
          backgroundColor: 'rgba(82, 196, 26, 0.2)',
          borderWidth: 2,
          pointBackgroundColor: '#52c41a',
          pointRadius: 2,
          pointHoverRadius: 2,
          tension: 0.2,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#333',
          bodyColor: '#666',
          borderColor: '#ddd',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 4,
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                if (context.datasetIndex === 0) {
                  label += context.parsed.y + ' 次';
                } else {
                  label += '¥' + context.parsed.y.toFixed(2);
                }
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false,
          },
          ticks: {
            font: {
              size: 10,
            },
            color: '#999',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
          }
        },
        y: {
          type: 'linear' as const,
          display: false,
          position: 'left' as const,
          title: {
            display: false,
          },
          ticks: {
            display: true,
            stepSize: countStep,
            // 确保刻度线数量固定
            count: 6,
            font: {
              size: 10,
            },
            color: '#999',
            padding: 5,
          },
          grid: {
            display: false,
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false,
          },
          // 设置最小值为0，确保两个轴的起点一致
          min: 0,
          // 设置最大值，确保有足够的空间
          suggestedMax: maxCount * 1.1,
          border: {
            display: false,
          }
        },
        y1: {
          type: 'linear' as const,
          display: false,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false, // 只显示一组网格线
            drawBorder: false,
          },
          title: {
            display: false,
          },
          ticks: {
            display: true,
            stepSize: expenseStep,
            // 确保刻度线数量固定
            count: 6,
            font: {
              size: 10,
            },
            color: '#999',
            padding: 5,
          },
          // 设置最小值为0，确保两个轴的起点一致
          min: 0,
          // 设置最大值，确保有足够的空间
          suggestedMax: maxExpense * 1.1,
          // 确保与左侧Y轴对齐
          alignToPixels: true,
          border: {
            display: false,
          }
        },
      },
    };
    
    return (
      <div style={{ height: isMobileView ? '220px' : '300px' }}>
        <Line 
          data={chartData} 
          options={options} 
          plugins={[
            {
              id: 'countLabels',
              afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const meta = chart.getDatasetMeta(0); // 获取第一个数据集（出行次数）的元数据
                
                ctx.save();
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#1890ff';
                ctx.textAlign = 'center';
                
                meta.data.forEach((dataPoint, index) => {
                  const yPosition = dataPoint.y - 10; // 在点的上方10px处显示
                  const xPosition = dataPoint.x;
                  const value = chartData.datasets[0].data[index];
                  
                  // 在每个数据点上方绘制出行次数
                  ctx.fillText(value.toString(), xPosition, yPosition);
                });
                
                ctx.restore();
              }
            }
          ]}
        />
      </div>
    );
  };

  // 在renderTrendChart函数后添加车型统计模块渲染函数
  const renderVehicleTypeStats = () => {
    const data = getCurrentData();
    if (!data || !data.vehicleTypes || data.vehicleTypes.length === 0) {
      return <div className="no-data">暂无车型数据</div>;
    }
    
    // 计算总车型数量
    const totalVehicleTypes = data.vehicleTypes.length;
    
    // 只显示前4种车型
    const topVehicleTypes = data.vehicleTypes.slice(0, 4);
    
    // 导航到车型统计页面
    const navigateToVehicleTypeStats = () => {
      navigate('/vehicle-types', { 
        state: { 
          activeTab, 
          startDate, 
          endDate,
          vehicleTypesData: data.vehicleTypes  // 传递所有车型数据
        } 
      });
    };
    
    return (
      <>
        <div className="vehicle-stats-header">
          <h3><img src="/static2.svg" alt="统计" className="nav-icon2" />{activeTab === 'train' ? '乘坐车型' : '乘坐机型'}</h3>
          <div 
            className="vehicle-types-total clickable" 
            onClick={navigateToVehicleTypeStats}
          >
            共乘坐{totalVehicleTypes}种
            <span className="arrow-icon">›</span>
          </div>
        </div>
        <div className="vehicle-stats-grid">
          {topVehicleTypes.map((item, index) => (
            <div key={index} className="vehicle-stat-item">
              <div className="vehicle-type">{item.type}</div>
              <div className="vehicle-count">{item.count}次</div>
            </div>
          ))}
        </div>
      </>
    );
  };

  // 渲染统计卡片
  const renderStatCards = () => {
    const data = getCurrentData();
    if (!data) return null;
    
    // 计算去过最多的车站
    const stationCounts: Record<string, number> = {};
    if (data.allRoutes) {
      data.allRoutes.forEach((item: RouteData) => {
        const [from, to] = item.route.split('-');
        if (from) {
          stationCounts[from] = (stationCounts[from] || 0) + item.count;
        }
        if (to) {
          stationCounts[to] = (stationCounts[to] || 0) + item.count;
        }
      });
    }
    
    // 找出去过最多的车站
    let mostVisitedStation = '';
    let maxVisits = 0;
    Object.entries(stationCounts).forEach(([station, count]) => {
      if (count > maxVisits) {
        mostVisitedStation = station;
        maxVisits = count;
      }
    });
    
    return (
      <div className="stat-cards">
        <div className="stat-card clickable" onClick={navigateToStationStats}>
          <div className="stat-card-header">
            <div className="stat-card-title">车站</div>
            <div className="stat-card-value">{summary.totalStations}</div>
          </div>
          <div className="stat-card-footer">
            <div className="stat-card-label">去过最多</div>
            <div className="stat-card-highlight">
              {mostVisitedStation || (activeTab === 'train' ? '暂无数据' : '暂无数据')}
            </div>
          </div>

        </div>
        
        <div className="stat-card clickable" onClick={navigateToRouteStats}>
          <div className="stat-card-header">
            <div className="stat-card-title">路线</div>
            <div className="stat-card-value">{summary.totalRoutes}</div>
          </div>
          <div className="stat-card-footer">
            <div className="stat-card-label">坐过最多</div>
            <div className="stat-card-highlight">
              {data.routeData && data.routeData.length > 0 
                ? data.routeData[0].route 
                : (activeTab === 'train' ? '暂无数据' : '暂无数据')}
            </div>
          </div>
        </div>
        

      </div>
    );
  };

  if (loading) {
    return <div className="statistics-loading">加载统计数据中...</div>;
  }

  // 计算是否显示"更多"按钮
  const hasMoreYears = availableYears.length > 5;
  // 确定要显示的年份
  const displayedYears = showAllYears 
    ? availableYears 
    : availableYears.slice(Math.max(0, availableYears.length - 5));

  return (
    <div className={`statistics-container ${isMobileView ? 'mobile-view' : ''}`}>
      {/* 移动版页面标题 */}
      {isMobileView && (
        <div className="statistics-mobile-nav">
          <div className="mobile-statistics-header">
            <h1 className="mobile-statistics-title"><img src="/statistics.svg" alt="统计" className="nav-icon3" />行程统计</h1>
            {/* 添加筛选按钮 */}
            <div 
              className="filter-statistics-button" 
              onClick={() => setFilterVisible(true)}
            >
              筛选
              <span className="filter-statistics-arrow">▼</span>
            </div>
          </div>
        </div>
      )}

      {/* 非移动端导航区域 */}
      {!isMobileView && (
        <>
          <div className="statistics-tabs">
            <button 
              className={`tab-button ${activeTab === 'train' ? 'active' : ''}`}
              onClick={() => setActiveTab('train')}
            >
              火车票统计
            </button>
            <button 
              className={`tab-button ${activeTab === 'flight' ? 'active' : ''}`}
              onClick={() => setActiveTab('flight')}
            >
              飞机票统计
            </button>
            
            {/* 添加桌面视图下的筛选按钮 */}
            <div 
              className="filter-statistics-button desktop-filter-btn" 
              onClick={() => setFilterVisible(true)}
            >
              筛选
              <span className="filter-statistics-arrow">▼</span>
            </div>
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

      {/* TDesign 筛选弹出框 */}
      <FilterPopup
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        onConfirm={handleFilterConfirm}
        onClear={handleFilterClear}
      >
        {/* 票据类型选择 */}
        <div className="t-filter-section">
          <h4>票据类型</h4>
          <div className="t-filter-options">
            <div 
              className={`t-filter-option ${activeTab === 'train' ? 'active' : ''}`}
              onClick={() => setActiveTab('train')}
            >
              <div className="t-filter-option-text">火车票</div>
            </div>
            <div 
              className={`t-filter-option ${activeTab === 'flight' ? 'active' : ''}`}
              onClick={() => setActiveTab('flight')}
            >
              <div className="t-filter-option-text">飞机票</div>
            </div>
          </div>
        </div>
        
        {/* 年份选择 */}
        <div className="t-filter-section">
          <h4>年份</h4>
          <YearSelector 
            selectedYear={selectedYear}
            onYearSelect={handleYearSelect}
          />
        </div>
      </FilterPopup>

      <div className="statistics-charts">
        {/* 添加地图组件 */}
        {activeTab === 'train' && (
          <div className="map-chart-container">
            <StationsMap startDate={startDate} endDate={endDate} />
          </div>
        )}

        {/* 统计卡片 */}
        {renderStatCards()}

        {/* 趋势图表 */}
        <div className="trend-chart-container">
          <h3><img src="/static2.svg" alt="统计" className="nav-icon2" />旅行日历</h3>
          {renderTrendChart()}
        </div>
        
        {/* 车型/机型统计 */}
        <div className="vehicle-stats-container">
          {renderVehicleTypeStats()}
        </div>
      </div>
    </div>
  );
};

export default Statistics; 