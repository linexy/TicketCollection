import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class PushSubscription extends Model {
  public id!: number;
  public userId!: number;
  public endpoint!: string;
  public p256dh!: string;
  public auth!: string;
}

PushSubscription.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  endpoint: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  p256dh: {
    type: DataTypes.STRING,
    allowNull: false
  },
  auth: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'PushSubscription'
}); 