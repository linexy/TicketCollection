import { DataTypes, Model, Op } from 'sequelize';
import { sequelize } from '../config/database';

/**
 * 列车站点停靠信息缓存模型
 * 保留所有历史数据，不会进行清理
 */
export class TrainStopCache extends Model {
  public id!: number;
  public ticketId!: number;      // 车票ID，作为缓存的主键
  public trainNo!: string;       // 列车编号
  public fromStationCode!: string;  // 出发站电报码
  public toStationCode!: string;    // 到达站电报码
  public departDate!: string;       // 出发日期
  public departureStation!: string;  // 出发站
  public arrivalStation!: string;    // 到达站
  public stopInfo!: string;          // 缓存的站点信息 (JSON字符串)
  public createdAt!: Date;           // 缓存创建时间
  public updatedAt!: Date;           // 缓存更新时间
}

TrainStopCache.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,  // 确保每个车票ID只有一条缓存记录
    },
    trainNo: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    fromStationCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    toStationCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    departDate: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    departureStation: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    arrivalStation: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    stopInfo: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'TrainStopCache',
    tableName: 'train_stop_cache',
    timestamps: true,
    indexes: [
      {
        name: 'idx_train_stop_ticket_id',
        fields: ['ticketId']
      },
      {
        name: 'idx_train_stop_train_no',
        fields: ['trainNo']
      }
    ]
  }
);

export default TrainStopCache; 