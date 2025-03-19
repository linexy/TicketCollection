import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize({
  dialect: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ticket_system',
  dialectOptions: {
    connectTimeout: 60000,
    timezone: '+08:00',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    connectionTimeout: 60000,
    acquireTimeout: 60000,
    ssl: false,
    trustServerCertificate: true,
    dateStrings: true,
    typeCast: function (field: any, next: any) {
      if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
        return field.string();
      }
      return next();
    }
  },
  timezone: '+08:00',
  pool: {
    max: 10,
    min: 0,
    acquire: 60000,
    idle: 10000
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    backoffBase: 1000,
    backoffExponent: 1.5,
  },
  logging: false
});

export const serverConfig = {
  port: 3001,
};
