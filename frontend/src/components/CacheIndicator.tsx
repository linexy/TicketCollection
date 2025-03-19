import React, { useEffect, useState } from 'react';
import { stopsCache, CACHE_EXPIRY_TIME } from '../utils/cacheUtils';
import '../styles/CacheIndicator.css';

interface CacheIndicatorProps {
  ticketId: number;
  showDetails?: boolean;
}

const CacheIndicator: React.FC<CacheIndicatorProps> = ({ ticketId, showDetails = false }) => {
  const [isCached, setIsCached] = useState<boolean>(false);
  const [expiryTime, setExpiryTime] = useState<string>('');
  const [stationCount, setStationCount] = useState<number>(0);

  // 检查缓存状态
  useEffect(() => {
    const checkCache = () => {
      const cachedData = stopsCache[ticketId];
      const now = Date.now();
      
      if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRY_TIME)) {
        setIsCached(true);
        
        // 计算过期时间
        const expiryTimestamp = cachedData.timestamp + CACHE_EXPIRY_TIME;
        const expiryDate = new Date(expiryTimestamp);
        setExpiryTime(expiryDate.toLocaleTimeString());
        
        // 记录站点数量
        setStationCount(cachedData.stops.length);
      } else {
        setIsCached(false);
        setExpiryTime('');
        setStationCount(0);
      }
    };
    
    // 首次检查
    checkCache();
    
    // 每分钟刷新一次缓存状态
    const interval = setInterval(checkCache, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [ticketId]);

  // 简单显示模式
  if (!showDetails) {
    return (
      <span className={`cache-indicator ${isCached ? 'cached' : 'not-cached'}`}>
        {isCached ? '⚡' : '🕒'}
      </span>
    );
  }

  // 详细显示模式
  return (
    <div className={`cache-indicator-details ${isCached ? 'cached' : 'not-cached'}`}>
      <div className="cache-status">
        {isCached ? (
          <>
            <span className="cache-icon">⚡</span>
            <span className="cache-text">已缓存</span>
            <span className="cache-expiry">
              (有效至 {expiryTime}, {stationCount} 站点)
            </span>
          </>
        ) : (
          <>
            <span className="cache-icon">🕒</span>
            <span className="cache-text">未缓存</span>
          </>
        )}
      </div>
    </div>
  );
};

export default CacheIndicator; 