import { BaseTicket } from './BaseTicket';
import { TrainTicket } from './TrainTicket';
import { FlightTicket } from './FlightTicket';
import { User } from './User';
import { TrainStopCache } from './TrainStopCache';

// 设置双向关联
BaseTicket.hasOne(TrainTicket, { foreignKey: 'baseTicketId', as: 'trainTicket' });
TrainTicket.belongsTo(BaseTicket, { foreignKey: 'baseTicketId', as: 'baseTicket' });

BaseTicket.hasOne(FlightTicket, { foreignKey: 'baseTicketId', as: 'flightTicket' });
FlightTicket.belongsTo(BaseTicket, { foreignKey: 'baseTicketId', as: 'baseTicket' });

export { BaseTicket, TrainTicket, FlightTicket, User, TrainStopCache }; 