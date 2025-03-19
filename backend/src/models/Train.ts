import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface TrainAttributes {
  id?: number;
 // date: string;
  train_no  : string;
  //startStation: string;
  //endStation: string;
  trainNo: string;
  //trainType?: string;
}

class Train extends Model<TrainAttributes> implements TrainAttributes {
  public id!: number;
  //public date!: string;
  public train_no!: string;
  //public startStation!: string;
  //public endStation!: string;
  public trainNo!: string;
  //public trainType!: string;
}

Train.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    train_no: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    //date: {
    //  type: DataTypes.STRING(10),
    //  allowNull: false,
    //},
    //stationTrainCode: {
    //  type: DataTypes.STRING(10),
    //  allowNull: false,
    //},
    //startStation: {
    //  type: DataTypes.STRING(50),
    //  allowNull: false,
    //},
    //endStation: {
    //  type: DataTypes.STRING(50),
    //  allowNull: false,
    //},
    trainNo: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    //trainType: {
    //  type: DataTypes.STRING(1),
    //  allowNull: true,
    //},
  },
  {
    sequelize,
    modelName: 'Train',
    tableName: 'trains',
    timestamps: true,
    indexes: [
      //{
      //  name: 'idx_train_date',
      //  fields: ['date']
      //},
      {
        name: 'idx_train_code',
        fields: ['train_no']
      },
      {
        name: 'idx_train_no',
        fields: ['trainNo']
      },
      //{
      //  name: 'idx_train_type',
      //  fields: ['trainType']
      //}
    ]
  }
);

export default Train; 