import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class StationDistance extends Model {
  public id!: number;
  public departureStation!: string;
  public arrivalStation!: string;
  public distance!: number;
}

StationDistance.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    departureStation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    arrivalStation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: '站点间距离（公里）'
    }
  },
  {
    sequelize,
    modelName: 'StationDistance',
    indexes: [
      {
        fields: ['departureStation', 'arrivalStation'],
        unique: true
      }
    ]
  }
);