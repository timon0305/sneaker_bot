/* eslint-disable react/state-in-constructor */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable react/prop-types */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/prefer-stateless-function */
import * as React from 'react';
import { NavLink as Link } from 'react-router-dom';
// import ScrollText from 'react-scroll-text';
import { connect } from 'react-redux';
import { ipcRenderer } from 'electron';

import Select from 'react-select';
import { viewsStyles } from './creationComponents/SelectStyles';

import ControlInfo from '../components/micro/ControlInfo';
import Button from '../components/micro/Button';
import CircleButton from '../components/micro/CircleButton';
import EditModal from '../components/EditModal';
import QTModal from '../components/QTModal';

import '../styles/Tasks.scss';

/* Action icons for profile actions */
import deleteIcon from '../assets/actions/delete.svg';
import captchaIcon from '../assets/actions/captcha.svg';
import startIcon from '../assets/actions/start.svg';
import stopIcon from '../assets/actions/stop.svg';
import createIcon from '../assets/actions/create.svg';
import editIcon from '../assets/actions/edit.svg';

/* Task site icons */
import shopifySvg from '../assets/sites/shopify_b.svg';
import supremeSvg from '../assets/sites/supreme_b.svg';
import ysPng from '../assets/sites/yeezysupply_b.png';
import snipesSvg from '../assets/sites/snipes_b.svg';
import ftlPng from '../assets/sites/footlocker_b.png';

/* Redux dependencies */
import * as actions from '../actions';

class Tasks extends React.Component {
  state = {
    taskGroups: [],
    selectedGroup: {},
    proxies: 0,
  };

  // eslint-disable-next-line react/no-deprecated
  componentWillMount() {
    ipcRenderer.on('countCheckout', () => {
      console.log('Did i get the message twice??');
      this.props.countCheckout();
    });
    ipcRenderer.on('updateTask', (e, arg) => {
      this.props.updateOneTask(arg);
      this.forceUpdate();
    });
    if (!this.props.gotTasks) {
      console.log('Loading tasks...');
      ipcRenderer.send('getTasks');
    }
    ipcRenderer.on('sendTasks', (e, tasks) => {
      this.props.loadTasks(tasks);
    });
    ipcRenderer.send('getProfiles');
    ipcRenderer.on('sendProfiles', (e, profiles, groups) => {
      console.log('Loading profiles...');
      this.props.loadProfiles(profiles, groups);
    });

    console.log('Setting task groups...');
    const taskGroups = [];
    taskGroups.push({ label: 'All', value: this.props.taskGroups.All });
    Object.keys(this.props.taskGroups).map((group) => {
      if (group !== 'All') {
        taskGroups.push({ label: group, value: this.props.taskGroups[group] });
      }
    });
    this.setState({ taskGroups, selectedGroup: taskGroups[0] });
    console.log('Task groups set.');

    ipcRenderer.send('get-proxies');
    ipcRenderer.on('sendProxies', (e, sentProxies) => {
      let proxies = 0;
      sentProxies.forEach((group) => {
        proxies += group.proxies.length;
      });
      this.setState({ proxies });
    });

    ipcRenderer.on('massEditTask', (e, task, edit) => {
      if (edit) {
        console.log('hello?');
        this.props.massEditTask(task);
        this.forceUpdate();
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  startAll = () => {
    if (this.state.selectedGroup.label === 'All') {
      ipcRenderer.send('start-all-tasks');
    } else {
      this.props.currentTasks.forEach((task) => {
        if (this.state.selectedGroup.value.includes(task.id)) {
          ipcRenderer.send('start-task', task);
        }
      });
    }
  };
  // eslint-disable-next-line class-methods-use-this
  stopAll = () => {
    if (this.state.selectedGroup.label === 'All') {
      ipcRenderer.send('stop-all-tasks');
    } else {
      this.props.currentTasks.forEach((task) => {
        if (this.state.selectedGroup.value.includes(task.id)) {
          ipcRenderer.send('stop-task', task);
        }
      });
    }
  };
  deleteAll = () => {
    let totalTasks = this.props.currentTasks.length - 1;
    for (totalTasks; totalTasks >= 0; totalTasks -= 1) {
      console.log('What the fuck');
      ipcRenderer.send('delete-task', this.props.currentTasks[totalTasks]);
      this.props.deleteOneTask(this.props.currentTasks[totalTasks]);
    }
    this.forceUpdate();
  };

  deleteTask = (task) => {
    this.props.deleteOneTask(task);
    this.forceUpdate();
    ipcRenderer.send('delete-task', task);
  };
  testCaptcha() {
    ipcRenderer.send('test-captcha');
  }

  importFile = (e) => {
    this.deleteAll();
    ipcRenderer.send('import-tasks', e.target.files[0].path);
    this.forceUpdate();
  };

  getTaskType(task) {
    if (task.siteType === 'supreme') {
      return task.headlessMode ? 'Headless' : 'Request';
    }
    if (task.siteType === 'shopify-advanced') {
      return 'Advanced';
    }
    if (task.siteType === 'shopify-safe') {
      return 'Safe';
    }
    if (task.siteType === 'snipes-safe') {
      return 'Safe';
    }
    if (task.siteType === 'snipes-normal') {
      return 'Normal';
    }
    return 'Request';
  }

  render() {
    return (
      <>
        <input ref="importFile" type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => this.importFile(e)} />
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        {this.props.qtOpen ? <QTModal qtOpen={this.props.qtOpen} qtClose={this.props.qtClose} /> : <></>}
        <div className={`page__content ${this.props.editOpen || this.props.qtOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Tasks</h1>
          </div>
          <div className="control-buttons__wrapper">
            <div className="flex--right">
              <Link
                exact
                to="/createTasks"
                className="button blue"
                onClick={() => {
                  this.props.setTaskIndex(null);
                }}
              >
                <img src={createIcon} className="button__img" />
                Create
              </Link>
              <Button clickFunction={this.startAll} icon={startIcon} color="green" text="Start" />
              <Button clickFunction={this.stopAll} icon={stopIcon} color="yellow" text="Stop" />
              <Button clickFunction={this.deleteAll} icon={deleteIcon} color="red" text="Delete" />
              {/* <Button clickFunction={this.testCaptcha} icon={deleteIcon} color="white" text="captcha test" /> */}
            </div>
            <div className="flex--right" style={{ color: '#6f7ead' }}>
              <ControlInfo color="blue" text={`${this.props.currentTasks.length} tasks`} />
              <ControlInfo color="green" text={`${this.props.checkouts} checkouts`} />
              <ControlInfo color="yellow" text={`${this.state.proxies} proxies`} />
              <CircleButton clickFunction={() => this.refs.importFile.click()} name="export" />
              <CircleButton clickFunction={() => ipcRenderer.send('export-tasks')} name="import" />
            </div>
          </div>
          <div className="task__groups__dropdown">
            <span className="task__group__text">Selected Group:</span>
            <div className="view__selector--wrapper">
              <Select options={this.state.taskGroups} styles={viewsStyles} isSearchable={false} value={this.state.selectedGroup} onChange={(e) => this.setState({ selectedGroup: e })} />
            </div>
          </div>
          <div className="tasks__container">
            <div className="table">
              <div className="table__headings">
                <div className="table__row">
                  <span />
                  <span>Store</span>
                  <span>Product</span>
                  <span>Size(s)</span>
                  <span>Profile</span>
                  <span>Proxies</span>
                  <span>Mode</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
              </div>
              {this.props.currentTasks.length > 0 ? (
                <div className="table__body">
                  {this.props.currentTasks.map((task, index) =>
                    this.state.selectedGroup.value.includes(task.id) ? (
                      <div className="table__row">
                        <span>
                          <div className="table__image__wrapper">
                            <img
                              src={
                                task.siteType === 'shopify-advanced' || task.siteType === 'shopify-safe'
                                  ? shopifySvg
                                  : task.siteType === 'supreme'
                                  ? supremeSvg
                                  : task.siteType === 'snipes-safe' || task.siteType === 'snipes-normal' || task.siteType === 'snipes'
                                  ? snipesSvg
                                  : ysPng
                              }
                              className="table__image"
                              alt="Shopify"
                            />
                          </div>
                        </span>
                        <span>{task.siteName}</span>
                        <span>
                          {task.productName
                            ? task.productName
                            : task.monitorType === 'keywords'
                            ? task.monitorInput.map((k, i) => (i !== task.monitorInput.length - 1 ? `${k}, ` : k))
                            : task.monitorInput}
                        </span>
                        <span style={{ textTransform: 'capitalize' }}>{task.sizes.map((k, i) => (i !== task.sizes.length - 1 ? `${k}, ` : k))}</span>
                        <span>{task.profile}</span>
                        <span>{task.proxies}</span>
                        <span style={{ color: '#90A2CF' }}>{this.getTaskType(task)}</span>
                        <span style={{ color: task.color }}>{task.status}</span>
                        <span>
                          <img onClick={() => ipcRenderer.send('start-task', task)} src={startIcon} alt="" className="table__icon" />
                          <img onClick={() => ipcRenderer.send('stop-task', task)} src={stopIcon} alt="" className="table__icon" />
                          <Link exact to="/createTasks" onClick={() => this.props.setTaskIndex(index)}>
                            <img onClick={() => {}} src={editIcon} alt="" className="table__icon" />
                          </Link>
                          <img onClick={() => this.deleteTask(task)} src={deleteIcon} alt="" className="table__icon" />
                        </span>
                      </div>
                    ) : (
                      <></>
                    ),
                  )}
                </div>
              ) : (
                <div className="no-table">
                  <div className="no-table__text">No Tasks!</div>
                  <div>Click 'Create' to make some.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
}

/**
 * mapStateToProps
 * maps reducer state to react props
 *
 * @param {any} state - reducer state
 *
 */
const mapStateToProps = (state) => ({
  currentTasks: state.tasks.currentTasks,
  taskGroups: state.tasks.groups,
  gotTasks: state.tasks.gotTasks,
  analytics: state.tools.analytics,
  checkouts: state.tasks.checkouts,
});

export default connect(mapStateToProps, actions)(Tasks);
