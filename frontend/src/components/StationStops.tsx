import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/StationStops.css';
import { StationStopItem, fetchAndCacheStopInfo } from '../utils/cacheUtils';
import { Steps, Popup } from 'tdesign-mobile-react';

interface StationStopsProps {
  ticketId: number;
  onClose: () => void;
}

const StationStops: React.FC<StationStopsProps> = ({ ticketId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stops, setStops] = useState<StationStopItem[]>([]);
  const [departureStation, setDepartureStation] = useState('');
  const [arrivalStation, setArrivalStation] = useState('');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const loadStopInfo = async () => {
      try {
        setLoading(true);
        
        // 使用公共缓存工具获取数据
        const cacheData = await fetchAndCacheStopInfo(ticketId);
        
        if (cacheData) {
          // 设置状态
          setStops(cacheData.stops);
          setDepartureStation(cacheData.departureStation);
          setArrivalStation(cacheData.arrivalStation);
          setError(null);
        } else {
          setError('获取经停站信息失败，请稍后再试');
        }
      } catch (err) {
        console.error('获取经停站信息失败:', err);
        setError('获取经停站信息失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };

    loadStopInfo();
  }, [ticketId]);

  // 判断站点是否是出发站
  const isDepartureStation = (stationName: string) => {
    return stationName === departureStation;
  };

  // 判断站点是否是到达站
  const isArrivalStation = (stationName: string) => {
    return stationName === arrivalStation;
  };

  // 判断站点是否是乘车区间内的经停站
  const isIntermediateStop = (stationName: string) => {
    if (!stops.length) return false;

    const departureIndex = stops.findIndex(stop => stop.stationName === departureStation);
    const arrivalIndex = stops.findIndex(stop => stop.stationName === arrivalStation);
    
    if (departureIndex === -1 || arrivalIndex === -1) return false;
    
    const stationIndex = stops.findIndex(stop => stop.stationName === stationName);
    
    return stationIndex > Math.min(departureIndex, arrivalIndex) && 
           stationIndex < Math.max(departureIndex, arrivalIndex);
  };

  // 获取站点状态
  const getStationStatus = (stationName: string) => {
    if (isDepartureStation(stationName)) {
      return 'start';
    } else if (isArrivalStation(stationName)) {
      return 'finish';
    } else if (isIntermediateStop(stationName)) {
      return 'process';
    }
    return 'default';
  };

  // 获取当前站点序号是否为用户行程站点
  const isCurrentJourneyStation = (stationName: string) => {
    return isDepartureStation(stationName) || isArrivalStation(stationName) || isIntermediateStop(stationName);
  };

  // 准备步骤条数据
  const prepareStepsItems = () => {
    return stops.map((stop, index) => {
      const isJourneyStation = isCurrentJourneyStation(stop.stationName);
      const isIntermediate = isIntermediateStop(stop.stationName);
      const status = getStationStatus(stop.stationName);
      
      return {
        title: <div className={`station-title ${
          isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName) 
            ? 'journey-station' 
            : isIntermediate 
              ? 'intermediate-station' 
              : ''
        }`}>
          {stop.stationName}
        </div>,
        status,
        content: <div className="station-times">
          <div className="time-info">
            <div className={`time-item arrive ${
              isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName)
                ? 'journey-text'
                : isIntermediate
                  ? 'intermediate-text'
                  : ''
            }`}>
              {stop.isStart ? '--:--' : stop.arriveTime}
            </div>
            <div className={`time-item depart ${
              isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName)
                ? 'journey-text'
                : isIntermediate
                  ? 'intermediate-text'
                  : ''
            }`}>
              {stop.isEnd ? '--:--' : stop.departTime}
            </div>
            <div className={`time-item stopover ${
              isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName)
                ? 'journey-text'
                : isIntermediate
                  ? 'intermediate-text'
                  : ''
            }`}>
              {stop.isStart || stop.isEnd ? '--' : 
                stop.stopoverTime.includes('分') ? stop.stopoverTime : `${stop.stopoverTime}分`}
            </div>
          </div>
        </div>
      };
    });
  };

  const handleClose = () => {
    setVisible(false);
    onClose();
  };

  return (
    <Popup
      visible={visible}
      onVisibleChange={handleClose}
      placement="center"
      closeOnOverlayClick
      destroyOnClose
    >
      <div className="station-stops-container">
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && stops.length > 0 && (
          <div className="train-timetable">
            <div className="timetable-header">
              <div className="header-cell station-stop-header">站名</div>
              <div className="header-cell">到时</div>
              <div className="header-cell">发时</div>
              <div className="header-cell stopover-cell">停留</div>
            </div>
            
            <div className="timetable-content">
              <div className="custom-steps">
                {stops.map((stop, index) => {
                  const isJourneyStation = isCurrentJourneyStation(stop.stationName);
                  const isFinish = getStationStatus(stop.stationName) === 'finish';
                  const isStart = getStationStatus(stop.stationName) === 'start';
                  return (
                    <div key={index} className={`step-item ${getStationStatus(stop.stationName)}`}>
                      <div className="step-dot"></div>
                      <div className="step-line"></div>
                      <div className="step-content">
                        <div className="station-time-row">
                          <div className={`station-stops-name ${
                            isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName) 
                              ? 'journey-station' 
                              : isIntermediateStop(stop.stationName) 
                                ? 'intermediate-station' 
                                : ''
                          }`}>
                            {stop.stationName}
                          </div>
                          <div className="station-times">
                            <div className={`time-item arrive ${
                              isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName)
                                ? 'journey-text'
                                : isIntermediateStop(stop.stationName)
                                  ? 'intermediate-text'
                                  : ''
                            }`}>
                              {stop.isStart ? '--:--' : stop.arriveTime}
                            </div>
                            <div className={`time-item depart ${
                              isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName)
                                ? 'journey-text'
                                : isIntermediateStop(stop.stationName)
                                  ? 'intermediate-text'
                                  : ''
                            }`}>
                              {stop.isEnd ? '--:--' : stop.departTime}
                            </div>
                            <div className={`time-item stopover ${
                              isDepartureStation(stop.stationName) || isArrivalStation(stop.stationName)
                                ? 'journey-text'
                                : isIntermediateStop(stop.stationName)
                                  ? 'intermediate-text'
                                  : ''
                            }`}>
                              {stop.isStart || stop.isEnd ? '--' : 
                                stop.stopoverTime.includes('分') ? stop.stopoverTime : `${stop.stopoverTime}分`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Popup>
  );
};

export default StationStops;