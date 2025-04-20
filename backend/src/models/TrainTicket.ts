import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { BaseTicket } from './BaseTicket';

export class TrainTicket extends Model {
  public id!: number;
  public trainNo!: string;
  public seatType!: string;
  public carNo!: string;
  public seatNo!: string;
  public orderNo!: string;
  public trainType!: string;
  public baseTicketId!: number;
  public baseTicket!: BaseTicket;
}

TrainTicket.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  trainNo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  seatType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  carNo: {
    type: DataTypes.STRING,
    allowNull: true  // 允许为空
  },
  seatNo: {
    type: DataTypes.STRING,
    allowNull: true  // 允许为空
  },
  orderNo: {
    type: DataTypes.STRING,
    allowNull: true  // 允许为空
  },
  trainType: {
    type: DataTypes.STRING(50),
    allowNull: true  // 允许为空
  },
  baseTicketId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: BaseTicket,
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'TrainTicket'
});