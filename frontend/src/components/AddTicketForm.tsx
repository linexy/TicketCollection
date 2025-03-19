import React, { useState } from 'react';
import axios from 'axios';
import { fetchAndCacheStopInfo } from '../utils/cacheUtils';
import '../styles/TicketList.css';

interface AddTicketFormProps {
  onCancel?: () => void;
  onSuccess?: () => void;
}

const AddTicketForm: React.FC<AddTicketFormProps> = ({ onCancel, onSuccess }) => {
  const [ticketType, setTicketType] = useState<'火车票' | '飞机票'>('火车票');
  const [formData, setFormData] = useState({
    // 通用字段
    departureStation: '',
    arrivalStation: '',
    departureTime: '',
    arrivalTime: '',
    price: '',
    
    // 火车票字段
    trainNo: '',
    seatType: '二等座',
    carNo: '',
    seatNo: '',
    orderNo: '',
    
    // 飞机票字段
    ticketNo: '',
    airlineCompany: '',
    flightNo: '',
    mileage: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('提交表单数据:', formData);
      if (ticketType === '火车票') {
        const requestData = {
          departureStation: formData.departureStation,
          arrivalStation: formData.arrivalStation,
          departureTime: formData.departureTime,
          arrivalTime: formData.arrivalTime,
          price: parseFloat(formData.price),
          trainNo: formData.trainNo,
          seatType: formData.seatType,
          carNo: formData.carNo,
          seatNo: formData.seatNo,
          orderNo: formData.orderNo
        };
        console.log('发送火车票请求:', requestData);
        const response = await axios.post('/api/tickets/train', requestData);
        
        // 获取新添加的车票ID，并自动缓存车次时刻信息
        if (response.data && response.data.id) {
          const ticketId = response.data.id;
         // console.log(`火车票添加成功，ID: ${ticketId}，正在缓存时刻信息...`);
          
          // 异步缓存，不阻塞用户界面
          fetchAndCacheStopInfo(ticketId)
            .then(cacheResult => {
              if (cacheResult) {
             //   console.log(`车次${formData.trainNo}的时刻信息缓存成功，共${cacheResult.stops.length}个站点`);
              } else {
              //  console.warn(`车次${formData.trainNo}的时刻信息缓存失败`);
              }
            })
            .catch(err => {
              console.error(`缓存车次${formData.trainNo}时刻信息出错:`, err);
            });
        }
      } else {
        await axios.post('/api/tickets/flight', {
          departureStation: formData.departureStation,
          arrivalStation: formData.arrivalStation,
          departureTime: formData.departureTime,
          arrivalTime: formData.arrivalTime,
          price: parseFloat(formData.price),
          ticketNo: formData.ticketNo,
          airlineCompany: formData.airlineCompany,
          flightNo: formData.flightNo,
          mileage: parseFloat(formData.mileage) || 0
        });
      }
      
      // 重置表单
      setFormData({
        departureStation: '',
        arrivalStation: '',
        departureTime: '',
        arrivalTime: '',
        price: '',
        trainNo: '',
        seatType: '二等座',
        carNo: '',
        seatNo: '',
        orderNo: '',
        ticketNo: '',
        airlineCompany: '',
        flightNo: '',
        mileage: ''
      });
      
      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error('添加车票失败:', error);
    }
  };

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>票据类型：</label>
        <select 
          value={ticketType} 
          onChange={(e) => setTicketType(e.target.value as '火车票' | '飞机票')}
        >
          <option value="火车票">火车票</option>
          <option value="飞机票">飞机票</option>
        </select>
      </div>

      <div className="station-row">
        <div className="form-group">
          <label>出发站：</label>
          <input 
            type="text" 
            name="departureStation" 
            value={formData.departureStation} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="station-swap-button">
          <span>→</span>
        </div>
        <div className="form-group">
          <label>到达站：</label>
          <input 
            type="text" 
            name="arrivalStation" 
            value={formData.arrivalStation} 
            onChange={handleChange} 
            required 
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>出发时间：</label>
          <input 
            type="datetime-local" 
            name="departureTime" 
            value={formData.departureTime} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>到达时间：</label>
          <input 
            type="datetime-local" 
            name="arrivalTime" 
            value={formData.arrivalTime} 
            onChange={handleChange} 
            required 
          />
        </div>
      </div>

      <div className="form-group">
        <label>票价：</label>
        <input 
          type="number" 
          name="price" 
          value={formData.price} 
          onChange={handleChange} 
          required 
          step="0.01" 
          min="0" 
        />
      </div>

      {/* 火车票特有字段 */}
      {ticketType === '火车票' && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>车次：</label>
              <input 
                type="text" 
                name="trainNo" 
                value={formData.trainNo} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>座位类型：</label>
              <input 
                type="text" 
                name="seatType" 
                value={formData.seatType} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>车厢号：</label>
              <input 
                type="text" 
                name="carNo" 
                value={formData.carNo} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>座位号：</label>
              <input 
                type="text" 
                name="seatNo" 
                value={formData.seatNo} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
          <div className="form-group">
            <label>订单号：</label>
            <input 
              type="text" 
              name="orderNo" 
              value={formData.orderNo} 
              onChange={handleChange} 
              required 
            />
          </div>
        </>
      )}

      {/* 飞机票特有字段 */}
      {ticketType === '飞机票' && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>航班号：</label>
              <input 
                type="text" 
                name="flightNo" 
                value={formData.flightNo} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>航空公司：</label>
              <input 
                type="text" 
                name="airlineCompany" 
                value={formData.airlineCompany} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>票号：</label>
              <input 
                type="text" 
                name="ticketNo" 
                value={formData.ticketNo} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>里程：</label>
              <input 
                type="number" 
                name="mileage" 
                value={formData.mileage} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel}>取消</button>
        <button type="submit" className="submit-button">添加</button>
      </div>
    </form>
  );
};

export default AddTicketForm; 