import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { TrainTicket } from './TrainTicket';

export class NotificationJob extends Model {
  public id!: number;
  public jobId!: string;
  public userId!: number;
  public trainTicketId!: number;
  public scheduledTime!: Date;
  public status!: 'pending' | 'completed' | 'failed';
  public trainTicket?: TrainTicket;
}

NotificationJob.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  trainTicketId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  scheduledTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  }
}, {
  sequelize,
  modelName: 'NotificationJob'
});

NotificationJob.belongsTo(TrainTicket, { foreignKey: 'trainTicketId', as: 'trainTicket' }); 