import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { BaseTicket } from './BaseTicket';

export class FlightTicket extends Model {
  public id!: number;
  public ticketNo!: string;
  public flightType!: string;
  public airlineCompany!: string;
  public flightNo!: string;
  public mileage!: number;
  public baseTicketId!: number;
  public baseTicket!: BaseTicket;
}

FlightTicket.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  ticketNo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  flightType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  airlineCompany: {
    type: DataTypes.STRING,
    allowNull: false
  },
  flightNo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mileage: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  modelName: 'FlightTicket'
});