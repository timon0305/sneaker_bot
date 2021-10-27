import { combineReducers } from 'redux';
import tasksReducer from './tasksReducer';
import profilesReducer from './profilesReducer';
import toolsReducer from './toolsReducer';
import dashReducer from './dashReducer';

/* Combines reducers, all of which can be
accessed from one state and mapped to props */
export default combineReducers({
  tasks: tasksReducer,
  profiles: profilesReducer,
  tools: toolsReducer,
  analytics: dashReducer,
});
