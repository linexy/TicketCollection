import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '../styles/StationsMap.css';
import customMapConfig from '../assets/custom_map_config.json';

// 添加自定义样式以增强地图线条效果，但不包含发光效果
const mapLineStyles = `
/* 优化百度地图SVG路径的渲染 */
.enhanced-map-lines .BMap_Overlay path {
  stroke-linecap: round;  /* 使线条端点圆滑 */
  stroke-linejoin: round; /* 使线条连接处圆滑 */
  shape-rendering: geometricPrecision; /* 使用几何精度渲染 */
  vector-effect: non-scaling-stroke; /* 防止线条在缩放时变形 */
}

/* 提高路径层级，确保线条在最上层 */
.enhanced-map-lines .BMap_mask {
  z-index: 900 !important;
}
`;

// 自定义地图样式配置 - 从custom_map_config.json导入
const customMapStyle = [
  {
    "featureType": "land",
    "elementType": "geometry",
    "stylers": {
      "color": "#fffff9ff"
    }
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": {
      "color": "#69b0acff"
    }
  },
  // 这里省略了大部分配置，实际使用时会使用完整配置
  {
    "featureType": "railway",
    "elementType": "geometry",
    "stylers": {
      "visibility": "on"
    }
  },
  {
    "featureType": "trainstationlabel",
    "elementType": "labels",
    "stylers": {
      "visibility": "on"
    }
  },
  {
    "featureType": "trainstationlabel",
    "elementType": "labels.icon",
    "stylers": {
      "visibility": "on"
    }
  }
];

interface MapProps {
  startDate: string;
  endDate: string;
}

interface StationData {
  stationName: string;
  latitude: number;
  longitude: number;
}

interface RouteData {
  from: string;
  to: string;
  count: number;
}

interface TicketData {
  id: number;
  departureStation: string;
  arrivalStation: string;
}

interface MapData {
  stations: StationData[];
  routes: RouteData[];
  tickets?: TicketData[];
  totalDistance?: number;
}

// 格式化里程数的函数
const formatDistance = (distance: number): string => {
  if (distance >= 10000) {
    return `${(distance / 10000).toFixed(1)}万`;
  }
  return `${Math.round(distance)}`;
};

/**
 * GCJ-02坐标系转百度坐标系(BD-09)的转换函数
 * @param lng GCJ-02经度
 * @param lat GCJ-02纬度
 * @returns 转换后的BD-09坐标 {lng, lat}
 */
const gcj02ToBd09 = (lng: number, lat: number) => {
  const PI = 3.14159265358979324;
  const X_PI = PI * 3000.0 / 180.0;
  
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;
  
  return { lng: bdLng, lat: bdLat };
};

// 添加全局类型声明
declare global {
  interface Window {
    BMap: any;
    BMapGL?: any;
    initBMap?: () => void;
    BMAP_STATUS_SUCCESS?: number;
    baiduMapConfig?: {
      styleId: string;
    };
    _baiduAPIOriginalCreateElement?: any;
    nonStrictExecute?: (callback: Function) => void;
    _originalAddEventListener?: typeof EventTarget.prototype.addEventListener;
    _originalRemoveEventListener?: typeof EventTarget.prototype.removeEventListener;
  }
}

/**
 * 设置百度地图个性化样式的适配器函数
 * 兼容处理不同版本的百度地图API
 */
const setMapStyle = (map: any, styleId: string, useCustomStyle: boolean = true) => {
  if (!map) return false;
  
  try {
    // 如果使用自定义样式，直接应用customMapConfig
    if (useCustomStyle && customMapConfig) {
      if (typeof map.setMapStyleV2 === 'function') {
        // GL版本API
        map.setMapStyleV2({ styleJson: customMapConfig });
        return true;
      } else if (typeof map.setMapStyle === 'function') {
        // v3.0版本API
        map.setMapStyle({ styleJson: customMapConfig });
        return true;
      }
    }
    
    // 如果不使用自定义样式或自定义样式应用失败，尝试使用styleId
    if (typeof map.setMapStyleV2 === 'function') {
      // GL版本API
      map.setMapStyleV2({ styleId });
      return true;
    } else if (typeof map.setMapStyle === 'function') {
      // v3.0版本API
      map.setMapStyle({ styleId });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('设置地图样式出错:', e);
    return false;
  }
};

const StationsMap: React.FC<MapProps> = ({ startDate, endDate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [baiduMap, setBaiduMap] = useState<any>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // 切换全屏模式
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    
    // 在下一个渲染周期后重新调整地图大小
    setTimeout(() => {
      if (baiduMap) {
        baiduMap.resize();
      }
    }, 100);
  };
  
  // 监听ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => {
          if (baiduMap) {
            baiduMap.resize();
          }
        }, 100);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, baiduMap]);
  
  // 加载百度地图脚本
  useEffect(() => {
    // 检查是否已存在百度地图脚本，避免重复加载
    if (window.BMapGL) {
      if (mapRef.current) {
        try {
          initializeMap();
        } catch (err) {
          console.error('初始化地图出错:', err);
          setError('初始化地图失败');
        }
      }
      return;
    }
    
    const loadBaiduMap = () => {
      try {
        // 重写百度地图API的URL
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName: string) {
          const element = originalCreateElement.call(document, tagName);
          if (tagName.toLowerCase() === 'script') {
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name: string, value: string) {
              // 拦截百度地图的请求，替换为代理接口
              if (name === 'src' && typeof value === 'string') {
                // 拦截api请求
                if (value.includes('api.map.baidu.com/api')) {
                  value = `/api/map/proxy?${value.split('?')[1]}`.replace(/&ak=[^&]+/, '');
                }
                // 拦截getscript请求
                else if (value.includes('api.map.baidu.com/getscript')) {
                  value = `/api/map/getscript?${value.split('?')[1]}`.replace(/&ak=[^&]+/, '');
                }
              }
              return originalSetAttribute.call(this, name, value);
            };
          }
          return element;
        };

        const script = document.createElement('script');
        // 使用后端代理API，避免密钥暴露，并指定使用WebGL版本
        script.src = `/api/map/proxy?v=3.0&type=webgl&callback=initBMap`;
        script.async = true;
        script.onerror = () => {
          setError('加载百度地图API失败');
          setLoading(false);
        };
        
        window.initBMap = () => {
          try {
            initializeMap();
          } catch (err) {
            console.error('初始化地图出错:', err);
            setError('初始化地图失败');
            setLoading(false);
          }
        };
        
        document.body.appendChild(script);
        return () => {
          // 清理函数
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
          window.initBMap = undefined;
        };
      } catch (err) {
        console.error('加载地图脚本出错:', err);
        setError('加载地图脚本出错');
        setLoading(false);
      }
    };
    
    loadBaiduMap();
  }, []);
  
  // 初始化地图
  const initializeMap = () => {
    if (!mapRef.current) return;

    try {
      // 清除之前的地图实例
      if (baiduMap) {
        baiduMap.destroy();
        setBaiduMap(null);
      }

      // 添加自定义样式到文档
      const styleElem = document.createElement('style');
      styleElem.innerHTML = mapLineStyles;
      document.head.appendChild(styleElem);

      // 检查百度地图API是否加载
      if (!window.BMapGL) {
        console.error('百度地图WebGL API未正确加载');
        setError('百度地图WebGL API未正确加载');
        setLoading(false);
        return;
      }

      // 创建地图实例（使用WebGL版本）
      const map = new window.BMapGL.Map(mapRef.current, {
        enableHighResolution: true, // 启用高清地图
        enableMapClick: true,
        displayOptions: {
          building: true // 显示3D建筑物
        },
        enableAutoResize: true,
        enableRotate: false, // 禁用旋转功能，这会移除2D按钮
        showControls: false // 隐藏所有控件
      });
      
      // 添加resize方法，用于全屏模式切换时调整地图大小
      map.resize = function() {
        if (map && typeof map.checkResize === 'function') {
          map.checkResize();
        }
      };
      
      setBaiduMap(map);

      // 设置地图中心点和缩放级别
      // 默认中心点也需要转换坐标系
      const defaultCenter = gcj02ToBd09(116.404, 39.915);
      map.centerAndZoom(new window.BMapGL.Point(defaultCenter.lng, defaultCenter.lat), 11);
      
      // 添加地图控件
      map.enableScrollWheelZoom();
      map.addControl(new window.BMapGL.ScaleControl());
      // 移除导航控件（包含指南针）
      // map.addControl(new window.BMapGL.NavigationControl3D()); // 使用3D导航控件

      // 确保地图加载完成后再设置样式
      const applyMapStyle = () => {
        try {
          // 直接应用自定义地图样式
          console.log('应用完整的自定义地图样式配置');
          
          // 使用导入的完整配置文件
          if (typeof map.setMapStyleV2 === 'function') {
            map.setMapStyleV2({ styleJson: customMapConfig });
          } else if (typeof map.setMapStyle === 'function') {
            map.setMapStyle({ styleJson: customMapConfig });
          } else {
            console.warn('地图API不支持设置自定义样式');
          }
        } catch (styleErr) {
          console.error('设置地图样式时出错:', styleErr);
        }
      };

      // 在地图加载完成后设置样式
      if (map.addEventListener) {
        // 在地图初始化完成后应用样式
        const tilesLoadedHandler = function() {
          applyMapStyle();
          // 只需要执行一次，所以移除监听器
          map.removeEventListener('tilesloaded', tilesLoadedHandler);
        };
        map.addEventListener('tilesloaded', tilesLoadedHandler);
      } else {
        // 如果没有事件监听API，则延迟执行
        setTimeout(applyMapStyle, 1000);
      }

      // 加载地图完成后，设置标记点
      if (mapData && mapData.stations && mapData.stations.length > 0) {
        mapData.stations.forEach((item) => {
          if (item.longitude && item.latitude) {
            // 创建标记点
            const point = new window.BMapGL.Point(item.longitude, item.latitude);
            const marker = new window.BMapGL.Marker(point);
            map.addOverlay(marker);

            // 创建信息窗口
            const infoWindow = new window.BMapGL.InfoWindow(
              `<div style="width: 250px; padding: 10px;">
                <h4>${item.stationName}</h4>
                <p>经度: ${item.longitude.toFixed(4)}</p>
                <p>纬度: ${item.latitude.toFixed(4)}</p>
              </div>`,
              {
                width: 250,
                title: item.stationName,
                enableMessage: false
              }
            );

            // 修改marker的点击事件处理
            marker.addEventListener('click', function() {
              map.openInfoWindow(infoWindow, point);
            });
          }
        });
      }

      setMapReady(true);
      setLoading(false);
    } catch (error) {
      console.error('初始化地图时出错:', error);
      setError('初始化地图失败');
      setLoading(false);
    }
  };
  
  /**
   * 使用四参数弧线法计算两点之间的弧线路径点
   * 四参数包括：起点、终点、高度和弧线方向
   */
 const calculateCurvedPath = (fromPoint: any, toPoint: any, index: number = 0, totalLines: number = 1) => {
  try {
    // 计算两点之间的距离
    const dx = toPoint.lng - fromPoint.lng;
    const dy = toPoint.lat - fromPoint.lat;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.000001) {
      return [fromPoint, toPoint]; // 两点过近，返回直线
    }

    // 计算中点
    const midPoint = new window.BMapGL.Point(
      (fromPoint.lng + toPoint.lng) / 2,
      (fromPoint.lat + toPoint.lat) / 2
    );

    // 计算法向量（垂直于线段的单位向量）
    const nx = -dy / distance;
    const ny = dx / distance;

    // 计算弧线高度因子（基础高度 * 调整因子）
    let heightFactor = 0.5; // 基础高度因子（增加默认曲率）
    if (distance < 0.1) {
      heightFactor = 0.7; // 短距离线条使用较大高度因子（增加曲率）
    } else if (distance > 0.5) {
      heightFactor = 0.4; // 长距离线条使用较小高度因子（增加曲率）
    }

    // 计算多条线的偏移
    let offsetFactor;
    if (totalLines <= 1) {
      offsetFactor = 1.0; // 单线使用固定偏移
    } else {
      // 使用正弦函数平滑分布多条线的偏移
      offsetFactor = Math.sin((index / (totalLines - 1)) * Math.PI - Math.PI / 2); 
      offsetFactor = Math.min(1.5, Math.max(-1.5, offsetFactor)); // 限制偏移范围
    }

    // 计算弧顶点（高度点）
    const height = distance * heightFactor * offsetFactor;
    const peakPoint = new window.BMapGL.Point(
      midPoint.lng + nx * height,
      midPoint.lat + ny * height
    );

    // 生成弧线上的点
    const points = [];
    const steps = Math.max(50, Math.min(250, Math.floor(distance * 100))); // 动态调整采样点数量

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // 使用二次函数插值计算弧线上的点
      // 公式：P = (1-t)²P₁ + 2(1-t)tP₂ + t²P₃
      // 其中P₁是起点，P₂是控制点（弧顶点），P₃是终点
      const lng = (1-t)*(1-t)*fromPoint.lng + 2*(1-t)*t*peakPoint.lng + t*t*toPoint.lng;
      const lat = (1-t)*(1-t)*fromPoint.lat + 2*(1-t)*t*peakPoint.lat + t*t*toPoint.lat;
      
      points.push(new window.BMapGL.Point(lng, lat));
    }

    return points;
  } catch (err) {
    console.error('计算弧线路径出错:', err);
    // 如果出错，返回直线路径
    return [fromPoint, toPoint];
  }
};

  
  /**
   * 在地图上绘制平滑弧线（使用四参数弧线法）
   * @param baiduMap 百度地图实例
   * @param fromPoint 起点
   * @param toPoint 终点
   * @param index 当前线条索引
   * @param totalLines 总线条数量
   */
  const drawEnhancedCurvedLine = (
    baiduMap: any, 
    fromPoint: any, 
    toPoint: any, 
    index: number = 0, 
    totalLines: number = 1
  ) => {
    try {
      // 获取弧线路径点（使用四参数弧线法）
      const curvedPoints = calculateCurvedPath(fromPoint, toPoint, index, totalLines);
      
      // 创建单一线条，不添加发光效果
      const polyline = new window.BMapGL.Polyline(curvedPoints, {
        strokeColor: '#ff5f5f', // 鲜艳的红色
        strokeWeight: 1.5,      // 增加线条宽度，提高清晰度
        strokeOpacity: 0.8,     // 不透明度
        enableMassClear: true,
        enableEditing: false,
        enableClicking: false,
        strokeStyle: 'solid'
      });
      
      // 添加到地图
      baiduMap.addOverlay(polyline);
      
      return { polyline };
    } catch (err) {
      console.error('绘制弧线出错:', err);
      return null;
    }
  };
  
  // 获取地图数据
  useEffect(() => {
    // 只有当地图加载完成后才获取数据
    if (!baiduMap) return;
    
    const fetchMapData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [stationsResponse, ticketsResponse] = await Promise.all([
          axios.get('/api/statistics/stations-map', {
            params: { startDate, endDate }
          }),
          axios.get('/api/statistics/tickets', {
            params: { startDate, endDate, ticketType: '火车票' }
          }).catch(err => {
            console.warn('获取票据数据失败，将使用路线数据:', err);
            return { data: { success: false } };
          })
        ]);
        
        if (stationsResponse.data.success) {
          const combinedData = {
            ...stationsResponse.data.data,
            tickets: ticketsResponse.data.success ? ticketsResponse.data.data : []
          };
          setMapData(combinedData);
        } else {
          setError('获取地图数据失败');
        }
      } catch (err) {
        console.error('加载地图数据失败:', err);
        setError('加载地图数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMapData();
  }, [startDate, endDate, baiduMap]);
  
  // 渲染地图标记和路线
  useEffect(() => {
    if (!baiduMap || !mapData || !mapData.stations || mapData.stations.length === 0) return;
    
    try {
      // 清除现有标记
      baiduMap.clearOverlays();
      
      // 站点信息映射
      const stationMap = new Map<string, StationData>();
      mapData.stations.forEach(station => {
        stationMap.set(station.stationName, station);
      });
      
      // 添加站点标记
      const markers: any[] = [];
      const points: any[] = [];
      
      // 创建自定义图标 - 使用高清图标
      const stationIcon = new window.BMapGL.Icon(
        '/station-icon.png', // 使用自定义站点图标，需要在public目录下添加
        new window.BMapGL.Size(24, 24),
        {
          anchor: new window.BMapGL.Size(12, 12),
          imageSize: new window.BMapGL.Size(24, 24) // 高清图标尺寸
        }
      );
      
      // 如果没有自定义图标，则使用圆形标记
      const useCustomIcon = false; // 设置为true启用自定义图标
      
      try {
        mapData.stations.forEach(station => {
          if (station.latitude && station.longitude) {
            try {
              // 将GCJ-02坐标转换为百度坐标系(BD-09)
              const convertedCoords = gcj02ToBd09(station.longitude, station.latitude);
              const point = new window.BMapGL.Point(convertedCoords.lng, convertedCoords.lat);
              points.push(point);
              
              // 创建标记
              let marker;
              if (useCustomIcon) {
                marker = new window.BMapGL.Marker(point, { icon: stationIcon });
              } else {
                // 使用圆形标记
                const circle = new window.BMapGL.Circle(point, 6, {
                  strokeColor: "#ff5f5f",
                  fillColor: "#ff5f5f",
                  strokeWeight: 1,
                  fillOpacity: 0.8,
                  strokeOpacity: 0.8
                });
                baiduMap.addOverlay(circle);
                

              }
              

              

              

              
              baiduMap.addOverlay(marker);
              markers.push({ marker, point });
            } catch (err) {
              console.error(`添加站点标记出错 (${station.stationName}):`, err);
            }
          }
        });
      } catch (err) {
        console.error('添加站点标记出错:', err);
      }
      
      // 绘制路线
      try {
        // 如果有票据数据，则为每张票据绘制一条弧线
        if (mapData.tickets && mapData.tickets.length > 0) {
          let ticketCount = 0;
          
          // 限制绘制的路线数量以避免性能问题
          const maxTickets = Math.min(1000, mapData.tickets.length);
          
          // 先统计每对站点之间的票数
          const routeCountMap = new Map<string, number>();
          const routeTickets = new Map<string, number[]>();
          
          // 遍历所有票据，统计各路线的票数
          for (let i = 0; i < maxTickets; i++) {
            const ticket = mapData.tickets![i];
            const routeKey = `${ticket.departureStation}-${ticket.arrivalStation}`;
            
            // 增加路线计数
            routeCountMap.set(routeKey, (routeCountMap.get(routeKey) || 0) + 1);
            
            // 保存该路线对应的票据索引
            if (!routeTickets.has(routeKey)) {
              routeTickets.set(routeKey, []);
            }
            routeTickets.get(routeKey)!.push(i);
          }
          
          // 使用异步函数处理绘制
          const drawTicketLines = async () => {
            // 遍历每条路线
            for (const [routeKey, ticketIndices] of Array.from(routeTickets.entries())) {
              const [depStation, arrStation] = routeKey.split('-');
              const totalLines = ticketIndices.length;
              
              try {
                const fromStation = stationMap.get(depStation);
                const toStation = stationMap.get(arrStation);
                
                if (fromStation && toStation && 
                    fromStation.latitude && fromStation.longitude && 
                    toStation.latitude && toStation.longitude) {
                  
                  // 将GCJ-02坐标转换为百度坐标系(BD-09)
                  const convertedFromCoords = gcj02ToBd09(fromStation.longitude, fromStation.latitude);
                  const convertedToCoords = gcj02ToBd09(toStation.longitude, toStation.latitude);
                  
                  const fromPoint = new window.BMapGL.Point(convertedFromCoords.lng, convertedFromCoords.lat);
                  const toPoint = new window.BMapGL.Point(convertedToCoords.lng, convertedToCoords.lat);
                  
                  // 为每条票据绘制一条线
                  // 根据总数限制最大线条数量，避免过度密集
                  const maxLinesToDraw = Math.min(50, totalLines);
                  const step = totalLines > maxLinesToDraw ? Math.floor(totalLines / maxLinesToDraw) : 1;
                  
                  for (let j = 0; j < totalLines; j += step) {
                    // 使用统一的弧线绘制函数
                    drawEnhancedCurvedLine(baiduMap, fromPoint, toPoint, j, totalLines);
                    ticketCount++;
                  }
                  
                  // 每完成一条路线，允许UI更新，避免阻塞
                  await new Promise(resolve => setTimeout(resolve, 0));
                }
              } catch (err) {
                console.error(`绘制车票路线出错:`, err);
              }
            }
          };
          
          // 执行绘制路线的异步函数
          drawTicketLines().catch(err => {
            console.error('绘制路线过程中发生错误:', err);
          });
        } else {
          // 备选方案：使用路线数据，为每条路线绘制直线
          const topRoutes = mapData.routes.slice(0, 20); // 只显示前20条最常用路线
          
          topRoutes.forEach((route, index) => {
            try {
              const fromStation = stationMap.get(route.from);
              const toStation = stationMap.get(route.to);
              
              if (fromStation && toStation && 
                  fromStation.latitude && fromStation.longitude && 
                  toStation.latitude && toStation.longitude) {
                
                // 将GCJ-02坐标转换为百度坐标系(BD-09)
                const convertedFromCoords = gcj02ToBd09(fromStation.longitude, fromStation.latitude);
                const convertedToCoords = gcj02ToBd09(toStation.longitude, toStation.latitude);
                
                const fromPoint = new window.BMapGL.Point(convertedFromCoords.lng, convertedFromCoords.lat);
                const toPoint = new window.BMapGL.Point(convertedToCoords.lng, convertedToCoords.lat);
                
                // 根据数量绘制多条曲线
                const lineCount = Math.min(30, Math.max(10, Math.ceil(route.count)));
                
                for (let i = 0; i < lineCount; i++) {
                  // 使用统一的弧线绘制函数
                  drawEnhancedCurvedLine(baiduMap, fromPoint, toPoint, i, lineCount);
                }
              }
            } catch (err) {
              console.error(`绘制路线出错 (${route.from}-${route.to}):`, err);
            }
          });
        }
      } catch (err) {
        console.error('绘制路线出错:', err);
      }
      
      // 自动缩放地图以显示所有标记
      if (points.length > 0) {
        try {
          // 使用更稳定的方法设置视图
          const view = baiduMap.getViewport(points, {
            margins: [50, 50, 50, 50] // 设置边距，单位是像素
          });
          baiduMap.centerAndZoom(view.center, view.zoom);
        } catch (err) {
          console.error('设置地图视图出错:', err);
          // 如果自动缩放失败，使用默认视图
          const defaultCenter = gcj02ToBd09(104.5, 38);
          baiduMap.centerAndZoom(new window.BMapGL.Point(defaultCenter.lng, defaultCenter.lat), 5);
        }
      }
    } catch (err) {
      console.error('渲染地图数据失败:', err);
      setError('渲染地图数据失败');
    }
  }, [baiduMap, mapData]);
  
  if (error) {
    return <div className="map-error">加载地图出错: {error}</div>;
  }
  
  // 全屏按钮SVG图标
  const FullscreenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    </svg>
  );
  
  // 退出全屏按钮SVG图标
  const ExitFullscreenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
    </svg>
  );
  
  return (
    <div className="stations-map-container">

      <div 
        ref={mapWrapperRef}
        className={`stations-map-wrapper ${isFullscreen ? 'fullscreen' : ''}`}
      >
        {loading && <div className="map-loading">正在加载地图...</div>}
        <div 
          ref={mapRef} 
          className="stations-map enhanced-map-lines" 
          style={{ visibility: mapReady ? 'visible' : 'hidden' }}
        ></div>
        
        {/* 全屏按钮 */}
        {!isFullscreen && mapReady && !loading && (
          <div className="fullscreen-button" onClick={toggleFullscreen} title="全屏查看">
            <FullscreenIcon />
          </div>
        )}
        
        {/* 退出全屏按钮 */}
        {isFullscreen && (
          <div className="exit-fullscreen-button" onClick={toggleFullscreen}>
            <ExitFullscreenIcon />
            <span>退出全屏</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StationsMap; 