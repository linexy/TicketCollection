import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class BaseTicket extends Model {
  public id!: number;
  public ticketType!: string;
  public departureStation!: string;
  public arrivalStation!: string;
  public departureTime!: string;
  public arrivalTime!: string;
  public price!: number;
  public distance!: number;
}

BaseTicket.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ticketType: {
      type: DataTypes.ENUM('火车票', '飞机票'),
      allowNull: false,
    },
    departureStation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    arrivalStation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    departureTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    arrivalTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '行程里程（公里）'
    }
  },
  {
    sequelize,
    modelName: 'BaseTicket',
    indexes: [
      {
        fields: ['departureTime']
      }
    ]
  }
);