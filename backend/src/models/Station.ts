import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface StationAttributes {
  id: number;
  spellCode: string;
  stationName: string;
  telegraphCode: string;
  spell: string;
  initial: string;
  city?: string;
  cityCode?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
}

class Station extends Model<StationAttributes> implements StationAttributes {
  public id!: number;
  public spellCode!: string;
  public stationName!: string;
  public telegraphCode!: string;
  public spell!: string;
  public initial!: string;
  public city!: string;
  public cityCode!: string;
  public province!: string;
  public latitude!: number;
  public longitude!: number;
}

Station.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: false,
    },
    spellCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    stationName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    telegraphCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    spell: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    initial: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    cityCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Station',
    tableName: 'stations',
    timestamps: true,
  }
);

export default Station; 