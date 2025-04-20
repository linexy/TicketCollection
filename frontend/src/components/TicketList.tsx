import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import '../styles/TicketList.css';
import { DatePicker, TimePicker, Button, Input, Select, Pagination, Segmented, Tabs } from 'antd';
import locale from 'antd/es/date-picker/locale/zh_CN';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'antd/dist/reset.css';
import { Toaster, toast } from 'react-hot-toast';
import { startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import 'dayjs/locale/zh-cn';  // 添加这行导入中文语言包
import TicketCard from './TicketCard';
import StationStops from './StationStops';
import { LoadingOutlined } from '@ant-design/icons';
import { subscribeToPush } from '../services/pushNotification';
import Statistics from './Statistics';
import { DatePicker as MobileDatePicker, InfiniteScroll, DotLoading } from 'antd-mobile';
import FilterPopup from './FilterPopup';
import YearSelector from './YearSelector';
import { Popup } from 'tdesign-mobile-react';

// 配置插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('zh-cn');  // 设置全局语言为中文

interface BaseTicket {
  id: number;
  ticketType: '火车票' | '飞机票';
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  distance: number;
}

interface TrainTicket {
  id: number;
  trainNo: string;
  seatType: string;
  carNo: string;
  seatNo: string;
  orderNo: string;
  trainType?: string;
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

interface Pagination {
  trainTotal: number;
  flightTotal: number;
  page: number;
  pageSize: number;
}

interface TicketsData {
  trainTickets: TrainTicket[];
  flightTickets: FlightTicket[];
  pagination: Pagination;
}

type TicketType = 'train' | 'flight' | 'statistics';

interface TicketListProps {
  isMobileView?: boolean;
  isModalOpen?: boolean;
  setIsModalOpen?: (isOpen: boolean) => void;
  onTabChange?: (tab: 'home' | 'history' | 'stats') => void;
}

const TicketList: React.FC<TicketListProps> = ({ 
  isMobileView = false, 
  isModalOpen: externalIsModalOpen, 
  setIsModalOpen: externalSetIsModalOpen,
  onTabChange
}) => {
  const [tickets, setTickets] = useState<TicketsData>({
    trainTickets: [],
    flightTickets: [],
    pagination: {
      trainTotal: 0,
      flightTotal: 0,
      page: 1,
      pageSize: 20
    }
  });
  const [internalIsModalOpen, setInternalIsModalOpen] = useState(false);
  const [ticketType, setTicketType] = useState<TicketType>('train');
  const [formData, setFormData] = useState({
    ticketType: 'train',
    departureStation: '',
    arrivalStation: '',
    departureTime: '',
    arrivalTime: '',
    departureDate: '',
    arrivalDate: '',
    price: '',
    trainNo: '',
    seatType: '二等座',
    carNo: '',
    seatNo: '',
    flightNo: '',
    airlineCompany: '',
    orderNo: '',
    ticketNo: ''
  });
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const now = new Date();
    return [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
    ];
  });
  const [displayType, setDisplayType] = useState<'train' | 'flight' | 'statistics'>('train');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();
  const [activeQuickDate, setActiveQuickDate] = useState<string>('currentMonth');
  const [totalPages, setTotalPages] = useState(0);
  const [statistics, setStatistics] = useState<any>({
    trainStats: null,
    flightStats: null
  });
  const [selectedTicket, setSelectedTicket] = useState<TrainTicket | null>(null);
  const [selectedTicketForStops, setSelectedTicketForStops] = useState<number | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'train' | 'flight' | 'statistics'>('train');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ticketCardVisible, setTicketCardVisible] = useState(false);

  // 使用外部或内部的modal状态
  const isModalOpenValue = externalIsModalOpen !== undefined ? externalIsModalOpen : internalIsModalOpen;
  const setIsModalOpenValue = externalSetIsModalOpen || setInternalIsModalOpen;

  // 增加筛选弹出框的状态
  const [filterVisible, setFilterVisible] = useState(false);
  // 增加选择的年份状态
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const adjustTimezone = (date: Date | null) => {
    if (!date) return null;
    const offset = date.getTimezoneOffset() * 60000; // 获取本地时区偏移（毫秒）
    return new Date(date.getTime() - offset);
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ticketType: displayType,
        ...(dateRange[0] && { 
          startDate: dayjs(dateRange[0])
            .startOf('day')
            .local()  // 使用本地时间
            .format('YYYY-MM-DD[T]00:00:00.000')  // 直接使用00:00:00
        }),
        ...(dateRange[1] && { 
          endDate: dayjs(dateRange[1])
            .endOf('day')
            .local()  // 使用本地时间
            .format('YYYY-MM-DD[T]23:59:59.999')  // 直接使用23:59:59
        })
      });

      const response = await axios.get(`/api/tickets?${params}`);
      if (response.data.success) {
        if (isMobileView && currentPage > 1) {
          // 对于移动端的无限滚动，追加数据
          setTickets(prevTickets => ({
            trainTickets: displayType === 'train' 
              ? [...prevTickets.trainTickets, ...(response.data.data.trainTickets || [])]
              : prevTickets.trainTickets,
            flightTickets: displayType === 'flight'
              ? [...prevTickets.flightTickets, ...(response.data.data.flightTickets || [])]
              : prevTickets.flightTickets,
            pagination: response.data.data.pagination || {
              trainTotal: 0,
              flightTotal: 0,
              page: currentPage,
              pageSize: 20
            }
          }));
        } else {
          // 对于PC端或首次加载，直接替换数据
        setTickets({
          trainTickets: response.data.data.trainTickets || [],
          flightTickets: response.data.data.flightTickets || [],
          pagination: response.data.data.pagination || {
            trainTotal: 0,
            flightTotal: 0,
            page: 1,
            pageSize: 20
          }
        });
        }
        
        // 检查是否还有更多数据
        const total = displayType === 'train' 
          ? response.data.data.pagination?.trainTotal || 0
          : response.data.data.pagination?.flightTotal || 0;
        
        setHasMore(currentPage * pageSize < total);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('获取票据失败:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams({
        ticketType: displayType,
        ...(dateRange[0] && { 
          startDate: dayjs(dateRange[0])
            .startOf('day')
            .local()  // 使用本地时间
            .format('YYYY-MM-DD[T]00:00:00.000')  // 直接使用00:00:00
        }),
        ...(dateRange[1] && { 
          endDate: dayjs(dateRange[1])
            .endOf('day')
            .local()  // 使用本地时间
            .format('YYYY-MM-DD[T]23:59:59.999')  // 直接使用23:59:59
        })
      });

      // 首先获取所有票据数据用于统计（不分页）
      const allTicketsParams = new URLSearchParams(params);
      allTicketsParams.append('pageSize', '10000'); // 设置一个足够大的页码来获取所有数据
      allTicketsParams.append('page', '1');
      
      // 获取所有票据数据用于计算总时长和总里程
      const allTicketsResponse = await axios.get(`/api/tickets?${allTicketsParams}`);
      
      // 获取常规统计数据
      const response = await axios.get(`/api/tickets/statistics?${params}`);
      
      if (response.data.success) {
        const statsData = response.data.data;
       // console.log('获取的统计数据:', statsData); // 添加日志以调试
        
        // 如果API没有返回时长和里程统计，从获取的所有票据中计算
        if (allTicketsResponse.data.success) {
          const allTrainTickets = allTicketsResponse.data.data.trainTickets || [];
          const allFlightTickets = allTicketsResponse.data.data.flightTickets || [];
          
          // 计算总时长（分钟）
          let trainTotalDuration = 0;
          let flightTotalDuration = 0;
          
          // 计算总里程
          let trainTotalDistance = 0;
          let flightTotalDistance = 0;
          
          // 计算火车票统计
          allTrainTickets.forEach((ticket: TrainTicket) => {
            const departureTime = new Date(ticket.baseTicket.departureTime);
            const arrivalTime = new Date(ticket.baseTicket.arrivalTime);
            const durationMs = arrivalTime.getTime() - departureTime.getTime();
            const durationMinutes = Math.floor(durationMs / (1000 * 60));
            
            trainTotalDuration += durationMinutes;
            trainTotalDistance += ticket.baseTicket.distance || 0;
          });
          
          // 计算飞机票统计
          allFlightTickets.forEach((ticket: FlightTicket) => {
            const departureTime = new Date(ticket.baseTicket.departureTime);
            const arrivalTime = new Date(ticket.baseTicket.arrivalTime);
            const durationMs = arrivalTime.getTime() - departureTime.getTime();
            const durationMinutes = Math.floor(durationMs / (1000 * 60));
            
            flightTotalDuration += durationMinutes;
            flightTotalDistance += ticket.baseTicket.distance || 0;
          });
          
          // 为统计数据添加计算的时长和里程
          if (statsData.trainStats) {
            statsData.trainStats.totalDuration = trainTotalDuration;
            statsData.trainStats.totalDistance = trainTotalDistance;
          }
          
          if (statsData.flightStats) {
            statsData.flightStats.totalDuration = flightTotalDuration;
            statsData.flightStats.totalDistance = flightTotalDistance;
          }
        }
        
        setStatistics(statsData);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStatistics(); // 确保在筛选条件变化时同时更新统计数据
  }, [currentPage, dateRange, displayType]);

  // 组件初始化时，如果是移动端，自动设置为全部日期范围
  useEffect(() => {
    if (isMobileView) {
      // 设置日期范围为全部
      const start = new Date(2013, 3, 1); // 2013年4月1日
      const end = endOfMonth(new Date()); // 当前月的最后一天
      setDateRange([start, end]);
      setActiveQuickDate('all');
    }
  }, [isMobileView]);

  useEffect(() => {
    // 请求拦截器
    axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
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
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );
  }, [navigate]);

  useEffect(() => {
    const checkAndSubscribe = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
    //    console.log('用户未登录，跳过订阅');
        return;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    //    console.log('浏览器不支持推送通知');
        return;
      }

      try {
        let permission = Notification.permission;
     //   console.log('Current notification permission:', permission);

        if (permission === 'default') {
      //    console.log('Requesting notification permission...');
          permission = await Notification.requestPermission();
      //    console.log('Permission result:', permission);
        }

        if (permission === 'granted') {
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
          });
        //  console.log('Service Worker registered');
          
          await navigator.serviceWorker.ready;
        //  console.log('Service Worker ready');

          const subscription = await registration.pushManager.getSubscription();
         // console.log('Current subscription:', subscription);

          if (!subscription) {
         //   console.log('No subscription found, creating new one...');
            const success = await subscribeToPush();
            if (success) {
              toast.success('推送通知已开启');
            } else {
              toast.error('推送通知开启失败');
            }
          } else {
        //    console.log('Existing subscription found');
          }
        } else if (permission === 'denied') {
          toast.error('请在浏览器设置中允许通知权限');
        }
      } catch (error) {
        console.error('检查推送订阅失败:', error);
        toast.error('设置推送通知失败');
      }
    };

    // 页面加载和用户登录后都检查订阅
    checkAndSubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      ticketType: 'train',
      departureStation: '',
      arrivalStation: '',
      departureTime: '',
      arrivalTime: '',
      departureDate: '',
      arrivalDate: '',
      price: '',
      trainNo: '',
      seatType: '二等座',
      carNo: '',
      seatNo: '',
      flightNo: '',
      airlineCompany: '',
      orderNo: '',
      ticketNo: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ticketData = {
        ...formData,
        price: Number(formData.price),
        baseTicket: {
          ticketType: ticketType === 'train' ? '火车票' : '飞机票',
          departureStation: formData.departureStation,
          arrivalStation: formData.arrivalStation,
          departureTime: formData.departureTime,
          arrivalTime: formData.arrivalTime,
          price: Number(formData.price)
        }
      };

      const endpoint = ticketType === 'train' ? '/api/tickets/train' : '/api/tickets/flight';
      await axios.post(endpoint, ticketData);
      
      await fetchTickets();
      resetForm();
      toast.success('添加成功');
      
    } catch (error: any) {
    //  console.error('添加票据失败:', error);
      const errorMessage = error.response?.data?.message || error.message || '未知错误';
      toast.error('添加失败：' + errorMessage);
    }
  };

  const handleSwapStations = () => {
    setFormData(prev => ({
      ...prev,
      departureStation: prev.arrivalStation,
      arrivalStation: prev.departureStation
    }));
  };

  const getStatistics = () => {
    if (displayType === 'train' && statistics.trainStats) {
      return statistics.trainStats;
    } else if (displayType === 'flight' && statistics.flightStats) {
      return statistics.flightStats;
    }
    return {
      totalTickets: 0,
      uniqueTrains: 0,
      uniqueFlights: 0,
      totalPrice: 0,
      uniqueStations: 0
    };
  };

  const parseExcelDate = (dateStr: string) => {
    if (!dateStr) return undefined;
    
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // 不再添加8小时，直接返回ISO字符串
        return date.toISOString();
      }
      return undefined;
    } catch (error) {
    //  console.error('日期解析错误:', error);
      return undefined;
    }
  };

  const parseArrivalTime = (dateValue: any) => {
    try {
      // 如果是Excel日期数值
      if (typeof dateValue === 'number') {
        // 将Excel日期数值转换为JavaScript日期
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        return date.toISOString();
      }
      // 如果是字符串
      if (typeof dateValue === 'string') {
        const cleanStr = dateValue.replace(/[年月日]/g, '-').replace(/\s+/g, ' ').trim();
        const date = new Date(cleanStr);
        return date.toISOString();
      }
      // 如果已经是Date对象
      if (dateValue instanceof Date) {
        return dateValue.toISOString();
      }
      throw new Error('无效的日期格式');
    } catch (error) {
     // console.error('日期解析错误:', error, dateValue);
      throw new Error(`日期格式错误: ${dateValue}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            dateNF: 'yyyy-mm-dd hh:mm:ss'
          });

          console.log('Excel数据:', jsonData);

          for (const row of jsonData as Record<string, any>[]) {
            console.log('处理行数据:', row);
            
            // 根据票据类型构建不同的数据对象
    if (displayType === 'train') {
              const trainTicket = {
                departureStation: row['出发站'] || row['departureStation'] || '',
                arrivalStation: row['到达站'] || row['arrivalStation'] || '',
                departureTime: parseExcelDate(row['出发时间'] || row['departureTime']) || new Date().toISOString(),
                arrivalTime: parseExcelDate(row['到达时间'] || row['arrivalTime']),
                price: parseFloat((row['票价'] || row['price'] || '0').toString()),
                trainNo: row['车次'] || row['trainNo'] || '',
                seatType: row['座位类型'] || row['seatType'] || '',
                carNo: row['车厢号'] || row['carNo'] || '',
                seatNo: row['座位号'] || row['seatNo'] || '',
                orderNo: row['订单号'] || row['orderNo'] || ''
              };
              await axios.post('/api/tickets/train', trainTicket);
    } else {
              const flightTicket = {
                departure: row['出发站'] || row['departureStation'] || '',
                destination: row['到达站'] || row['arrivalStation'] || '',
                takeoffTime: parseExcelDate(row['出发时间'] || row['departureTime']) || new Date().toISOString(),
                arrivalTime: parseExcelDate(row['到达时间'] || row['arrivalTime']),
                price: parseFloat((row['票价'] || row['price'] || '0').toString()),
                flightNo: row['航班号'] || row['flightNo'] || '',
                airlineCompany: row['航空公司'] || row['airlineCompany'] || '',
                ticketNo: row['订单号'] || row['ticketNo'] || '',
                flightType: row['飞机类型'] || row['flightType'] || '',
                mileage: parseInt(row['里程'] || row['mileage'] || '0')
              };
              await axios.post('/api/tickets/flight', flightTicket);
            }
          }
          
          toast.success('导入成功');
          fetchTickets();
        } catch (error: any) {
          console.error('处理Excel数据失败:', error);
          toast.error(error.message || '处理Excel数据失败');
        }
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error('文件上传失败:', error);
      toast.error(error.message || '文件上传失败');
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        ticketType: '火车票/飞机票',
        departureStation: '出发站',
        arrivalStation: '到站',
        departureTime: '2024-03-21 14:30',
        arrivalTime: '2024-03-21 16:30',
        price: '100',
        trainNo: '车次(火车票填写，如：G1234)',
        seatType: '座位类型(火车票填写，如：一等座)',
        carNo: '车厢号(火车票填写，如：1)',
        seatNo: '座位号(火车票填写，如：1A)',
        flightNo: '航班号(飞机票填写，如：MU2331)',
        airlineCompany: '航空公司(飞机票填写)',
        flightType: '飞机类型(飞机票填写，如：波音737)',
        orderNo: '订单号(火车票填写)',
        ticketNo: '机票号(飞机票填写)'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, '票据导入模板.xlsx');
  };

  const handleFilter = () => {
    // 重置当前页为第1页
    setCurrentPage(1);
    fetchTickets();
  };

  const setQuickDateRange = (range: 'currentMonth' | 'lastMonth' | 'currentYear' | 'lastYear' | 'all') => {
    setActiveQuickDate(range as any);
    
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
        // 修正去年的时间范围，应该是去年的1月1日到12月31日
        const lastYear = dayjs().tz('Asia/Shanghai').subtract(1, 'year').year();
        const startDateLastYear = dayjs().tz('Asia/Shanghai').year(lastYear).startOf('year');
        const endDateLastYear = dayjs().tz('Asia/Shanghai').year(lastYear).endOf('year');
        start = startDateLastYear.toDate();
        end = endDateLastYear.toDate();
        break;
      case 'all':
        // 全部数据，设置为实际数据开始的日期
        start = new Date(2013, 3, 1); // 2013年4月1日
        end = endOfMonth(new Date()); // 当前月的最后一天
        break;
    }
    
    setDateRange([start, end]);
    setStartDate(start ? format(start, 'yyyy-MM-dd') : '');
    setEndDate(end ? format(end, 'yyyy-MM-dd') : '');
    // 重置当前页为第1页
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const getTotalCount = () => {
    if (!tickets?.pagination) return 0;
    return displayType === 'train' 
      ? (tickets.pagination.trainTotal || 0) 
      : (tickets.pagination.flightTotal || 0);
  };

  const handlePickerOpen = () => {
    // 禁用页面滚动，但使用更现代的方法
    document.body.classList.add('picker-open');
    // 保存当前滚动位置
    document.body.dataset.scrollY = window.scrollY.toString();
  };

  const handlePickerClose = () => {
    // 恢复页面滚动
    document.body.classList.remove('picker-open');
    // 恢复滚动位置
    const scrollY = document.body.dataset.scrollY || '0';
    window.scrollTo(0, parseInt(scrollY));
  };

  // 在组件卸载时清理
  useEffect(() => {
    return () => {
      document.body.classList.remove('picker-open');
      document.body.classList.remove('modal-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleOcrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsOcrLoading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      // 将图片转换为 base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const base64Image = (reader.result as string).split(',')[1];
          
          // 调用后端OCR接口
          const response = await axios.post('/api/ocr/recognize', {
            image: base64Image
          });

          if (response.data.success) {
            const parsedResult = response.data.data.parsed_result;
            
            // 设置表单数据
            setFormData({
              ...formData,
              ticketType: 'train',
              departureStation: parsedResult.departureStation,
              arrivalStation: parsedResult.arrivalStation,
              departureTime: parsedResult.departureTime,  // 已经包含完整的日期时间
              arrivalTime: parsedResult.arrivalTime,      // 已经包含完整的日期时间
              price: parsedResult.price,
              trainNo: parsedResult.trainNo,
              seatType: parsedResult.seatType,
              carNo: parsedResult.carNo,
              seatNo: parsedResult.seatNo,
              orderNo: parsedResult.orderNo
            });
            
            // 打开添加票据模态框
            setIsModalOpenValue(true);
            toast.success('OCR 识别成功');
          }
        } catch (error: any) {
          console.error('OCR 识别失败:', error);
          toast.error('OCR 识别失败: ' + (error.response?.data?.message || error.message));
        }
      };
    } catch (error: any) {
      console.error('文件处理失败:', error);
      toast.error('文件处理失败: ' + error.message);
    } finally {
      setIsOcrLoading(false);
    }
  };

  const isToday = (date: string) => {
    const today = dayjs().format('YYYY-MM-DD');
    return dayjs(date).format('YYYY-MM-DD') === today;
  };

  // 判断车票是否已出行（出发时间是否已过）
  const isCompleted = (departureTime: string) => {
    const now = new Date();
    const departure = new Date(departureTime);
    return departure < now;
  };

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    setDateRange(dates);
    setStartDate(dates[0] ? format(dates[0], 'yyyy-MM-dd') : '');
    setEndDate(dates[1] ? format(dates[1], 'yyyy-MM-dd') : '');
    // 重置当前页为第1页
    setCurrentPage(1);
  };

  const loadMore = async () => {
    if (loading || !hasMore) return;
    
    // 增加页码
    setCurrentPage(prev => prev + 1);
  };

  // 修改displayType时重置页码和数据
  useEffect(() => {
    if (isMobileView) {
      setCurrentPage(1);
      setHasMore(true);
      setTickets({
        trainTickets: [],
        flightTickets: [],
        pagination: {
          trainTotal: 0,
          flightTotal: 0,
          page: 1,
          pageSize: 20
        }
      });
    }
  }, [displayType, isMobileView]);

  // 修改年份选择处理函数
  const handleYearSelect = (year: number) => {
    // 设置选择的年份
    setSelectedYear(year);
    
    // 设置选择的年份范围
    const startDate = new Date(year, 0, 1); // 年份开始日期
    const endDate = new Date(year, 11, 31); // 年份结束日期
    setDateRange([startDate, endDate]);
  };
  
  // 处理筛选确认
  const handleFilterConfirm = () => {
    // 应用筛选
    setCurrentPage(1);
    setTickets({
      trainTickets: [],
      flightTickets: [],
      pagination: {
        trainTotal: 0,
        flightTotal: 0,
        page: 1,
        pageSize: pageSize
      }
    });
    setHasMore(true);
    fetchTickets();
    setFilterVisible(false);
  };
  
  // 处理筛选清空
  const handleFilterClear = () => {
    // 清空已选择的年份条件
    setDateRange([null, null]);
    setSelectedYear(null);
    setFilterVisible(false);
  };

  const handleTrainNoClick = (ticket: TrainTicket | FlightTicket) => {
    setSelectedTicket(ticket as TrainTicket);
    setTicketCardVisible(true);
  };

  return (
    <div className={`ticket-container ${isMobileView ? 'mobile-view' : ''}`}>
      {/* 移动端导航区域 - 放在顶部 */}
      {isMobileView && (
        <div className="ticket-mobile-nav">
          {/* 顶部标题 */}
          <div className="mobile-header">
            <h1 className="mobile-title"><img src="/ticketlist.svg" alt="历史" className="nav-icon3" />历史车票</h1>
          </div>
          
          {/* 红色框内的统计信息区域 */}
          <div className="mobile-statistics-summary">
            <div className="mobile-stat-item">
              <div className="mobile-stat-value">
                {(() => {
                  // 累计次数
                  const trainTotal = statistics.trainStats?.totalTickets || 0;
                  const flightTotal = statistics.flightStats?.totalTickets || 0;
                  return trainTotal + flightTotal;
                })()} 次
              </div>
              <div className="mobile-stat-label">累计次数</div>
            </div>
            <div className="mobile-stat-item">
              <div className="mobile-stat-value">
                {(() => {
                  // 累计时长 - 使用API返回的统计数据
                  const trainDuration = statistics.trainStats?.totalDuration || 0; // 分钟
                  const flightDuration = statistics.flightStats?.totalDuration || 0; // 分钟
                  
                  // 计算总小时和分钟
                  const totalMinutes = trainDuration + flightDuration;
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  
                  return `${hours} h ${minutes} min`;
                })()}
              </div>
              <div className="mobile-stat-label">累计时长</div>
            </div>
            <div className="mobile-stat-item">
              <div className="mobile-stat-value">
                {(() => {
                  // 累计里程 - 使用API返回的统计数据
                  const trainDistance = statistics.trainStats?.totalDistance || 0;
                  const flightDistance = statistics.flightStats?.totalDistance || 0;
                  
                  const totalDistance = trainDistance + flightDistance;
                  return `${Math.round(totalDistance)} km`;
                })()}
              </div>
              <div className="mobile-stat-label">累计里程</div>
            </div>
          </div>
          
          {/* 更多统计数据链接 */}
          <div className="more-statistics">
            <a onClick={() => {
              // 在移动视图中，切换到统计标签
              if (isMobileView && onTabChange) {
                // 使用传入的标签切换函数
                onTabChange('stats');
              } else {
                // 在PC视图中，直接切换显示类型
                setDisplayType('statistics');
                // 滚动到页面顶部
                window.scrollTo(0, 0);
              }
            }}>更多统计数据</a>
          </div>
          
          {/* 分隔线 */}
          <div className="mobile-divider"></div>
          
          {/* 筛选按钮区域 - 修改为文字描述 */}
          <div 
            className="filter-text-button" 
            onClick={() => setFilterVisible(true)}
          >
            筛选
            <span className="filter-down-arrow">▼</span>
          </div>
          
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
                  className={`t-filter-option ${displayType === 'train' ? 'active' : ''}`}
                  onClick={() => setDisplayType('train')}
                >
                  <div className="t-filter-option-text">火车票</div>
                </div>
                <div 
                  className={`t-filter-option ${displayType === 'flight' ? 'active' : ''}`}
                  onClick={() => setDisplayType('flight')}
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
          
          {/* 不再需要的原始筛选弹窗代码可以移除 */}
        </div>
      )}

      {/* 如果是移动视图，隐藏一些元素或调整布局 */}
      {!isMobileView && (
        <div className="ticket-list-header">
          <h1>车票管理系统</h1>
          <div className="ticket-type-switch">
            <button
              className={`switch-button ${ticketType === 'train' ? 'active' : ''}`}
              onClick={() => setTicketType('train')}
            >
              火车票
            </button>
            <button
              className={`switch-button ${ticketType === 'flight' ? 'active' : ''}`}
              onClick={() => setTicketType('flight')}
            >
              飞机票
            </button>
          </div>
        </div>
      )}

      {/* 修改原来的导航区域，只在非移动端显示 */}
      {!isMobileView && (
        <div className="date-range-filter">
          <div className="ticket-type-switch">
            <Segmented
              value={displayType}
              onChange={(value) => {
                setDisplayType(value as 'train' | 'flight');
                setCurrentPage(1);
              }}
              options={[
                {
                  label: (
                    <div className="segmented-item">
                      <img src="/train.svg" alt="火车" className="nav-icon2" />
                      <span>火车票</span>
                    </div>
                  ),
                  value: 'train'
                },
                {
                  label: (
                    <div className="segmented-item">
                      <img src="/plane.svg" alt="飞机" className="nav-icon2" />
                      <span>飞机票</span>
                    </div>
                  ),
                  value: 'flight'
                },
                {
                  label: (
                    <div className="segmented-item">
                      <img src="/static.svg" alt="统计" className="nav-icon2" />
                      <span>统计</span>
                    </div>
                  ),
                  value: 'statistics'
                }
              ]}
            />
          </div>

          <div className="filter-buttons">
            <div className="quick-date-buttons">
              <Segmented
                value={activeQuickDate}
                onChange={(value) => setQuickDateRange(value as 'currentMonth' | 'lastMonth' | 'currentYear' | 'lastYear' | 'all')}
                options={[
                  {
                    label: '本月',
                    value: 'currentMonth'
                  },
                  {
                    label: '上月',
                    value: 'lastMonth'
                  },
                  {
                    label: '今年',
                    value: 'currentYear'
                  },
                  {
                    label: '去年',
                    value: 'lastYear'
                  },
                  {
                    label: '全部',
                    value: 'all'
                  }
                ]}
              />
            </div>
            <div className="custom-date-range">
              <DatePicker.RangePicker
                picker="month"
                locale={locale}
                value={[
                  dateRange[0] ? dayjs(dateRange[0]).tz('Asia/Shanghai') : null,
                  dateRange[1] ? dayjs(dateRange[1]).tz('Asia/Shanghai') : null
                ]}
                onChange={(dates) => {
                  if (dates) {
                    const startDate = dates[0]?.startOf('month');
                    const endDate = dates[1]?.endOf('month');
                    
                    setDateRange([
                      startDate ? startDate.toDate() : null,
                      endDate ? endDate.toDate() : null
                    ]);
                    setActiveQuickDate('');
                  } else {
                    setDateRange([null, null]);
                  }
                }}
              />
            </div>
            <button className="add-button" onClick={() => setIsModalOpenValue(true)}>
              添加
            </button>
          </div>
        </div>
      )}

      {displayType === 'train' && (
        <>
          {isMobileView ? (
            <div className="mobile-ticket-list">
              <div className="timeline-container">
                <div className="timeline-line"></div>
                <div className="timeline-items">
                  {/* 按日期分组显示车票 */}
                  {(() => {
                    // 按日期分组
                    const groupedTickets: { [key: string]: TrainTicket[] } = {};
                    
                    tickets.trainTickets.forEach((ticket: TrainTicket) => {
                      const departureDate = format(new Date(ticket.baseTicket.departureTime), 'yyyy-MM-dd');
                      if (!groupedTickets[departureDate]) {
                        groupedTickets[departureDate] = [];
                      }
                      groupedTickets[departureDate].push(ticket);
                    });
                    
                    // 按日期排序（从新到旧）
                    const sortedDates = Object.keys(groupedTickets).sort((a, b) => 
                      new Date(b).getTime() - new Date(a).getTime()
                    );
                    
                    return sortedDates.map(date => {
                      const dateObj = new Date(date);
                      const month = format(dateObj, 'MM');
                      const day = format(dateObj, 'dd');
                      const year = format(dateObj, 'yyyy');
                      
                      return (
                        <div key={date} className="timeline-item">
                          <div className="timeline-date-section">
                            <div className="timeline-date">
                              <div className="timeline-month-day">
                                <span className="timeline-month">{month}-{day}</span>

                              </div>
                              <div className="timeline-year">{year}</div>
                            </div>
                            <div className="timeline-dot"></div>
                          </div>
                          <div className="timeline-content">
                            {groupedTickets[date].map((ticket: TrainTicket) => (
                              <div 
                                key={ticket.id} 
                                className={`mobile-ticket-item ${isToday(ticket.baseTicket.departureTime) ? 'today-ticket' : ''}`}
                                onClick={() => handleTrainNoClick(ticket)}
                              >
                                <div className="mobile-ticket-header">
                                  <div className="mobile-ticket-number">
                                    <img 
                                      src={isCompleted(ticket.baseTicket.departureTime) ? '/trained.svg' : '/training.svg'} 
                                      alt={isCompleted(ticket.baseTicket.departureTime) ? '已出行' : '待出行'} 
                                      className="travel-status-icon"
                                    />
                                    <span className="mobile-train-no">{ticket.trainNo}</span>
                                    {ticket.trainType && <span className="mobile-train-type">{ticket.trainType}</span>}
                                  </div>
                                  <div className="mobile-ticket-price">¥{ticket.baseTicket.price}</div>
                                </div>
                                <div className="mobile-ticket-stations">
                                  <div className="mobile-station-info">
                                    <div className="mobile-station-name">{ticket.baseTicket.departureStation}</div>
                                    <div className="mobile-station-time">{format(new Date(ticket.baseTicket.departureTime), 'HH:mm')}</div>
                                  </div>
                                  <div className="mobile-journey-path">
                                    <div className="journey-line"></div>
                                    <div className="journey-icon">
                                      <svg className="train-icon" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M888.70718383 497.97439575L693.36257935 290.8420105c-0.05767822-0.06097412-0.12112427-0.11370849-0.17962647-0.17385864-0.22329712-0.23236084-0.46142578-0.44824219-0.6979065-0.66741944-0.19445801-0.18127442-0.38726807-0.36584473-0.58996581-0.53393554-0.22412109-0.18951416-0.46142578-0.36337281-0.69543458-0.54299927-0.22906494-0.17303467-0.45318604-0.35266113-0.68966674-0.51580811-0.22412109-0.1557312-0.46142578-0.29251099-0.69296265-0.43753052-0.25543213-0.15820313-0.50592041-0.3213501-0.76629639-0.46636962-0.24307251-0.13430786-0.49273682-0.24719239-0.7432251-0.37078858-0.26119995-0.12936401-0.51910401-0.26367188-0.78771972-0.37985229-0.26861573-0.11535645-0.54794312-0.21340942-0.82397461-0.31640625-0.25543213-0.09475708-0.50921631-0.19775391-0.76959229-0.28179932-0.28427124-0.09228516-0.57925415-0.16314697-0.86929321-0.23895264-0.26367188-0.06921386-0.52404785-0.14584351-0.79101562-0.20352172-0.27603149-0.06015015-0.55783081-0.09970093-0.83963013-0.14749146-0.29498291-0.04696656-0.5874939-0.09970093-0.88165283-0.13430786-0.2562561-0.02883911-0.51745606-0.04202271-0.77453613-0.06015015a17.7121582 17.7121582 0 0 0-0.98876953-0.05026245c-0.08157349 0-0.15737915-0.01318359-0.23895265-0.01318359H113.45254516a17.61657715 17.61657715 0 0 0-17.61740112 17.61657715v366.02352905a17.61657715 17.61657715 0 0 0 13.89550781 17.21694947 17.52758789 17.52758789 0 0 0 9.70147706 2.91851806h707.08886718c58.28878784 0 105.70687867-47.41973877 105.70687867-105.70687866 0-35.05187989-17.16668701-66.15939331-43.52233887-85.40167237z m-166.17672729-20.30191039H606.75708008V379.51568604h118.29226685c1.10165406 0 2.17364502-0.11370849 3.21926879-0.30816651l92.86193848 98.46496583H722.53045654z m103.99136353 176.1781311H131.07077026V320.54711914h541.87124635l22.38244628 23.73046875h-106.18560791a17.61657715 17.61657715 0 0 0-17.61657715 17.6182251v133.39160156a17.61657715 17.61657715 0 0 0 17.61657715 17.61657716h237.38296509a70.06091309 70.06091309 0 0 1 38.93609619 11.76965331l0.29992676 0.31887818a17.52511597 17.52511597 0 0 0 5.33688354 3.84631347c15.79724121 12.93310547 25.89916992 32.57666016 25.89916992 54.53723145 0 38.86193848-31.61590576 70.47454834-70.47207641 70.47454834z" fill="currentColor" p-id="15100"></path>
                                        <path d="M322.54251146 390.20526924H202.97205647a15.79097248 15.79097248 0 0 0-15.79171109 15.79171109v119.56823926a15.79097248 15.79097248 0 0 0 15.79097251 15.79097247H322.5402957a15.79097248 15.79097248 0 0 0 15.79097251-15.79097247V405.99624175a15.78654095 15.78654095 0 0 0-15.78875677-15.79097251z m-15.79392683 119.56823925H218.76302897V421.7886914H306.74932322v87.98481708zM503.02416859 390.20526924h-119.56971641a15.79097248 15.79097248 0 0 0-15.79244967 15.79171109v119.56823926a15.79097248 15.79097248 0 0 0 15.79171108 15.79097247h119.56823924a15.79097248 15.79097248 0 0 0 15.79171109-15.79097247V405.99624175a15.78654095 15.78654095 0 0 0-15.78949533-15.79097251zM487.23024175 509.77350849H399.24542466V421.7886914H487.23024175v87.98481708zM765.44088341 726.35356509H132.43116772a15.79097248 15.79097248 0 1 0 0 31.58342216H765.44088341a15.79097248 15.79097248 0 1 0 0-31.58342216z" fill="currentColor" p-id="15101"></path>
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="mobile-station-info">
                                    <div className="mobile-station-name">{ticket.baseTicket.arrivalStation}</div>
                                    <div className="mobile-station-time">{format(new Date(ticket.baseTicket.arrivalTime), 'HH:mm')}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <InfiniteScroll loadMore={loadMore} hasMore={hasMore}>
                  {loading ? (
                    <div className="infinite-loading">
                      <span>加载中</span>
                      <DotLoading />
                    </div>
                  ) : hasMore ? (
                    <span>上拉加载更多</span>
                  ) : (
                    <span>没有更多了</span>
                  )}
                </InfiniteScroll>
              </div>
            </div>
          ) : (
        <>
          <table className="ticket-table train-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>车次</th>
                <th>车型</th>
                <th>出发</th>
                <th>到达</th>
                <th>里程</th>
                <th>出发时间</th>
                <th className="arrival-time">到达时间</th>
                <th>座位</th>
                <th>票价</th>
              </tr>
            </thead>
            <tbody>
              {tickets.trainTickets.map((ticket: TrainTicket, index: number) => (
                <tr 
                  key={ticket.id} 
                  className={isToday(ticket.baseTicket.departureTime) ? 'today-ticket' : ''}
                >
                  <td>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td>
                    <img 
                      src={isCompleted(ticket.baseTicket.departureTime) ? '/trained.svg' : '/training.svg'} 
                      alt={isCompleted(ticket.baseTicket.departureTime) ? '已出行' : '待出行'} 
                      className="travel-status-icon"
                      title={isCompleted(ticket.baseTicket.departureTime) ? '已出行' : '待出行'}
                    />
                    <span 
                      className="clickable-train-no"
                      onClick={() => handleTrainNoClick(ticket)}
                    >
                      {ticket.trainNo}
                    </span>
                  </td>
                  <td>{ticket.trainType || '-'}</td>
                  <td>
                    <span 
                      className="clickable-station-name"
                      onClick={() => setSelectedTicketForStops(ticket.id)}
                    >
                      {ticket.baseTicket.departureStation}

                    </span>
                  </td>
                  <td>{ticket.baseTicket.arrivalStation}</td>
                  <td>{ticket.baseTicket.distance ? `${ticket.baseTicket.distance}` : '-'}</td>
                  <td>{format(new Date(ticket.baseTicket.departureTime), 'yyyy-MM-dd HH:mm')}</td>
                  <td className="arrival-time">{format(new Date(ticket.baseTicket.arrivalTime), 'yyyy-MM-dd HH:mm')}</td>
                  <td>{ticket.carNo && ticket.seatNo ? `${ticket.carNo}车${ticket.seatNo}` : '-'}</td>
                  <td>¥{ticket.baseTicket.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <Pagination 
              size="small"
              current={currentPage}
              total={getTotalCount()}
              pageSize={pageSize}
              onChange={handlePageChange}
              hideOnSinglePage={true}
              showSizeChanger={false}
              showTotal={(total) => `共${total}条`}
            />
          </div>
            </>
          )}
        </>
      )}

      {displayType === 'flight' && (
        <>
          {isMobileView ? (
            <div className="mobile-ticket-list">
              <div className="timeline-container">
                <div className="timeline-line"></div>
                <div className="timeline-items">
                  {/* 按日期分组显示飞机票 */}
                  {(() => {
                    // 按日期分组
                    const groupedTickets: { [key: string]: FlightTicket[] } = {};
                    
                    tickets.flightTickets.forEach((ticket: FlightTicket) => {
                      const departureDate = format(new Date(ticket.baseTicket.departureTime), 'yyyy-MM-dd');
                      if (!groupedTickets[departureDate]) {
                        groupedTickets[departureDate] = [];
                      }
                      groupedTickets[departureDate].push(ticket);
                    });
                    
                    // 按日期排序（从新到旧）
                    const sortedDates = Object.keys(groupedTickets).sort((a, b) => 
                      new Date(b).getTime() - new Date(a).getTime()
                    );
                    
                    return sortedDates.map(date => {
                      const dateObj = new Date(date);
                      const month = format(dateObj, 'MM');
                      const day = format(dateObj, 'dd');
                      const year = format(dateObj, 'yyyy');
                      
                      return (
                        <div key={date} className="timeline-item">
                          <div className="timeline-date-section">
                            <div className="timeline-date">
                              <div className="timeline-month-day">
                                <span className="timeline-month">{month}-{day}</span>
                              </div>
                              <div className="timeline-year">{year}</div>
                            </div>
                            <div className="timeline-dot"></div>
                          </div>
                          <div className="timeline-content">
                            {groupedTickets[date].map((ticket: FlightTicket) => (
                              <div 
                                key={ticket.id} 
                                className={`mobile-ticket-item ${isToday(ticket.baseTicket.departureTime) ? 'today-ticket' : ''}`}
                                onClick={() => handleTrainNoClick(ticket)}
                              >
                                <div className="mobile-ticket-header">
                                  <div className="mobile-ticket-number">
                                    <img 
                                      src={isCompleted(ticket.baseTicket.departureTime) ? '/landing.svg' : '/takeoff.svg'} 
                                      alt={isCompleted(ticket.baseTicket.departureTime) ? '已出行' : '待出行'} 
                                      className="travel-status-icon"
                                    />
                                    <span className="mobile-flight-no">{ticket.flightNo}</span>
                                    {ticket.flightType && <span className="mobile-flight-type">{ticket.flightType}</span>}
                                  </div>
                                  <div className="mobile-ticket-price">¥{ticket.baseTicket.price}</div>
                                </div>
                                <div className="mobile-ticket-stations">
                                  <div className="mobile-station-info">
                                    <div className="mobile-station-name">{ticket.baseTicket.departureStation}</div>
                                    <div className="mobile-station-time">{format(new Date(ticket.baseTicket.departureTime), 'HH:mm')}</div>
                                  </div>
                                  <div className="mobile-journey-path">
                                    <div className="journey-line"></div>
                                    <div className="journey-icon">
                                      <svg className="plane-icon" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M824.7 517.7l-190.1-6.8-205.2-267.1c-6.2-8.1-17.3-10.5-26.3-5.8l-73.6 38.3c-9.8 5.1-14 17-9.5 27.1l94 214-145.2-0.5L155.7 398c-5.6-5.9-14.3-8-22-5.4l-55.2 18.9c-8.5 2.9-14.2 10.9-14.2 19.9v97c0 4.1 1.2 8.1 3.5 11.6L226 779c3.9 5.9 10.4 9.4 17.5 9.4h580.9c74.6 0 135.4-60.7 135.4-135.4 0-74.5-60.6-135.1-135.1-135.3z m-0.3 244.7H246.2l-156-235.6v-91.9l48.8-16.7 114.7 120.6 0.1 0.1c0.2 0.2 0.4 0.3 0.5 0.5l0.4 0.4c0.2 0.1 0.3 0.3 0.5 0.4 0.2 0.1 0.3 0.3 0.5 0.4 0.2 0.1 0.3 0.3 0.5 0.4 0.2 0.1 0.3 0.3 0.5 0.3l0.6 0.3c0.2 0.1 0.4 0.2 0.7 0.2 0.2 0.1 0.3 0.1 0.5 0.2s0.5 0.1 0.7 0.2c0.2 0 0.3 0.1 0.5 0.1s0.4 0.1 0.7 0.1c0.2 0 0.4 0.1 0.6 0.1h1.4l170.7 0.6h0.1c0.7 0 1.4-0.1 2.2-0.2 0.2 0 0.3 0 0.5-0.1h0.2c0.4-0.1 0.8-0.2 1.1-0.3 0.1 0 0.1 0 0.2-0.1 0.4-0.1 0.7-0.3 1.1-0.4h0.1c0.1 0 0.2-0.1 0.3-0.1 0.3-0.1 0.6-0.3 0.8-0.4 0.2-0.1 0.3-0.2 0.5-0.3 0.2-0.1 0.4-0.2 0.6-0.4 0.2-0.1 0.4-0.3 0.6-0.4 0.1-0.1 0.3-0.2 0.4-0.3 0.2-0.2 0.4-0.3 0.6-0.5l0.3-0.3c0.2-0.2 0.3-0.4 0.5-0.6 0.1-0.1 0.2-0.3 0.3-0.4 0.1-0.2 0.3-0.4 0.4-0.6 0.1-0.2 0.2-0.3 0.3-0.5 0.1-0.2 0.2-0.3 0.3-0.5l0.3-0.6c0.1-0.2 0.2-0.3 0.2-0.5 0.1-0.2 0.1-0.4 0.2-0.7 0-0.2 0.1-0.5 0.1-0.7 0-0.2 0.1-0.4 0.1-0.6v-0.9-0.3-0.1-1-0.3c0-0.3-0.1-0.5-0.1-0.8 0-0.2 0-0.3-0.1-0.5 0-0.2-0.1-0.3-0.1-0.5-0.1-0.3-0.1-0.5-0.2-0.8 0-0.1-0.1-0.2-0.1-0.3l-0.3-0.9v-0.1L345.6 297.1l65.7-34.2 206.3 268.7c0 0.1 0.1 0.1 0.2 0.2 0.2 0.3 0.4 0.5 0.7 0.8l0.5 0.5 0.4 0.4c0.2 0.2 0.4 0.3 0.6 0.5 0.1 0.1 0.3 0.2 0.4 0.3 0.2 0.1 0.4 0.2 0.5 0.3 0.2 0.1 0.4 0.2 0.5 0.3l0.6 0.3c0.2 0.1 0.3 0.1 0.5 0.2s0.5 0.2 0.7 0.3c0.1 0.1 0.3 0.1 0.5 0.1 0.3 0.1 0.5 0.2 0.8 0.2 0.2 0 0.3 0.1 0.5 0.1s0.5 0.1 0.7 0.1c0.3 0 0.6 0.1 0.9 0.1h0.3l196.4 7h0.5c60.3 0 109.4 49.1 109.4 109.4 0 60.3-49.1 109.3-109.4 109.3z" fill="currentColor" p-id="2543"></path>
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="mobile-station-info">
                                    <div className="mobile-station-name">{ticket.baseTicket.arrivalStation}</div>
                                    <div className="mobile-station-time">{format(new Date(ticket.baseTicket.arrivalTime), 'HH:mm')}</div>
                                  </div>
                                </div>

                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <InfiniteScroll loadMore={loadMore} hasMore={hasMore}>
                  {loading ? (
                    <div className="infinite-loading">
                      <span>加载中</span>
                      <DotLoading />
                    </div>
                  ) : hasMore ? (
                    <span>上拉加载更多</span>
                  ) : (
                    <span>没有更多了</span>
                  )}
                </InfiniteScroll>
              </div>
            </div>
          ) : (
        <>
          <table className="ticket-table flight-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>航班号</th>
                <th>机型</th>
                <th>出发站</th>
                <th>到达站</th>
                <th>里程</th>
                <th>出发时间</th>
                <th className="arrival-time">到达时间</th>
                <th>票价</th>
              </tr>
            </thead>
            <tbody>
              {tickets.flightTickets.map((ticket: FlightTicket, index: number) => (
                <tr 
                  key={ticket.id} 
                  className={isToday(ticket.baseTicket.departureTime) ? 'today-ticket' : ''}
                >
                  <td>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td>
                    <img 
                      src={isCompleted(ticket.baseTicket.departureTime) ? '/landing.svg' : '/takeoff.svg'} 
                      alt={isCompleted(ticket.baseTicket.departureTime) ? '已出行' : '待出行'} 
                      className="travel-status-icon"
                      title={isCompleted(ticket.baseTicket.departureTime) ? '已出行' : '待出行'}
                    />
                    {ticket.flightNo}
                  </td>
                  <td>{ticket.flightType || '-'}</td>
                  <td>{ticket.baseTicket.departureStation}</td>
                  <td>{ticket.baseTicket.arrivalStation}</td>
                  <td>{ticket.baseTicket.distance ? `${ticket.baseTicket.distance}` : '-'}</td>
                  <td>{format(new Date(ticket.baseTicket.departureTime), 'yyyy-MM-dd HH:mm')}</td>
                  <td className="arrival-time">{format(new Date(ticket.baseTicket.arrivalTime), 'yyyy-MM-dd HH:mm')}</td>
                  <td>¥{ticket.baseTicket.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <Pagination 
              size="small"
              current={currentPage}
              total={getTotalCount()}
              pageSize={pageSize}
              onChange={handlePageChange}
              hideOnSinglePage={true}
              showSizeChanger={false}
              showTotal={(total) => `共${total}条`}
            />
          </div>
            </>
          )}
        </>
      )}

      {displayType === 'statistics' && (
        <Statistics 
          startDate={dateRange[0] ? format(dateRange[0], 'yyyy-MM-dd') : ''} 
          endDate={dateRange[1] ? format(dateRange[1], 'yyyy-MM-dd') : ''} 
        />
      )}

      {isModalOpenValue && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpenValue(false)} style={{ position: 'absolute', top: '10px', right: '10px' }}>×</button>
            <form className="ticket-form" onSubmit={handleSubmit}>
              <div className="ticket-type-switch" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <Segmented
                  value={ticketType}
                  onChange={(value) => setTicketType(value as 'train' | 'flight')}
                  options={[
                    {
                      label: (
                        <div className="segmented-item">
                          <img src="/train.svg" alt="火车" className="nav-icon" />
                          <span>火车票</span>
                        </div>
                      ),
                      value: 'train'
                    },
                    {
                      label: (
                        <div className="segmented-item">
                          <img src="/plane.svg" alt="飞机" className="nav-icon" />
                          <span>飞机票</span>
                        </div>
                      ),
                      value: 'flight'
                    }
                  ]}
                />
              </div>

              <div className="station-row">
                <div className="form-group">
                  
                  <input
                    type="text"
                    value={formData.departureStation}
                    onChange={(e) => setFormData({...formData, departureStation: e.target.value})}
                    required
                    placeholder="请输入出发站"
                  />
                </div>
                <button 
                  type="button" 
                  className="station-swap-button"
                  onClick={handleSwapStations}
                  aria-label="交换站点"
                >
                  ⇌
                </button>
                <div className="form-group">
                  
                  <input
                    type="text"
                    value={formData.arrivalStation}
                    onChange={(e) => setFormData({...formData, arrivalStation: e.target.value})}
                    required
                    placeholder="请输入到达站"
                  />
                </div>
              </div>

              {/* 完全重构时间选择器部分，区分移动端和PC端 */}

              {/* 移动端时间选择器 */}
              {isMobile && (
                <>
                  {/* 移动端 - 出发时间 */}
                  <div className="mobile-time-row">
                    <span className="mobile-time-label">出发时间</span>
                    <div className="mobile-picker-container">
                      <div 
                        className="mobile-datetime-picker"
                        data-has-value={!!formData.departureTime}
                        onClick={() => {
                          MobileDatePicker.prompt({
                            precision: 'minute',
                            defaultValue: formData.departureTime ? new Date(formData.departureTime) : new Date(),
                            title: '选择出发时间',
                            confirmText: '确定',
                            cancelText: '取消',
                            onConfirm: (val) => {
                              setFormData({
                                ...formData,
                                departureTime: val.toISOString()
                              });
                            },
                          })
                        }}
                      >
                        {formData.departureTime 
                          ? dayjs(formData.departureTime).format('YYYY-MM-DD HH:mm') 
                          : '选择日期'}
                      </div>
                    </div>
                  </div>

                  {/* 移动端 - 到达时间 */}
                  <div className="mobile-time-row">
                    <span className="mobile-time-label">到达时间</span>
                    <div className="mobile-picker-container">
                      <div 
                        className="mobile-datetime-picker"
                        data-has-value={!!formData.arrivalTime}
                        onClick={() => {
                          MobileDatePicker.prompt({
                            precision: 'minute',
                            defaultValue: formData.arrivalTime ? new Date(formData.arrivalTime) : new Date(),
                            title: '选择到达时间',
                            confirmText: '确定',
                            cancelText: '取消',
                            onConfirm: (val) => {
                              setFormData({
                                ...formData,
                                arrivalTime: val.toISOString()
                              });
                            },
                          })
                        }}
                      >
                        {formData.arrivalTime 
                          ? dayjs(formData.arrivalTime).format('YYYY-MM-DD HH:mm') 
                          : '选择日期'}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* PC端时间选择器 */}
              {!isMobile && (
                <div className="pc-time-container">
                  {/* PC端 - 出发时间和到达时间在同一行 */}
                  <div className="pc-time-row">
                    <div className="form-group">
                      <label>出发时间</label>
                      <DatePicker
                        value={formData.departureTime ? dayjs(formData.departureTime) : null}
                        onChange={(date) => setFormData({
                          ...formData,
                          departureTime: date ? date.toISOString() : ''
                        })}
                        showTime
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: '100%' }}
                        locale={locale}
                      />
                    </div>
                    <div className="form-group">
                      <label>到达时间</label>
                      <DatePicker
                        value={formData.arrivalTime ? dayjs(formData.arrivalTime) : null}
                        onChange={(date) => setFormData({
                          ...formData,
                          arrivalTime: date ? date.toISOString() : ''
                        })}
                        showTime
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: '100%' }}
                        locale={locale}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 添加分割线 */}
              <div className="form-divider"></div>

              {ticketType === 'train' ? (
                <>
                  <div className="form-row three-columns">
                    <div className="form-group">
                      <input
                        type="text"
                        value={formData.orderNo}
                        onChange={(e) => setFormData({...formData, orderNo: e.target.value})}
                        required
                        placeholder="订单号"
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        value={formData.trainNo}
                        onChange={(e) => setFormData({...formData, trainNo: e.target.value})}
                        required
                        placeholder="车次"
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        required
                        placeholder="票价"
                      />
                    </div>
                  </div>

                  <div className="form-row three-columns">
                    <div className="form-group">
                      <select
                        value={formData.seatType}
                        onChange={(e) => setFormData({...formData, seatType: e.target.value})}
                        required
                      >
                        <option value="二等座">二等座</option>
                        <option value="硬卧">硬卧</option>
                        <option value="软卧">软卧</option>
                        <option value="一等座">一等座</option>
                        <option value="硬座">硬座</option>
                        <option value="商务座">商务座</option>
                        <option value="无座">无座</option>
                        <option value="软卧代二等座">软卧代二等座</option>
                        <option value="动卧">动卧</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        value={formData.carNo}
                        onChange={(e) => setFormData({...formData, carNo: e.target.value})}
                        required
                        placeholder="车厢号"
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        value={formData.seatNo}
                        onChange={(e) => setFormData({...formData, seatNo: e.target.value})}
                        required
                        placeholder="座位号"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group">
                     
                      <input
                        type="text"
                        value={formData.ticketNo}
                        onChange={(e) => setFormData({...formData, ticketNo: e.target.value})}
                        required
                        placeholder="请输入订单号"
                      />
                    </div>
                    <div className="form-group">
                    
                      <input
                        type="text"
                        value={formData.flightNo}
                        onChange={(e) => setFormData({...formData, flightNo: e.target.value})}
                        required
                        placeholder="请输入航班号"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                     
                      <input
                        type="text"
                        value={formData.airlineCompany}
                        onChange={(e) => setFormData({...formData, airlineCompany: e.target.value})}
                        required
                        placeholder="请输入航空公司"
                      />
                    </div>
                    <div className="form-group">
                      
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        required
                        placeholder="请输入票价"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => setIsModalOpenValue(false)}>
                  取消
                </button>
                <button 
                  type="button"
                  className="ocr-button"
                  onClick={() => document.getElementById('ocrInput')?.click()}
                  disabled={isOcrLoading}
                >
                  {isOcrLoading ? <LoadingOutlined /> : 'OCR识别'}
                </button>
                <input
                  type="file"
                  id="ocrInput"
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleOcrUpload}
                />
                <button type="submit" className="submit-button">
                  确定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTicket && (
        <Popup
          visible={ticketCardVisible}
          onVisibleChange={setTicketCardVisible}
          placement="center"
          closeOnOverlayClick
          destroyOnClose
        >
          <div className="ticket-card-popup">
            <TicketCard
              ticket={selectedTicket}
              onClose={() => {
                setTicketCardVisible(false);
                setSelectedTicket(null);
              }}
              onTrainNoClick={setSelectedTicketForStops}
            />
          </div>
        </Popup>
      )}

      {selectedTicketForStops && (
        <StationStops
          ticketId={selectedTicketForStops}
          onClose={() => setSelectedTicketForStops(null)}
        />
      )}

      <div className="copyright">
        Made by <a href="https://github.com/linexy" target="_blank" rel="noopener noreferrer">linexy</a>
      </div>

      {displayType !== 'statistics' && (
        <button 
          className="floating-add-button"
          onClick={() => setIsModalOpenValue(true)}
          aria-label="添加"
        >
          +
        </button>
      )}
    </div>
  );
};

export default TicketList;