import { UPDATE_ONE_TASK, CREATE_TASKS, DELETE_ONE_TASK, LOAD_TASKS, EDIT_TASK, MASS_EDIT_TASK, COUNT_CHECKOUT } from '../actions/types';
import { notifyMessage, toastColors } from '../components/micro/Toaster';

const initialState = {
  currentTasks: [],
  groups: { All: [] },
  gotTasks: false,
  checkouts: 0,
};

export default function(state = initialState, action) {
  const newState = { ...state };
  let taskStatus = {};
  let shouldUpdate = false;
  let { groups } = newState;
  /* Update newState based on action.type */
  switch (action.type) {
    /* takes new status sent by ipcMain and updates task via ID */
    case UPDATE_ONE_TASK:
      // eslint-disable-next-line max-len
      // newState.currentTasks[i].id === action.payload.id ? newState.currentTasks[i].status = action.payload.status ? newState.currentTasks[i].status = action.payload.status
      for (let i = 0; i < newState.currentTasks.length; i += 1) {
        if (newState.currentTasks[i].id === action.payload.id) {
          if (newState.currentTasks[i].status === 'Stopped') {
            if (action.payload.status === 'Starting') {
              shouldUpdate = true;
            }
          } else {
            shouldUpdate = true;
          }
          if (shouldUpdate) {
            newState.currentTasks[i].status = action.payload.status;
            newState.currentTasks[i].color = action.payload.color;
            if (action.payload.productName) {
              newState.currentTasks[i].productName = [action.payload.productName];
            }
          }
        }
      }
      return newState;
    /* adds new tasks to currentTasks */
    case CREATE_TASKS:
      action.payload.forEach((task) => {
        newState.currentTasks.push(task);
        if (task.groupName !== 'All') {
          if (!groups.hasOwnProperty(task.groupName)) {
            groups[task.groupName] = [];
            console.log('New task group added');
          }
        }
        groups[task.groupName].push(task.id);
        if (!groups.All.includes(task.id)) {
          groups.All.push(task.id);
        }
      });
      console.log('Tasks created.');
      return newState;
    /* removes one task from currentTasks */
    case DELETE_ONE_TASK:
      for (let i = 0; i < newState.currentTasks.length; i += 1) {
        if (newState.currentTasks[i].id === action.payload.id) {
          newState.currentTasks.splice(i, 1);
          let index = -1;
          Object.keys(groups).map((group) => {
            index = groups[group].indexOf(action.payload.id);
            if (index > -1) {
              groups[group].splice(index, 1);
            }
            if (group !== 'All') {
              if (groups[group].length <= 0) {
                delete groups[group];
                console.log('Empty task group deleted.');
                notifyMessage('Heads up!', `Empty task group: ${group} has been deleted.`, toastColors.blue);
              }
            }
          });
          break;
        }
      }
      console.log('Task deleted.');
      console.log(newState.currentTasks);
      return newState;
    case LOAD_TASKS:
      newState.gotTasks = true;
      newState.currentTasks = action.payload;
      action.payload.forEach((task) => {
        task.status = 'Idle';
        task.color = '#90a2cf';
        if (!groups.hasOwnProperty(task.groupName)) {
          groups[task.groupName] = [];
        }
        groups[task.groupName].push(task.id);
        if (!groups.All.includes(task.id)) {
          groups.All.push(task.id);
        }
      });
      console.log('Tasks loaded.');
      return newState;
    case EDIT_TASK:
      let { task } = action.payload;
      task.status = newState.currentTasks[action.payload.index].status;
      task.color = newState.currentTasks[action.payload.index].color;
      if (newState.currentTasks[action.payload.index].groupName !== task.groupName) {
        if (newState.currentTasks[action.payload.index].groupName !== 'All') {
          groups[newState.currentTasks[action.payload.index].groupName].splice(groups[newState.currentTasks[action.payload.index].groupName].indexOf(task.id), 1);
        }
        groups[action.payload.task.groupName].push(task.id);
      }
      newState.currentTasks[action.payload.index] = task;
      console.log(newState);
      return newState;
    case MASS_EDIT_TASK:
      newState.currentTasks.forEach((toEditTask, i) => {
        if (toEditTask.id === action.payload.id) {
          newState.currentTasks[i] = action.payload;
          return newState;
        }
      });
      return newState;
    case COUNT_CHECKOUT:
      console.log("I've been called to count a checkout!");
      console.log(newState.checkouts);
      newState.checkouts += 1;
      console.log(newState.checkouts);
      return newState;
    default:
      return newState;
  }
}
