import React from 'react';
import { ipcRenderer } from 'electron';
import { NavLink as Link } from 'react-router-dom';

/* React-select dependencies */
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

import { supremeSites, categories, sizes, modes } from './SelectOptions';
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

class Supreme extends React.Component {
  state = {
    completed: false,
    siteGroup: 'supreme',
    site: 'Select Site:',
    siteName: '',
    profile: 'Select Profile:',
    numTasks: 1,
    monitorType: 'Select Monitor Type:',
    monitorValue: '',
    monitorInputValue: [],
    monitorInput: [],
    sizes: [],
    color: '',
    productColor: 'any',
    category: 'new',
    proxies: 'localhost',
    monitorDelay: 2500,
    checkoutDelay: 500,
    retryDelay: 500,
    profiles: [],
    profileGroup: [],
    taskGroups: [],
    groupName: 'All',
    use3ds: false,
    quantity: 1,
    captchaBypass: false,
    useProfileGroup: false,
    proxyGroups: [{ label: 'localhost', value: 'localhost' }],
    editing: false,
    taskIndex: null,
    restockMode: false,
    headlessMode: false,
    urlMode: false,
    useStoreCredit: false,
    isScheduled: false,
    scheduledTime: '',
  };

  /**
   * handleChange
   * handles changes made to non-email, non-monitor, input boxes
   *
   * e - the event the onChange is being called by
   * toUpdate - the state to update
   */
  handleChange = (e, toUpdate) => {
    if (toUpdate === 'monitorDelay' || toUpdate === 'checkoutDelay' || toUpdate === 'numTasks' || toUpdate === 'retryDelay' || toUpdate === 'quantity') {
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
      this.setState({ captchaBypass: !this.state.captchaBypass }, this.checkComplete);
    } else if (toUpdate == 'use3ds') {
      this.setState({ use3ds: !this.state.use3ds }, this.checkComplete);
    } else if (toUpdate == 'restockMode') {
      this.setState({ restockMode: !this.state.restockMode }, this.checkComplete);
    } else if (toUpdate == 'headlessMode') {
      this.setState({ headlessMode: !this.state.headlessMode, type: 'browser' }, this.checkComplete);
    } else if (toUpdate == 'urlMode') {
      this.setState({ urlMode: !this.state.urlMode }, this.checkComplete);
    } else if (toUpdate == 'isScheduled') {
      this.setState({ isScheduled: !this.state.isScheduled }, this.checkComplete);
    } else if (toUpdate == 'useStoreCredit') {
      this.setState({ useStoreCredit: !this.state.useStoreCredit }, this.checkComplete);
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

    /* If its a negative keyword, set color to red */
    if (this.state.monitorValue.charAt(0) == '-') {
      color = '#ff3c5d';
    }

    /* Remove the + or - from keyword, if it starts with +/- */
    if (this.state.monitorValue.charAt(0) == '+' || this.state.monitorValue.charAt(0) == '-') {
      value = this.state.monitorValue.substring(1);
    } else {
      value = this.state.monitorValue;
    }

    /* For the real value being sent to array, add the +/- */
    if (this.state.monitorValue.charAt(0) != '-' && this.state.monitorValue.charAt(0) != '+') {
      realValue = '+' + this.state.monitorValue;
    } else {
      realValue = this.state.monitorValue;
    }

    /* Send updates to state when Enter or Space is pressed */
    switch (e.key) {
      case 'Enter':
      case ' ':
        this.setState(
          {
            monitorInputValue: [...this.state.monitorInputValue, this.createOption(value, color)],
            monitorInput: [...this.state.monitorInput, realValue],
            monitorValue: '',
          },
          this.checkComplete,
        );
        e.preventDefault();
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
      (!this.state.isScheduled || this.state.scheduledTime !== '') &&
      this.state.numTasks > 0 &&
      this.state.category != 'Select Category:' &&
      this.state.monitorInput.length > 0 &&
      this.state.sizes.length > 0 &&
      this.state.productColor != '' &&
      this.state.proxies != 'Select Proxy List:' &&
      this.state.monitorDelay >= 0 &&
      this.state.checkoutDelay >= 0 &&
      this.state.retryDelay >= 0 &&
      this.state.quantity >= 1
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
          category: this.state.category,
          monitorType: 'keywords',
          monitorInput: this.state.monitorInput,
          sizes: this.state.sizes,
          productColor: this.state.productColor,
          proxies: this.state.proxies,
          monitorDelay: this.state.monitorDelay,
          checkoutDelay: this.state.checkoutDelay,
          retryDelay: this.state.retryDelay,
          use3ds: this.state.use3ds,
          captchaBypass: this.state.captchaBypass,
          restockMode: this.state.restockMode,
          headlessMode: this.state.headlessMode,
          urlMode: this.state.urlMode,
          status: 'Idle',
          color: '#90a2cf',
          quantity: this.state.quantity,
          groupName: this.state.groupName,
          isScheduled: this.state.isScheduled,
          useStoreCredit: this.state.useStoreCredit,
          scheduledTime: this.state.scheduledTime,
          type: 'script',
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
      monitorType: 'keywords',
      monitorInput: this.state.monitorInput,
      sizes: this.state.sizes,
      productColor: this.state.productColor,
      proxies: this.state.proxies,
      monitorDelay: this.state.monitorDelay,
      checkoutDelay: this.state.checkoutDelay,
      retryDelay: this.state.retryDelay,
      use3ds: this.state.use3ds,
      restockMode: this.state.restockMode,
      headlessMode: this.state.headlessMode,
      captchaBypass: this.state.captchaBypass,
      groupName: this.state.groupName,
      quantity: this.state.quantity,
      isScheduled: this.state.isScheduled,
      useStoreCredit: this.state.useStoreCredit,
      scheduledTime: this.state.scheduledTime,
      type: 'script',
    };
    ipcRenderer.send('task-edited', task);
    this.props.editTask(task, this.state.taskIndex);
    this.setState({ completed: false });
    notifyMessage('Success', `Task has been updated!`, toastColors.blue);
    this.refs.leave.click();
  };

  loadTask = (task, taskIndex) => {
    let monitorInputValue = [];
    task.monitorInput.forEach((keyword) => {
      let color = '#00f88b';
      if (keyword.charAt(0) === '-') {
        color = '#ff3c5d';
      }
      monitorInputValue.push({ label: keyword.substring(1), value: keyword.substring(1), color });
    });
    this.setState({
      editing: true,
      completed: false,
      taskIndex,
      monitorInputValue,
      monitorInput: task.monitorInput,
      numTasks: 1,
      monitorDelay: task.monitorDelay,
      checkoutDelay: task.checkoutDelay,
      sizes: task.sizes,
      siteName: task.siteName,
      retryDelay: task.retryDelay,
      proxies: task.proxies,
      profile: task.profile,
      productColor: task.productColor,
      captchaBypass: task.captchaBypass,
      use3ds: task.use3ds,
      restockMode: task.restockMode,
      headlessMode: task.headlessMode,
      category: task.category,
      site: task.site,
      quantity: task.quantity,
      isScheduled: task.isScheduled,
      useStoreCredit: task.useStoreCredit,
      scheduledTime: task.scheduledTime,
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
                  options={supremeSites}
                  styles={selectStyles}
                  onChange={(e) => {
                    this.handleSelectChange(e, 'site');
                  }}
                  value={supremeSites.filter((site) => site.label === this.state.siteName)}
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
            <div className="input__full">
              <span className="input__text">Category</span>
              <Select
                options={categories}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSelectChange(e, 'category');
                }}
                value={categories.filter((category) => category.value === this.state.category)}
                placeholder="Select Category:"
                isSearchable
                backspaceRemovesValue
              />
            </div>
            <div className="input__full">
              <span className="input__text">Start Task At</span>
              <input type="datetime-local" className="input" step="1" disabled={!this.state.isScheduled} onChange={(e) => this.handleChange(e, 'scheduledTime')} value={this.state.scheduledTime} />
              <div className="error__text"></div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('useAllProfiles')} disabled={this.state.editing} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Profile Group</span>
                </div>
              </div>
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('use3ds')} checked={this.state.use3ds} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use 3DS</span>
                </div>
              </div>
            </div>
          </div>
          <div className="createtask-inputs__section">
            <div className="input__full">
              <span className="input__text">Monitor Input</span>
              <CreatableSelect
                components={keywordsComponents}
                inputValue={this.state.monitorValue}
                onChange={this.handleKeywordsUpdate}
                onInputChange={this.handleKeywordsChange}
                onKeyDown={this.handleKeyDown}
                value={this.state.monitorInputValue}
                styles={keywordsStyles}
                placeholder="Keywords"
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
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Color</span>
                <input
                  className="input"
                  onChange={(e) => {
                    this.handleChange(e, 'productColor');
                  }}
                  placeholder="Enter Color"
                  value={this.state.productColor}
                />
                <span className="error__text"></span>
              </div>
              <div className="input__half">
                <span className="input__text">Quantity</span>
                <input
                  className="input"
                  onChange={(e) => {
                    this.handleChange(e, 'quantity');
                  }}
                  placeholder="Enter Quanitity"
                  value={this.state.quantity}
                />
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('captchaBypass')} checked={this.state.captchaBypass} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Captcha Bypass</span>
                </div>
              </div>
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('headlessMode')} checked={this.state.headlessMode} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Headless Mode</span>
                </div>
              </div>
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
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('useStoreCredit')} checked={this.state.useStoreCredit} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Store Credit</span>
                </div>
              </div>
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('isScheduled')} checked={this.state.isScheduled} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Schedule Task</span>
                </div>
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

export default connect(mapStateToProps, actions)(Supreme);
