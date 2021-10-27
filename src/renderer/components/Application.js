/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { hot } from 'react-hot-loader/root';
import * as React from 'react';

/* Redux dependencies */
import { connect } from 'react-redux';
import { Route } from 'react-router-dom';
import { ipcRenderer } from 'electron';
import * as actions from '../actions';

// import {ipcRenderer} from 'electron';
import Sidebar from './Sidebar';
import Dragbar from './micro/Dragbar';

import Dashboard from '../routes/Dashboard';
import Tasks from '../routes/Tasks';
import TaskCreation from '../routes/TaskCreation';
import Profiles from '../routes/Profiles';
import ProfileCreation from '../routes/ProfileCreation';
import Proxies from '../routes/Proxies';
import Settings from '../routes/Settings';
import Tools from '../routes/Tools';
import Captcha from '../routes/Captcha';

import { notifyMessage, productMessage, toastColors } from './micro/Toaster';

// if (process.env.NODE_ENV.toLowerCase() !== 'production') {
//   electron.remote.getCurrentWindow().webContents.openDevTools();
// }

ipcRenderer.send('show-me');
ipcRenderer.send('getFileData');

ipcRenderer.on('productMessage', (e, productData) => {
  productMessage(productData.image, productData.link, productData.message, productData.name, toastColors[productData.color]);
});

ipcRenderer.on('notifyMessage', (e, messageData) => {
  notifyMessage(messageData.title, messageData.message, toastColors[messageData.color]);
});

const Application = (props) => {
  const [editOpen, setEditOpen] = React.useState(false);
  const [qtOpen, setQtOpen] = React.useState(false);
  const [profIndex, setProfIndex] = React.useState(null);
  const [taskIndex, setTaskIndex] = React.useState(null);
  const { setShippingRates, setAccountPools, setAnalytics, setHarvesters } = props;
  // let activated = true;
  // ipcRenderer.on('disconnect-bot', () => {
  //   activated = false;
  // });
  ipcRenderer.on('quickTask', () => {
    setQtOpen(true);
  });

  ipcRenderer.on('setHarvesters', (e, harvesters) => {
    setHarvesters(harvesters);
  });

  ipcRenderer.on('updateAccountPools', (e, accounts) => {
    setAccountPools(accounts);
  });

  ipcRenderer.on('updateShippingRates', (e, rates) => {
    setShippingRates(rates);
  });

  ipcRenderer.on('updateAnalytics', (e, analytics) => {
    setAnalytics(analytics);
  });

  window.addEventListener('focus', () => {
    document.getElementById('window-buttons').classList.remove('unfocused');
  });

  window.addEventListener('blur', () => {
    document.getElementById('window-buttons').classList.add('unfocused');
  });

  return (
    <div className="root">
      <Sidebar />
      <div className="page__wrapper">
        <Dragbar />
        <Route path="/dashboard" exact render={() => <Dashboard editClose={setEditOpen} qtClose={setQtOpen} editOpen={editOpen} qtOpen={qtOpen} />} />
        <Route path="/" exact render={() => <Tasks editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} setTaskIndex={setTaskIndex} />} />
        <Route path="/createTasks" exact render={() => <TaskCreation editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} taskIndex={taskIndex} />} />
        <Route path="/profiles" exact render={() => <Profiles editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} setProfIndex={setProfIndex} />} />
        <Route path="/createProfiles" exact render={() => <ProfileCreation editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} profIndex={profIndex} />} />
        <Route path="/proxies" exact render={() => <Proxies editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} />} />
        <Route path="/tools" exact render={() => <Tools editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} />} />
        <Route path="/settings" exact render={() => <Settings editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} />} />
        <Route path="/harvesters" exact render={() => <Captcha editOpen={editOpen} editClose={setEditOpen} qtOpen={qtOpen} qtClose={setQtOpen} />} />
        <div className="footer">
          <div className="flex--right">
            <span
              onClick={() => {
                setEditOpen(true);
                setQtOpen(false);
              }}
            >
              Mass Edit
            </span>
            <span
              onClick={() => {
                setQtOpen(true);
                setEditOpen(false);
              }}
            >
              Quick Task
            </span>
          </div>
          <div className="flex--right">
            <span style={navigator.onLine ? { color: '#00f88d93' } : { color: '#ff3c5c93' }}>{navigator.onLine ? 'Connected' : 'Disconnected'}</span>
            <span>SOLE DESTROYER </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * mapStateToProps
 * maps reducer state to react props
 *
 * @param {any} state - reducer state
 *
 */
const mapStateToProps = (state) => ({
  accountPools: state.tools.accountPools,
  checkouts: state.tasks.checkouts,
});

export default connect(mapStateToProps, actions)(hot(Application));
