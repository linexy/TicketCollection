import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { FloatButton } from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { Popup } from 'tdesign-mobile-react';
import TicketCard from './TicketCard';
import StationStops from './StationStops';
import '../styles/HomePage.css';
import '../styles/TicketList.css';

interface BaseTicket {
  id: number;
  ticketType: '火车票' | '飞机票';
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  distance: number;
  departureDate: string;
}

interface TrainTicket {
  id: number;
  trainNo: string;
  seatType: string;
  carNo: string;
  seatNo: string;
  orderNo: string;
  trainType?: string;
  checkingPort?: string;
  baseTicket: BaseTicket;
}

interface FlightTicket {
  id: number;
  ticketNo: string;
  flightType: string;
  airlineCompany: string;
  flightNo: string;
  mileage: number;
  baseTicket: BaseTicket;
}

interface HomePageProps {
  onAddTicket: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onAddTicket }) => {
  const [todayTickets, setTodayTickets] = useState<(TrainTicket | FlightTicket)[]>([]);
  const [upcomingTickets, setUpcomingTickets] = useState<(TrainTicket | FlightTicket)[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TrainTicket | FlightTicket | null>(null);
  const [selectedTicketForStops, setSelectedTicketForStops] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTickets();
    // 移除定时刷新任务，只在组件挂载时获取一次数据
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      
      // 添加缓存控制和超时设置
      const response = await axios.get('/api/tickets/upcoming', {
        headers: {
          'Cache-Control': 'max-age=1800', // 30分钟缓存
          'Pragma': 'no-cache'
        },
        timeout: 10000 // 10秒超时
      });
      
      // 确保response.data是数组
      const ticketsData = Array.isArray(response.data) ? response.data : [];
      
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // 使用更高效的方式处理数据
      const todayTicketsData = [];
      const upcomingTicketsData = [];
      
      // 一次遍历完成所有过滤，避免多次遍历
      for (const ticket of ticketsData) {
        const ticketDate = new Date(ticket.baseTicket.departureTime);
        const arrivalDate = new Date(ticket.baseTicket.arrivalTime);
        
        if (ticketDate >= today && ticketDate < tomorrow && arrivalDate > now) {
          todayTicketsData.push(ticket);
        } else if (ticketDate >= tomorrow) {
          upcomingTicketsData.push(ticket);
        }
      }
      
      // 数据已经从后端排序好，不需要再次排序
      // 如果确实需要排序，可以取消下面的注释
      /*
      todayTicketsData.sort((a, b) => 
        new Date(a.baseTicket.departureTime).getTime() - new Date(b.baseTicket.departureTime).getTime()
      );
      
      upcomingTicketsData.sort((a, b) => 
        new Date(a.baseTicket.departureTime).getTime() - new Date(b.baseTicket.departureTime).getTime()
      );
      */
      
      setTodayTickets(todayTicketsData);
      setUpcomingTickets(upcomingTicketsData);
    } catch (error) {
      console.error('获取车票失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 手动刷新数据
  const handleRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };



  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'MM-dd HH:mm');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    return `${month}月${day}日 周${weekDay}`;
  };

  // 判断票据类型的函数
  const isTrainTicket = (ticket: TrainTicket | FlightTicket): ticket is TrainTicket => {
    return 'trainNo' in ticket;
  };

  const isFlightTicket = (ticket: TrainTicket | FlightTicket): ticket is FlightTicket => {
    return 'flightNo' in ticket;
  };

  // 获取票据编号（火车票显示车次，飞机票显示航班号）
  const getTicketNumber = (ticket: TrainTicket | FlightTicket): string => {
    if (isTrainTicket(ticket)) {
      return ticket.trainNo;
    } else if (isFlightTicket(ticket)) {
      return ticket.flightNo;
    }
    return '';
  };

  // 获取座位信息
  const getSeatInfo = (ticket: TrainTicket | FlightTicket): string => {
    if (isTrainTicket(ticket)) {
      return `${ticket.seatType} ${ticket.carNo}车${ticket.seatNo}`;
    } else if (isFlightTicket(ticket)) {
      return ticket.flightType;
    }
    return '';
  };


  // 获取相对日期描述（今天、明天、后天或N天后）
  const getRelativeDateDesc = (dateString: string) => {
    const ticketDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 计算日期差异（天数）
    const diffTime = ticketDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '明天';
    } else if (diffDays === 2) {
      return '后天';
    } else if (diffDays > 2) {
      return `${diffDays}天后`;
    } else {
      // 对于过去的日期（不应该出现在待出行中）
      return '已过期';
    }
  };

  // 获取车型信息
  const getTrainType = (ticket: TrainTicket | FlightTicket): string => {
    if (isTrainTicket(ticket)) {
      // 直接使用trainType属性，如果存在的话
      return ticket.trainType || '';
    } else if (isFlightTicket(ticket)) {
      return ticket.flightType;
    }
    return '';
  };

  // 处理点击待出行项
  const handleUpcomingTicketClick = (ticket: TrainTicket | FlightTicket) => {
    if (isTrainTicket(ticket)) {
      setSelectedTicket(ticket);
    } else {
      // 对于飞机票，可以添加其他处理逻辑
    //  console.log('点击了飞机票:', ticket);
    }
  };

  // 处理点击车次
  const handleTrainNoClick = (ticketId: number) => {
    setSelectedTicketForStops(ticketId);
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <h1><img src="/myticket.svg" alt="车票" className="nav-icon3" />我的行程</h1>
      </div>
      
      {loading && !refreshing ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      ) : (
        <>
          {todayTickets.length > 0 && (
            <div className="today-tickets">
              <div className="today-tickets-header">
                <h2>今日行程
                  <button 
                    className="refresh-icon-button" 
                    onClick={handleRefresh} 
                    disabled={refreshing}
                    title="刷新"
                  >
                    <SyncOutlined spin={refreshing} />
                  </button>
                </h2>
              </div>
              <div className="today-ticket-cards">
                {todayTickets.map(ticket => (
                  isTrainTicket(ticket) && (
                    <div key={ticket.id} className="today-ticket-wrapper">
                      <TicketCard 
                        ticket={ticket} 
                        onClose={() => {}} // 空函数，因为这里不需要关闭功能
                        disableShare={false} // 禁用分享功能
                        onTrainNoClick={handleTrainNoClick} // 添加车次点击事件处理函数
                        onRefresh={handleRefreshTicket} // 添加刷新回调
                      />
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
          
          <div className="upcoming-tickets">
            <h2>待出行</h2>
            {upcomingTickets.length > 0 ? (
              <div className="upcoming-list">
                {upcomingTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    className="upcoming-ticket-item"
                    onClick={() => handleUpcomingTicketClick(ticket)}
                  >
                    <div className="upcoming-ticket-left">
                      <div className="upcoming-ticket-stations">
                        <span>{ticket.baseTicket.departureStation}</span>
                        <span className="arrow">→</span>
                        <span>{ticket.baseTicket.arrivalStation}</span>
                      </div>
                      <div className="upcoming-ticket-info">
                        {isTrainTicket(ticket) ? (
                          <>
                            <span>{ticket.trainNo}</span>
                            <span className="dot"></span>
                            <span>{formatTime(ticket.baseTicket.departureTime)}出发</span>
                          </>
                        ) : (
                          <>
                            <span>{ticket.flightNo}</span>
                            <span className="dot"></span>
                            <span>{formatTime(ticket.baseTicket.departureTime)}出发</span>
                          </>
                        )}
                      </div>
                      <div className="ticket-seat-info">
                        {getSeatInfo(ticket)}
                      </div>

                    </div>
                    <div className="upcoming-ticket-right">
                      <div className="upcoming-ticket-day">
                        {getRelativeDateDesc(ticket.baseTicket.departureTime)}
                      </div>
                      <div className="upcoming-ticket-type">
                        {getTrainType(ticket)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-tickets">
                <p>暂无待出行的行程</p>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* 使用Ant Design的FloatButton组件 */}
      <FloatButton
        type="primary"
        icon={<PlusOutlined />}
        onClick={onAddTicket}
        className="add-float-button"
      />
      
      {selectedTicket && isTrainTicket(selectedTicket) && (
        <Popup
          visible={!!selectedTicket}
          onVisibleChange={(visible) => !visible && setSelectedTicket(null)}
          placement="center"
          closeOnOverlayClick
          destroyOnClose
        >
          <div className="ticket-card-popup">
            <TicketCard 
              ticket={selectedTicket} 
              onClose={() => setSelectedTicket(null)} 
              onTrainNoClick={handleTrainNoClick}
              onRefresh={handleRefreshTicket}
            />
          </div>
        </Popup>
      )}
      
      {/* 添加StationStops组件 */}
      {selectedTicketForStops && (
        <StationStops
          ticketId={selectedTicketForStops}
          onClose={() => setSelectedTicketForStops(null)}
        />
      )}
    </div>
  );
};

export default HomePage; 