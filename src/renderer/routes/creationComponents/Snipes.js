import React from 'react';
import { ipcRenderer } from 'electron';
import { NavLink as Link } from 'react-router-dom';

/* Redux dependencies */
import { connect } from 'react-redux';

/* React-select dependencies */
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { snipesSites, snipesSizes as sizes, checkoutTypes, SnipesModes } from './SelectOptions';
import { selectStyles, keywordsStyles, keywordsComponents } from './SelectStyles';

/* Button & icons */
import Button from '../../components/micro/Button';
import { notifyMessage, toastColors } from '../../components/micro/Toaster';
import createIcon from '../../assets/actions/create_green.svg';
import backIcon from '../../assets/actions/back.svg';
import saveIcon from '../../assets/actions/save.svg';

import * as actions from '../../actions';

class Snipes extends React.Component {
  state = {
    completed: false,
    siteGroup: 'snipes',
    site: 'Select Site:',
    siteName: '',
    profile: 'Select Profile:',
    numTasks: 1,
    monitorInputValue: [],
    monitorInput: [],
    sizes: [],
    checkoutType: 'Select Payment Type:',
    promoCode: '',
    proxies: 'localhost',
    monitorDelay: 2500,
    checkoutDelay: 500,
    retryDelay: 3000,
    profiles: [],
    profileGroup: [],
    taskGroups: [],
    groupName: 'All',
    useProfileGroup: false,
    proxyGroups: [{ label: 'localhost', value: 'localhost' }],
    editing: false,
    taskIndex: null,
    preRelease: false,
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
            site: e.region,
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
    if (toUpdate === 'useProfileGroup') {
      this.setState({ useProfileGroup: !this.state.useProfileGroup }, this.checkComplete);
    } else {
      this.setState({ preRelease: !this.state.preRelease }, this.checkComplete);
    }
  };

  /**
   * handleSizeChange
   * handles sizes array (since all other input are only single value)
   *
   * e - the event the onChange is being called by
   */
  handleSizeChange = (e) => {
    var sizes = [];
    if (e != null) {
      e.forEach((size) => {
        sizes.push(size.value);
      });
    }
    this.setState({ sizes }, this.checkComplete);
  };

  /**
   * handleKeywordsChange
   * handles setting current value of keywords input
   *
   * monitorValue - the state being updated
   *
   */
  handleKeywordsChange = (monitorValue) => {
    this.setState({ monitorValue });
  };

  /**
   * handleKeywordsUpdate
   * updates monitor input state array
   *
   * monitorInputValue - the state being updated
   *
   */
  handleKeywordsUpdate = (monitorInputValue) => {
    /* If creatable input value is null, we want to make sure
      state gets set to empty array instead of null */
    if (monitorInputValue == null) {
      this.setState({ monitorInput: [], monitorInputValue: [] }, this.checkComplete);
    } else {
      var monitorInput = [];
      monitorInputValue.forEach((input) => {
        if (input.color == '#00f88b') {
          monitorInput.push('+' + input.value);
        } else {
          monitorInput.push('-' + input.value);
        }
      });
      this.setState({ monitorInputValue: monitorInputValue, monitorInput }, this.checkComplete);
    }
  };

  /**
   * createOption
   * creates option for react-select component
   *
   * label - name of the option
   * color - color for the option
   *
   */
  createOption = (label, color) => ({
    label,
    value: label,
    color: color,
  });

  /**
   * handleKeyDown
   * handles creating new keyword tags when enter/space is clicked
   *
   * e - event
   */
  handleKeyDown = (e) => {
    var color = '#00f88b';
    var value = '';
    var realValue = '';

    if (!this.state.monitorValue) return;

    /* Remove the + or - from keyword, if it starts with +/- */
    if (this.state.monitorValue.charAt(0) == '+' || this.state.monitorValue.charAt(0) == '-') {
      value = this.state.monitorValue.substring(1);
    } else {
      value = this.state.monitorValue;
    }

    /* Send updates to state when Enter or Space is pressed */
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (this.state.editing && this.state.monitorInput.length > 0) {
          notifyMessage('Warning', 'You may only edit one PID while editing', toastColors.red);
        } else if (this.state.monitorValue.charAt(0) == '-') {
          notifyMessage('Hey!', 'No negative PIDs required.', toastColors.red);
        } else {
          this.setState(
            {
              monitorInputValue: [...this.state.monitorInputValue, this.createOption(value, color)],
              monitorInput: [...this.state.monitorInput, value],
              monitorValue: '',
            },
            this.checkComplete,
          );
          e.preventDefault();
        }
    }
  };

  /**
   * checkComplete
   * checks to see if all inputs have been completed
   *
   */
  checkComplete = () => {
    if (
      this.state.site != 'Select Site:' &&
      this.state.group != '' &&
      ((this.state.useProfileGroup && this.state.profileGroup.length > 0) || this.state.profile != 'Select Profile:') &&
      this.state.numTasks > 0 &&
      this.state.monitorInput.length > 0 &&
      this.state.checkoutType != 'Select Payment Type:' &&
      this.state.sizes.length > 0 &&
      this.state.mode != 'Select Mode:' &&
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
        for (var k = 0; k < this.state.monitorInput.length; k += 1) {
          currentId = parseInt(currentId) + 1;
          const task = {
            id: currentId,
            siteType: this.state.site.includes('.') ? 'footsites' : 'footlocker_eu',
            site: this.state.site,
            siteName: this.state.siteName,
            profile: this.state.useProfileGroup ? this.state.profileGroup[j] : this.state.profile,
            monitorType: 'pid',
            monitorInput: this.state.monitorInput[k],
            checkoutType: this.state.checkoutType + (this.state.mode === 'safe' ? '-safe' : '-normal'),
            mode: this.state.mode,
            sizes: this.state.sizes,
            promoCode: this.state.promoCode,
            proxies: this.state.proxies,
            monitorDelay: this.state.monitorDelay,
            checkoutDelay: this.state.checkoutDelay,
            retryDelay: this.state.retryDelay,
            status: 'Idle',
            color: '#90a2cf',
            groupName: this.state.groupName,
            type: 'script',
            preRelease: this.state.preRelease,
          };
          newTasks.push(task);
          ipcRenderer.send('task-created', task);
        }
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
      siteType: this.state.mode === 'safe' ? 'snipes-safe' : 'snipes-normal',
      site: this.state.site,
      siteName: this.state.siteName,
      profile: this.state.profile,
      monitorType: 'pids',
      monitorInput: this.state.monitorInput,
      checkoutType: this.state.checkoutType + (this.state.mode === 'safe' ? '-safe' : '-normal'),
      mode: this.state.mode,
      sizes: this.state.sizes,
      promoCode: this.state.promoCode,
      proxies: this.state.proxies,
      monitorDelay: this.state.monitorDelay,
      checkoutDelay: this.state.checkoutDelay,
      retryDelay: this.state.retryDelay,
      groupName: this.state.groupName,
      type: 'script',
      preRelease: this.state.preRelease,
    };
    ipcRenderer.send('task-edited', task);
    this.props.editTask(task, this.state.taskIndex);
    this.setState({ completed: false });
    notifyMessage('Success', `Task has been updated!`, toastColors.blue);
    this.refs.leave.click();
  };

  loadTask = (task, taskIndex) => {
    console.log(this.state.promoCode);
    const color = '#00f88b';
    const monitorInputValue = [{ label: task.monitorInput, value: task.monitorInput, color }];
    this.setState({
      editing: true,
      completed: false,
      taskIndex,
      monitorInputValue,
      monitorInput: task.monitorInput,
      checkoutType: `${task.checkoutType.split('-')[0]}-${task.checkoutType.split('-')[1]}`,
      numTasks: 1,
      monitorDelay: task.monitorDelay,
      checkoutDelay: task.checkoutDelay,
      mode: task.mode,
      sizes: task.sizes,
      siteName: task.siteName,
      retryDelay: task.retryDelay,
      promoCode: task.promoCode,
      proxies: task.proxies,
      profile: task.profile,
      site: task.site,
      preRelease: task.preRelease,
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
      console.log('Hello what the fuck?');
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
                  options={snipesSites}
                  styles={selectStyles}
                  onChange={(e) => {
                    this.handleSelectChange(e, 'site');
                  }}
                  value={snipesSites.filter((site) => site.label === this.state.siteName)}
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
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('useProfileGroup')} disabled={this.state.editing} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Profile Group</span>
                </div>
              </div>
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('preRelease')} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Pre-Release Mode</span>
                </div>
              </div>
            </div>
          </div>
          <div className="createtask-inputs__section">
            <div className="input__full">
              <span className="input__text">Mode</span>
              <Select
                options={SnipesModes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSelectChange(e, 'mode');
                }}
                value={SnipesModes.filter((mode) => mode.value === this.state.mode)}
                placeholder="Select Mode:"
              />
            </div>
            <div className="input__full">
              <span className="input__text">SKU</span>
              <CreatableSelect
                components={keywordsComponents}
                inputValue={this.state.monitorValue}
                onChange={this.handleKeywordsUpdate}
                onInputChange={this.handleKeywordsChange}
                onKeyDown={this.handleKeyDown}
                value={this.state.monitorInputValue}
                styles={keywordsStyles}
                placeholder="Product SKU"
                menuIsOpen={false}
                isClearable
                isMulti
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
                closeMenuOnSelect={false}
              />
            </div>
            <div className="input__full">
              <span className="input__text">Payment Type</span>
              <Select
                options={checkoutTypes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSelectChange(e, 'checkoutType');
                }}
                value={checkoutTypes.filter((checkoutType) => checkoutType.value === this.state.checkoutType)}
                placeholder="Select Payment Type:"
                isSearchable
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
          <div></div>
          <div className="flex--right">
            <Link to="/" className="button blue" ref="leave">
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

export default connect(mapStateToProps, actions)(Snipes);
