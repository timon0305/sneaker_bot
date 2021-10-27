import React from 'react';
import { ipcRenderer } from 'electron';
import { NavLink as Link } from 'react-router-dom';

/* React-select dependencies */
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

import { ysSites, categories, sizes } from './SelectOptions';
import { selectStyles, keywordsStyles, keywordsComponents } from './SelectStyles';

/* Button & icons */
import Button from '../../components/micro/Button';
import { notifyMessage, toastColors } from '../../components/micro/Toaster';
import createIcon from '../../assets/actions/create_green.svg';
import backIcon from '../../assets/actions/back.svg';
import saveIcon from '../../assets/actions/save.svg';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../../actions';

class YeezySupply extends React.Component {
  state = {
    completed: false,
    siteGroup: 'yeezysupply',
    site: 'Select Site:',
    siteName: '',
    profile: 'Select Profile:',
    numTasks: 1,
    monitorInput: '',
    sizes: [],
    proxies: 'localhost',
    monitorDelay: 2500,
    checkoutDelay: 500,
    retryDelay: 500,
    profiles: [],
    profileGroup: [],
    taskGroups: [],
    groupName: 'All',
    useProfileGroup: false,
    proxyGroups: [{ label: 'localhost', value: 'localhost' }],
    editing: false,
    taskIndex: null,
  };

  /**
   * handleChange
   * handles changes made to non-email, non-monitor, input boxes
   *
   * e - the event the onChange is being called by
   * toUpdate - the state to update
   */
  handleChange = (e, toUpdate) => {
    if (toUpdate === 'monitorDelay' || toUpdate === 'checkoutDelay' || toUpdate === 'numTasks' || toUpdate === 'retryDelay') {
      if (isNaN(e.target.value)) return;
    }
    this.setState(
      {
        [toUpdate]: e.target.value,
      },
      this.checkComplete,
    );
  };

  /**
   * handleSelectChange
   * handles changes for react-select dropdowns
   *
   * e - the event the onChange is being called by
   * toUpdate - the state to update
   */
  handleSelectChange = (e, toUpdate) => {
    if (toUpdate === 'groupName') {
      this.setState({ groupName: e.label }, this.checkComplete);
    } else {
      if (e.value.includes('https://')) {
        this.setState(
          {
            site: e.value,
            siteName: e.label,
          },
          this.checkComplete,
        );
      } else {
        this.setState(
          {
            [toUpdate]: e.value,
          },
          this.checkComplete,
        );
      }
    }
  };

  /**
   * handleSwitchChange
   * inverts boolean value of state
   *
   * toUpdate - the state being updated
   */
  handleSwitchChange = (toUpdate) => {
    if (toUpdate == 'captchaBypass') {
      this.setState({ captchaBypass: !this.state.captchaBypass });
    } else if (toUpdate == 'use3ds') {
      this.setState({ use3ds: !this.state.use3ds });
    } else if (toUpdate == 'restockMode') {
      this.setState({ restockMode: !this.state.restockMode });
    } else if (toUpdate == 'urlMode') {
      this.setState({ urlMode: !this.state.urlMode });
    } else {
      this.setState({ useProfileGroup: !this.state.useProfileGroup }, this.checkComplete);
    }
  };

  /**
   * handleSizeChange
   * handles sizes array (since all other input are only single value)
   *
   * e - the event the onChange is being called by
   */
  handleSizeChange = (e) => {
    let sizes = [];
    if (e != null) {
      e.forEach((size) => {
        sizes.push(size.value);
      });
    }
    this.setState({ sizes }, this.checkComplete);
  };

  /**
   * checkComplete
   * checks to see if all inputs have been completed
   *
   */
  checkComplete = () => {
    console.log(this.state);
    /*
    
      editing: true,
      completed: false,
      taskIndex,
      monitorInput: task.monitorInput,
      numTasks: 1,
      monitorDelay: task.monitorDelay,
      checkoutDelay: task.checkoutDelay,
      sizes: task.sizes,
      siteName: task.siteName,
      retryDelay: task.retryDelay,
      proxies: task.proxies,
      profile: task.profile,
      site: task.site, */
    if (
      this.state.site != 'Select Site:' &&
      this.state.groupName != '' &&
      ((this.state.useProfileGroup && this.state.profileGroup.length > 0) || this.state.profile != 'Select Profile:') &&
      this.state.numTasks > 0 &&
      this.state.monitorInput != '' &&
      this.state.sizes.length > 0 &&
      this.state.proxies != 'Select Proxy List:' &&
      this.state.monitorDelay >= 0 &&
      this.state.checkoutDelay >= 0 &&
      this.state.retryDelay >= 0
    )
      this.setState({ completed: true });
    else this.setState({ completed: false });
  };

  /**
   * createTasks
   * sends task to tasks reducer
   *
   */
  createTasks = () => {
    /* Get newest ID */
    var currentId = 0;
    if (this.props.currentTasks.length > 0) currentId = this.props.currentTasks[this.props.currentTasks.length - 1].id;

    /* Create array for new tasks and send to ipcMain */
    var newTasks = [];
    let j = this.state.profileGroup.length - 1;

    /* If they want to use all profiles, we loop through all
			profiles */
    if (this.state.useProfileGroup) {
      j = 0;
    }

    for (j; j < this.state.profileGroup.length; j++) {
      for (var i = 1; i <= this.state.numTasks; i++) {
        currentId = parseInt(currentId) + 1;
        const task = {
          id: currentId,
          siteType: this.state.siteGroup,
          site: this.state.site,
          siteName: this.state.siteName,
          profile: this.state.useProfileGroup ? this.state.profileGroup[j] : this.state.profile,
          monitorType: 'url',
          monitorInput: this.state.monitorInput,
          sizes: this.state.sizes,
          proxies: this.state.proxies,
          monitorDelay: this.state.monitorDelay,
          checkoutDelay: this.state.checkoutDelay,
          retryDelay: this.state.retryDelay,
          status: 'Idle',
          color: '#90a2cf',
          groupName: this.state.groupName,
          type: 'browser',
        };
        newTasks.push(task);
        ipcRenderer.send('task-created', task);
      }
    }

    /* Send all new tasks to tasks reducer */
    this.props.createTasks(newTasks);
    console.log(`${newTasks.length} new tasks created!`);
    notifyMessage('Success', `${newTasks.length} new tasks created!`, toastColors.blue);
  };

  editTask = () => {
    const task = {
      id: this.props.currentTasks[this.state.taskIndex].id,
      siteType: this.state.siteGroup,
      site: this.state.site,
      siteName: this.state.siteName,
      profile: this.state.profile,
      category: this.state.category,
      monitorType: 'url',
      monitorInput: this.state.monitorInput,
      sizes: this.state.sizes,
      proxies: this.state.proxies,
      monitorDelay: this.state.monitorDelay,
      checkoutDelay: this.state.checkoutDelay,
      retryDelay: this.state.retryDelay,
      groupName: this.state.groupName,
      type: 'browser',
    };
    ipcRenderer.send('task-edited', task);
    this.props.editTask(task, this.state.taskIndex);
    this.setState({ completed: false });
    notifyMessage('Success', `Task has been updated!`, toastColors.blue);
  };

  loadTask = (task, taskIndex) => {
    this.setState({
      editing: true,
      completed: false,
      taskIndex,
      monitorInput: task.monitorInput,
      numTasks: 1,
      monitorDelay: task.monitorDelay,
      checkoutDelay: task.checkoutDelay,
      sizes: task.sizes,
      siteName: task.siteName,
      retryDelay: task.retryDelay,
      proxies: task.proxies,
      profile: task.profile,
      site: task.site,
      groupName: task.groupName,
    });
  };

  componentDidMount() {
    var profiles = [];
    this.props.currentProfileNames.forEach((profile) => {
      profiles.push({ value: profile, label: profile });
    });
    this.setState({ profiles });
    let taskGroups = [];
    taskGroups.push({ label: 'All', value: this.props.taskGroups.All });
    Object.keys(this.props.taskGroups).map((group) => {
      if (group !== 'All') {
        taskGroups.push({ label: group, value: this.props.taskGroups[group] });
      }
    });
    this.setState({ taskGroups });

    ipcRenderer.send('get-proxies');
    ipcRenderer.on('sendProxies', (e, sentProxies) => {
      var proxyGroups = [{ label: 'localhost', value: 'localhost' }];
      sentProxies.forEach((group) => {
        proxyGroups.push({ value: group.proxyGroupName, label: group.proxyGroupName });
      });
      this.setState({ proxyGroups });
    });

    if (this.props.taskIndex !== null) {
      this.loadTask(this.props.currentTasks[this.props.taskIndex], this.props.taskIndex);
    }
  }

  render() {
    return (
      <div className="createtask-form__wrapper">
        <div className="createtask-inputs__wrapper">
          <div className="createtask-inputs__section">
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Region</span>
                <Select
                  options={ysSites}
                  styles={selectStyles}
                  onChange={(e) => {
                    this.handleSelectChange(e, 'site');
                  }}
                  value={ysSites.filter((site) => site.label === this.state.siteName)}
                  placeholder="Select Site:"
                  isSearchable
                  backspaceRemovesValue
                />
              </div>
              <div className="input__half">
                <span className="input__text">Task Group</span>
                <CreatableSelect
                  options={this.state.taskGroups}
                  value={
                    this.state.taskGroups.filter((group) => group.label === this.state.groupName).length > 0
                      ? this.state.taskGroups.filter((group) => group.label === this.state.groupName)
                      : { label: this.state.groupName, value: [] }
                  }
                  styles={selectStyles}
                  onChange={(e) => this.handleSelectChange(e, 'groupName')}
                  isSearchable
                  backspaceRemovesValue
                />
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">{this.state.useProfileGroup ? 'Profile Group' : 'Profile'}</span>
                <Select
                  options={this.state.useProfileGroup ? this.props.profileGroups : this.state.profiles}
                  styles={selectStyles}
                  onChange={(e) => {
                    if (this.state.useProfileGroup) {
                      this.handleSelectChange(e, 'profileGroup');
                    } else {
                      this.handleSelectChange(e, 'profile');
                    }
                  }}
                  value={
                    this.state.useProfileGroup
                      ? this.props.profileGroups.filter((group) => group.value === this.state.profileGroup)
                      : this.state.profiles.filter((profile) => profile.label === this.state.profile)
                  }
                  placeholder={this.state.useProfileGroup ? 'Select Group' : 'Select Profile:'}
                  isSearchable
                />
              </div>
              <div className="input__half">
                <span className="input__text">Amount of Tasks</span>
                <input
                  className="input"
                  value={this.state.numTasks}
                  onChange={(e) => {
                    this.handleChange(e, 'numTasks');
                  }}
                  disabled={this.state.editing}
                  placeholder="1"
                />
                <div className="error__text" />
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input
                      type="checkbox"
                      className="form__switch--checkbox"
                      onChange={() => {
                        this.setState({ useProfileGroup: !this.state.useProfileGroup });
                      }}
                      disabled={this.state.editing}
                    />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Profile Group</span>
                </div>
              </div>
            </div>
          </div>
          <div className="createtask-inputs__section">
            <div className="input__full">
              <span className="input__text">URL</span>
              <input
                type="text"
                className="input"
                value={this.state.monitorInput}
                onChange={(e) => {
                  this.handleChange(e, 'monitorInput');
                }}
                placeholder="https://yeezysupply.com/products/XXXXX"
              />
            </div>
            <div className="input__full">
              <span className="input__text">Size</span>
              <Select
                options={sizes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSizeChange(e);
                }}
                value={sizes.filter((size) => this.state.sizes.includes(size.value))}
                placeholder="Select Size:"
                isSearchable
                isMulti
                backspaceRemovesValue
              />
            </div>
          </div>
          <div className="createtask-inputs__section">
            <div className="input__full">
              <span className="input__text">Proxy List</span>
              <Select
                options={this.state.proxyGroups}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSelectChange(e, 'proxies');
                }}
                value={this.state.proxyGroups.filter((group) => group.value === this.state.proxies)}
                placeholder="Select Proxy List:"
              />
            </div>
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Monitor Delay</span>
                <input
                  className="input"
                  value={this.state.monitorDelay}
                  onChange={(e) => {
                    this.handleChange(e, 'monitorDelay');
                  }}
                  placeholder="2500"
                />
              </div>
              <div className="input__half">
                <span className="input__text">Checkout Delay</span>
                <input
                  className="input"
                  value={this.state.checkoutDelay}
                  onChange={(e) => {
                    this.handleChange(e, 'checkoutDelay');
                  }}
                  placeholder="500"
                />
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Retry Delay</span>
                <input
                  className="input"
                  value={this.state.retryDelay}
                  onChange={(e) => {
                    this.handleChange(e, 'retryDelay');
                  }}
                  placeholder="500"
                />
                <div className="error__text"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="ct-buttons__wrapper">
          <div />
          <div className="flex--right">
            <Link to="/" className="button blue">
              <img src={backIcon} alt="" className="button__img" />
              Back
            </Link>
            <Button
              clickFunction={this.state.completed ? (this.state.editing ? this.editTask : this.createTasks) : () => {}}
              icon={this.state.editing ? saveIcon : createIcon}
              color={this.state.completed ? 'green' : 'green disabled'}
              text={this.state.editing ? 'Save' : 'Create'}
            />
          </div>
        </div>
      </div>
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
const mapStateToProps = (state) => {
  return {
    currentTasks: state.tasks.currentTasks,
    currentProfileNames: state.profiles.currentProfileNames,
    profileGroups: state.profiles.profileGroups,
    taskGroups: state.tasks.groups,
  };
};

export default connect(mapStateToProps, actions)(YeezySupply);
