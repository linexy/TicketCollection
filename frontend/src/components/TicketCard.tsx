import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { isMobile, isIOS } from 'react-device-detect';
import '../styles/TicketCard.css';
import { format, differenceInMinutes, isFuture, differenceInHours } from 'date-fns';
import axios from '../utils/axiosConfig';

interface TicketCardProps {
  ticket: {
    id: number;
    trainNo: string;
    trainType?: string;
    baseTicket: {
      departureStation: string;
      arrivalStation: string;
      departureTime: string;
      arrivalTime: string;
      price: number;
      distance: number;
    };
    carNo: string;
    seatNo: string;
    seatType: string;
    orderNo: string;
    checkingPort?: string;
  };
  onClose: () => void;
  disableShare?: boolean;
  onTrainNoClick?: (ticketId: number) => void;
  onRefresh?: (ticketId: number) => Promise<void>;
}

const TicketCard: React.FC<TicketCardProps> = ({ 

  disableShare = false, 
 
}) => {
  const ticketRef = useRef<HTMLDivElement>(null);

  


  
 
  

  


  const handleShare = async () => {
    if (!ticketRef.current || disableShare) return;

    try {
      // 创建一个临时容器，用于生成分享图片
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      
      // 获取当前卡片的实际尺寸和样式
      const currentCard = ticketRef.current;
      const computedStyle = window.getComputedStyle(currentCard);
      const width = computedStyle.width;
      const height = computedStyle.height;
      
      // 克隆当前票卡元素
      const clone = ticketRef.current.cloneNode(true) as HTMLElement;
      
      // 保持与原始卡片相同的尺寸和样式
      clone.style.width = width;
      clone.style.height = height;
      clone.style.borderRadius = computedStyle.borderRadius;
      clone.style.padding = computedStyle.padding;
      clone.style.backgroundColor = computedStyle.backgroundColor;
      clone.style.boxShadow = computedStyle.boxShadow;
      
      // 移除可能影响分享图片显示的交互元素
      const closeButtons = clone.querySelectorAll('.close-button');
      closeButtons.forEach(button => button.remove());
      
      // 确保订单号和车型标识正确显示
      const orderNumber = clone.querySelector('.ticket-order-number') as HTMLElement;
      const trainType = clone.querySelector('.ticket-train-type') as HTMLElement;
      
      if (orderNumber) {
        const originalOrderNumber = currentCard.querySelector('.ticket-order-number') as HTMLElement;
        if (originalOrderNumber) {
          const originalStyle = window.getComputedStyle(originalOrderNumber);
          orderNumber.style.position = originalStyle.position;
          orderNumber.style.top = originalStyle.top;
          orderNumber.style.left = originalStyle.left;
          orderNumber.style.fontSize = originalStyle.fontSize;
          orderNumber.style.fontWeight = originalStyle.fontWeight;
          orderNumber.style.color = originalStyle.color;
        }
      }
      
      if (trainType) {
        const originalTrainType = currentCard.querySelector('.ticket-train-type') as HTMLElement;
        if (originalTrainType) {
          const originalStyle = window.getComputedStyle(originalTrainType);
          trainType.style.position = originalStyle.position;
          trainType.style.top = originalStyle.top;
          trainType.style.right = originalStyle.right;
          trainType.style.fontSize = originalStyle.fontSize;
          trainType.style.fontWeight = originalStyle.fontWeight;
          trainType.style.color = originalStyle.color;
        }
      }
      
      // 确保所有文本元素都能正确显示
      const textElements = clone.querySelectorAll('.ticket-station-name, .time, .train-number, .duration, .seat-info, .price, .ticket-slogan');
      textElements.forEach(element => {
        const el = element as HTMLElement;
        const originalEl = currentCard.querySelector(`.${el.className.split(' ')[0]}`) as HTMLElement;
        if (originalEl) {
          const originalStyle = window.getComputedStyle(originalEl);
          el.style.fontSize = originalStyle.fontSize;
          el.style.fontWeight = originalStyle.fontWeight;
          el.style.color = originalStyle.color;
        }
      });
      
      // 确保布局容器的样式一致
      const layoutContainers = clone.querySelectorAll('.ticket-stations, .journey-info, .ticket-info, .ticket-footer');
      layoutContainers.forEach(container => {
        const el = container as HTMLElement;
        const originalEl = currentCard.querySelector(`.${el.className.split(' ')[0]}`) as HTMLElement;
        if (originalEl) {
          const originalStyle = window.getComputedStyle(originalEl);
          el.style.display = originalStyle.display;
          el.style.flexDirection = originalStyle.flexDirection;
          el.style.justifyContent = originalStyle.justifyContent;
          el.style.alignItems = originalStyle.alignItems;
          el.style.margin = originalStyle.margin;
          el.style.padding = originalStyle.padding;
        }
      });
      
      // 处理特殊元素
      const trainNumber = clone.querySelector('.train-number') as HTMLElement;
      if (trainNumber) {
        // 添加水平线
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.bottom = '16px';
        line.style.left = '-40px';
        line.style.right = '-30px';
        line.style.height = '3px';
        line.style.backgroundColor = '#000';
        trainNumber.style.position = 'relative';
        trainNumber.appendChild(line);
        
        // 添加箭头
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.bottom = '12px';
        arrow.style.right = '-40px';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.borderWidth = '6px';
        arrow.style.borderColor = 'transparent transparent transparent #000';
        arrow.style.transform = 'translateX(1px)';
        trainNumber.appendChild(arrow);
      }
      
      // 确保车次线条正确显示
      const journeyInfo = clone.querySelector('.journey-info') as HTMLElement;
      if (journeyInfo) {
        const originalJourneyInfo = currentCard.querySelector('.journey-info') as HTMLElement;
        if (originalJourneyInfo) {
          const originalStyle = window.getComputedStyle(originalJourneyInfo);
          journeyInfo.style.width = originalStyle.width;
          journeyInfo.style.padding = originalStyle.padding;
        }
      }
      
      // 确保移动端适配
      if (isMobile) {
        // 调整移动端的特定样式
        if (trainNumber) {
          const line = trainNumber.querySelector('div:first-child') as HTMLElement;
          if (line) {
            line.style.bottom = '10px';
            line.style.height = '2px';
          }
          
          const arrow = trainNumber.querySelector('div:last-child') as HTMLElement;
          if (arrow) {
            arrow.style.bottom = '5px';
            arrow.style.right = '-50px';
            arrow.style.borderWidth = '6px';
          }
        }
      }
      
      // 确保日期正确显示
      const ticketDate = clone.querySelector('.ticket-date') as HTMLElement;
      if (ticketDate) {
        const originalTicketDate = currentCard.querySelector('.ticket-date') as HTMLElement;
        if (originalTicketDate) {
          const originalStyle = window.getComputedStyle(originalTicketDate);
          ticketDate.style.textAlign = originalStyle.textAlign;
          ticketDate.style.margin = originalStyle.margin;
          ticketDate.style.fontSize = originalStyle.fontSize;
          ticketDate.style.color = originalStyle.color;
        }
      }
      
      // 确保底部标语正确显示
      const ticketFooter = clone.querySelector('.ticket-footer') as HTMLElement;
      const ticketSlogan = clone.querySelector('.ticket-slogan') as HTMLElement;
      
      if (ticketFooter) {
        const originalTicketFooter = currentCard.querySelector('.ticket-footer') as HTMLElement;
        if (originalTicketFooter) {
          const originalStyle = window.getComputedStyle(originalTicketFooter);
          ticketFooter.style.backgroundColor = originalStyle.backgroundColor;
          ticketFooter.style.borderRadius = originalStyle.borderRadius;
          ticketFooter.style.margin = originalStyle.margin;
          ticketFooter.style.padding = originalStyle.padding;
        }
      }
      
      if (ticketSlogan) {
        const originalTicketSlogan = currentCard.querySelector('.ticket-slogan') as HTMLElement;
        if (originalTicketSlogan) {
          const originalStyle = window.getComputedStyle(originalTicketSlogan);
          ticketSlogan.style.fontSize = originalStyle.fontSize;
          ticketSlogan.style.color = originalStyle.color;
          ticketSlogan.style.fontWeight = originalStyle.fontWeight;
          ticketSlogan.style.letterSpacing = originalStyle.letterSpacing;
        }
      }
      
      // 移除分享提示
      const shareHint = clone.querySelector('.share-hint');
      if (shareHint) {
        shareHint.remove();
      }
      
      tempContainer.appendChild(clone);
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(clone, {
        backgroundColor: null,
        scale: 2,  // 使用2倍分辨率，确保清晰度
        useCORS: true,  // 允许跨域图片
        logging: false,  // 关闭日志
        allowTaint: true,  // 允许跨域图片
        imageTimeout: 0,  // 图片加载超时时间
      });
      
      // 移除临时容器
      document.body.removeChild(tempContainer);

      // 将 canvas 转换为 blob，使用更高的图片质量
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob as Blob);
          },
          'image/png',
          1.0  // 使用最高质量
        );
      });

      // 创建文件对象
      const file = new File([blob], 'ticket.png', { 
        type: 'image/png',
        lastModified: new Date().getTime()
      });

      if (navigator.share) {
        await navigator.share({
          files: [file],
        });
      } else {
        // 如果不支持原生分享，创建一个下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ticket.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  const departureDate = new Date(ticket.baseTicket.departureTime);
  const arrivalDate = new Date(ticket.baseTicket.arrivalTime);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][departureDate.getDay()];
  
  // 计算行程时长
  const durationInMinutes = differenceInMinutes(arrivalDate, departureDate);
  const durationText = durationInMinutes >= 60 
    ? `${Math.floor(durationInMinutes / 60)}h${durationInMinutes % 60}m`
    : `${durationInMinutes}m`;
  
  return (
    <div className="ticket-card-overlay" onClick={onClose}>
      <div 
        ref={ticketRef}
        className="ticket-card" 
        onClick={(e) => {
          e.stopPropagation();
          if (isMobile && !disableShare) {
            handleShare();
          }
        }}
      >
        <div className="ticket-order-number">{ticket.orderNo}</div>
        {ticket.trainType && (
          <div className="ticket-train-type">{ticket.trainType}</div>
        )}
        
        <div className="ticket-date">
          {format(departureDate, 'yyyy年M月d日')} 周{weekDay}
        </div>
        
        <div className="ticket-stations">
          <div className="station departure">
            <div className="ticket-station-name">
              {ticket.baseTicket.departureStation}
            </div>
            <div className="time">{format(departureDate, 'HH:mm')}</div>
          </div>
          
          <div className="journey-info">
            <div 
              className="train-number" 
              onClick={(e) => {
                e.stopPropagation();
                if (onTrainNoClick) {
                  onTrainNoClick(ticket.id);
                }
              }}
            >
              {ticket.trainNo}
            </div>
            <div className="duration">{durationText}/{ticket.baseTicket.distance}km</div>
          </div>
          
          <div className="station arrival">
            <div className="ticket-station-name">{ticket.baseTicket.arrivalStation}</div>
            <div className="time">{format(arrivalDate, 'HH:mm')}</div>
          </div>
        </div>
        
        <div className="ticket-info">
          <div className="seat-price-row">
            <div className="seat-info">
              {ticket.seatType} {ticket.carNo}车{ticket.seatNo}
            </div>
            <div className="price">
              ¥{ticket.baseTicket.price}
            </div>
          </div>
        </div>
        
        <div className="ticket-footer">
          <div className="ticket-slogan">享受每一段旅程</div>
        </div>

      </div>
    </div>
  );
};

export default TicketCard;