/* eslint-disable react/state-in-constructor */
import React from 'react';
import { ipcRenderer } from 'electron';
import { NavLink as Link } from 'react-router-dom';

/* React-select dependencies */
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { shopifySites, monitorTypes, shopifySizes, ShopifyModes } from './SelectOptions';
import { selectStyles, keywordsStyles, disabledSelect, keywordsComponents } from './SelectStyles';

/* Button & icons */
import Button from '../../components/micro/Button';
import { notifyMessage, toastColors } from '../../components/micro/Toaster';
import createIcon from '../../assets/actions/create_green.svg';
import backIcon from '../../assets/actions/back.svg';
import saveIcon from '../../assets/actions/save.svg';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../../actions';

/**
 * Shopify task creation form
 */
class Shopify extends React.Component {
  state = {
    completed: false,
    siteGroup: 'shopify',
    site: 'Select Site:',
    siteName: '',
    profile: 'Select Profile:',
    numTasks: 1,
    requireLogin: false,
    loginEmail: '',
    loginPass: '',
    monitorType: 'keywords',
    monitorValue: '',
    monitorInputValue: [],
    monitorInput: [],
    requireSitePass: false,
    sitePass: '',
    sizes: [],
    mode: 'advanced',
    useShippingRate: false,
    shippingRate: 'Select Rate:',
    proxies: 'localhost',
    monitorDelay: 2500,
    retryDelay: 3000,
    emailComplete: false,
    emailChanged: false,
    profiles: [],
    useProfileGroup: false,
    profileGroup: [],
    sendCheckout: false,
    proxyGroups: [{ label: 'localhost', value: 'localhost' }],
    custom: false,
    customURL: '',
    taskGroups: [],
    groupName: 'All',
    editing: false,
    taskIndex: null,
    useAccountPool: false,
    accountPools: [],
    shippingRates: [],
    accountPool: '',
    isScheduled: false,
    scheduledTime: '',
  };

  /**
   * handles changes made to non-email, non-monitor, input boxes
   *
   * @param {any} e - The event the onChange is being called by
   * @param {string} toUpdate - The state to update
   */
  handleChange = (e, toUpdate) => {
    if (toUpdate === 'monitorDelay' || toUpdate === 'retryDelay' || toUpdate === 'numTasks') {
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
   * handles changes for react-select dropdowns
   *
   * @param {any} e - the event the onChange is being called by
   * @param {string} toUpdate - the state to update
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
            custom: false,
          },
          this.checkComplete,
        );
      } else {
        if (e.value === 'custom_sh092' && e.label === 'Custom') {
          this.setState({
            custom: true,
          });
        }
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
   * inverts boolean value of state
   *
   * @param {string} toUpdate - the state being updated
   */
  handleSwitchChange = (toUpdate) => {
    this.setState({ [toUpdate]: !this.state[toUpdate] }, () => {
      if (toUpdate === 'useAccountPool') {
        if (this.state.useAccountPool) {
          this.setState({ requireLogin: true }, this.checkComplete);
        }
      }
      if (toUpdate === 'requireLogin') {
        if (!this.state.requireLogin) {
          this.setState({ useAccountPool: false }, this.checkComplete);
        }
      }
      this.checkComplete();
    });
  };

  /**
   * handles sizes array (since all other input are only single value)
   *
   * @param {any} e - the event the onChange is being called by
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
   * handles setting current value of keywords input
   *
   * @param {string} monitorValue - the state being updated
   */
  handleKeywordsChange = (monitorValue) => {
    this.setState({ monitorValue });
  };

  /**
   * updates monitor input state array
   *
   * @param {string} monitorInputValue - the state being updated
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
   * creates option for react-select component
   *
   * @param {string} label - name of the option
   * @param {string} color - color for the option
   */
  createOption = (label, color) => ({
    label,
    value: label,
    color: color,
  });

  /**
   * handles creating new keyword tags when enter/space is clicked
   *
   * @param {any} e - event to get keydown event from
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
      case 'Tab':
        if (this.state.editing && (this.state.monitorType === 'url' || this.state.monitorType === 'variant') && this.state.monitorInput.length > 0) {
          if (this.state.monitorType === 'url') {
            notifyMessage('Warning', 'You may only add one URL when editing', toastColors.red);
          } else {
            notifyMessage('Warning', 'You may only add one variant when editing', toastColors.red);
          }
        } else {
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
    }
  };

  /**
   * handles the changes being made to an email, uses regex
   * to make sure its valid input
   */
  handleEmail = () => {
    let valid = false;
    if (this.refs.emailField.value) {
      if (/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(this.refs.emailField.value))
        valid = true;
      this.setState({ emailChanged: true });
    } else {
      this.setState({ emailChanged: false });
    }

    this.setState(
      {
        loginEmail: this.refs.emailField.value,
        emailComplete: valid,
      },
      this.checkComplete,
    );
  };

  /**
   * checkComplete
   * checks to see if all inputs have been completed
   *
   */
  checkComplete = () => {
    console.log(this.state);
    if (
      this.state.site != 'Select Site:' &&
      this.state.groupName != '' &&
      this.state.group != '' &&
      ((this.state.useProfileGroup && this.state.profileGroup.length > 0) || this.state.profile != 'Select Profile:') &&
      this.state.numTasks > 0 &&
      (!this.state.requireLogin || (this.state.emailComplete && this.state.loginPass != '') || (this.state.useAccountPool && this.state.accountPool != '')) &&
      (!this.state.useAccountPool || this.state.accountPool !== '') &&
      this.state.monitorType != 'Select Monitor Type:' &&
      this.state.monitorInput.length > 0 &&
      this.state.sizes.length > 0 &&
      this.state.mode != 'Select Mode:' &&
      this.state.proxies != 'Select Proxy List:' &&
      this.state.monitorDelay >= 0 &&
      this.state.retryDelay >= 0 &&
      (!this.state.custom || this.state.customURL != '') &&
      (!this.state.useShippingRate || this.state.shippingRate !== '') &&
      (!this.state.isScheduled || this.state.scheduledTime !== '') &&
      (!this.state.requireSitePass || this.state.sitePass !== '')
    ) {
      this.setState({ completed: true });
    } else {
      this.setState({ completed: false });
      console.log('Not complete');
      console.log(this.state);
    }
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
    let k = this.state.monitorInput.length - 1;

    /* If they want to use all profiles, we will loop through all
			profiles */
    if (this.state.useProfileGroup) {
      j = 0;
    }

    let hasInputError = false;

    if (this.state.monitorType === 'keywords') {
      this.state.monitorInput.forEach((input) => {
        if (input.substring(1).includes('http')) {
          notifyMessage('Error', 'URL in Keyword! Use URL instead.', toastColors.red);
          this.setState({ completed: false });
          hasInputError = true;
          return;
        }
      });
    }
    if (this.state.monitorType === 'variant') {
      this.state.monitorInput.forEach((input) => {
        if (isNaN(input.substring(1))) {
          notifyMessage('Error', 'Variants not valid', toastColors.red);
          this.setState({ completed: false });
          hasInputError = true;
          return;
        }
      });
    }
    if (this.state.monitorType === 'url') {
      this.state.monitorInput.forEach((input) => {
        if (!input.substring(1).includes('http')) {
          notifyMessage('Error', 'URL not valid!', toastColors.red);
          this.setState({ completed: false });
          hasInputError = true;
          return;
        }
      });
    }

    if (hasInputError) return;

    if (this.state.monitorType === 'variant' || this.state.monitorType === 'url') {
      k = 0;
    }

    for (j; j < this.state.profileGroup.length; j += 1) {
      k = this.state.monitorInput.length - 1;
      if (this.state.monitorType === 'variant' || this.state.monitorType === 'url') {
        k = 0;
      }
      for (k; k < this.state.monitorInput.length; k += 1) {
        for (var i = 1; i <= this.state.numTasks; i += 1) {
          currentId = parseInt(currentId) + 1;
          const task = {
            id: currentId,
            siteType: this.state.mode === 'safe' ? 'shopify-safe' : 'shopify-advanced',
            site: this.state.custom ? this.state.customURL : this.state.site,
            siteName: this.state.siteName,
            profile: this.state.useProfileGroup ? this.state.profileGroup[j] : this.state.profile,
            email: this.state.loginEmail,
            password: this.state.loginPass,
            monitorInput: this.state.monitorType === 'keywords' ? this.state.monitorInput : this.state.monitorInput[k].substring(1),
            monitorType: this.state.monitorType,
            sizes: this.state.sizes,
            mode: this.state.mode,
            proxies: this.state.proxies,
            monitorDelay: this.state.monitorDelay,
            retryDelay: this.state.retryDelay,
            sendCheckout: this.state.sendCheckout,
            status: 'Idle',
            color: '#90a2cf',
            custom: this.state.custom,
            groupName: this.state.groupName,
            type: 'script',
            useAccountPool: this.state.useAccountPool,
            accountPool: this.state.accountPool,
            useShippingRate: this.state.useShippingRate,
            shippingRate: this.state.shippingRate,
            requireLogin: this.state.requireLogin,
            isScheduled: this.state.isScheduled,
            scheduledTime: this.state.scheduledTime,
            requireSitePass: this.state.requireSitePass,
            sitePass: this.state.sitePass,
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
    let hasInputError = false;

    if (this.state.monitorType === 'keywords') {
      this.state.monitorInput.forEach((input) => {
        if (input.substring(1).includes('http')) {
          notifyMessage('Error', 'URL in Keyword! Use URL instead.', toastColors.red);
          this.setState({ completed: false });
          hasInputError = true;
          return;
        }
      });
    }
    if (this.state.monitorType === 'variant') {
      this.state.monitorInput.forEach((input) => {
        if (isNaN(input.substring(1))) {
          notifyMessage('Error', 'Variants not valid', toastColors.red);
          this.setState({ completed: false });
          hasInputError = true;
          return;
        }
      });
    }
    if (this.state.monitorType === 'url') {
      this.state.monitorInput.forEach((input) => {
        if (!input.substring(1).includes('http')) {
          notifyMessage('Error', 'URL not valid!', toastColors.red);
          this.setState({ completed: false });
          hasInputError = true;
          return;
        }
      });
    }

    if (hasInputError) return;

    const task = {
      id: this.props.currentTasks[this.state.taskIndex].id,
      siteType: this.state.mode === 'safe' ? 'shopify-safe' : 'shopify-advanced',
      site: this.state.custom ? this.state.customURL : this.state.site,
      siteName: this.state.siteName,
      profile: this.state.profile,
      email: this.state.loginEmail,
      password: this.state.loginPass,
      monitorInput: this.state.monitorType === 'keywords' ? this.state.monitorInput : this.state.monitorInput[0].substring(1),
      monitorType: this.state.monitorType,
      sizes: this.state.sizes,
      mode: this.state.mode,
      proxies: this.state.proxies,
      monitorDelay: this.state.monitorDelay,
      retryDelay: this.state.retryDelay,
      sendCheckout: this.state.sendCheckout,
      custom: this.state.custom,
      groupName: this.state.groupName,
      type: 'script',
      useAccountPool: this.state.useAccountPool,
      accountPool: this.state.accountPool,
      useShippingRate: this.state.useShippingRate,
      shippingRate: this.state.shippingRate,
      requireLogin: this.state.requireLogin,
      isScheduled: this.state.isScheduled,
      scheduledTime: this.state.scheduledTime,
      requireSitePass: this.state.requireSitePass,
      sitePass: this.state.sitePass,
    };
    ipcRenderer.send('task-edited', task);
    this.props.editTask(task, this.state.taskIndex);
    this.setState({ completed: false });
    notifyMessage('Success', `Task has been updated!`, toastColors.blue);
    this.refs.leave.click();
  };

  loadTask = (task, taskIndex) => {
    let monitorInputValue = [];
    if (task.monitorType === 'url' || task.monitorType === 'variant') {
      monitorInputValue.push({ label: task.monitorInput, value: task.monitorInput, color: '#00f88b' });
    } else if (task.monitorType === 'keywords') {
      task.monitorInput.forEach((keyword) => {
        let color = '#00f88b';
        if (keyword.charAt(0) === '-') {
          color = '#ff3c5d';
        }
        monitorInputValue.push({ label: keyword.substring(1), value: keyword.substring(1), color });
      });
    }
    this.setState({
      editing: true,
      completed: false,
      taskIndex,
      monitorType: task.monitorType,
      monitorInputValue,
      monitorInput: task.monitorType === 'keywords' ? task.monitorInput : [`+${task.monitorInput}`],
      numTasks: 1,
      monitorDelay: task.monitorDelay,
      retryDelay: task.retryDelay,
      loginEmail: task.email,
      custom: task.custom,
      loginPass: task.password,
      site: task.custom ? 'custom_sh092' : task.site,
      customURL: task.custom ? task.site : '',
      siteName: task.siteName,
      groupName: task.groupName,
      profile: task.profile,
      sizes: task.sizes,
      mode: task.mode,
      proxies: task.proxies,
      requireLogin: task.email !== '' ? true : false,
      emailComplete: task.email !== '' ? true : false,
      useAccountPool: task.useAccountPool,
      accountPool: task.accountPool,
      useShippingRate: task.useShippingRate,
      shippingRate: task.shippingRate,
      isScheduled: task.isScheduled,
      scheduledTime: task.scheduledTime,
      requireSitePass: task.requireSitePass,
      sitePass: task.sitePass,
    });
  };

  componentDidMount() {
    let profiles = [];
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
      let proxyGroups = [{ label: 'localhost', value: 'localhost' }];
      sentProxies.forEach((group) => {
        proxyGroups.push({ value: group.proxyGroupName, label: group.proxyGroupName });
      });
      this.setState({ proxyGroups });
    });

    if (this.props.taskIndex !== null) {
      this.loadTask(this.props.currentTasks[this.props.taskIndex], this.props.taskIndex);
    }

    let accountPools = [];
    console.log(this.props.accountPools);
    this.props.accountPools.forEach((pool) => {
      accountPools.push({ label: pool.accountListName, value: pool.accounts });
    });
    let shippingRates = [];
    this.props.shippingRates.forEach((rate) => {
      shippingRates.push({ label: rate.name, value: rate.rate });
    });
    this.setState({ accountPools, shippingRates });
  }

  render() {
    return (
      <div className="createtask-form__wrapper">
        <div className="createtask-inputs__wrapper">
          <div className="createtask-inputs__section">
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Store</span>
                <Select
                  options={shopifySites}
                  styles={selectStyles}
                  onChange={(e) => this.handleSelectChange(e, 'site')}
                  value={shopifySites.filter((site) => site.value === this.state.site)}
                  placeholder="Select Site: "
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
            <div style={!this.state.custom ? { display: 'none' } : {}} className="input__full">
              <span className="input__text">Base URL</span>
              <input
                type="text"
                className="input"
                value={this.state.customURL}
                onChange={(e) => {
                  this.handleChange(e, 'siteName');
                  this.handleChange(e, 'customURL');
                }}
                placeholder="https://example.com"
              />
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
                <span className="input__text">Number of Tasks</span>
                <input type="text" className="input" value={this.state.numTasks} onChange={(e) => this.handleChange(e, 'numTasks')} disabled={this.state.editing} placeholder="1" />
              </div>
            </div>
            {this.state.useAccountPool ? (
              <div className="input__full">
                <div className="input__text">Account Pool</div>
                <Select
                  options={this.state.accountPools}
                  styles={selectStyles}
                  onChange={(e) => this.handleSelectChange(e, 'accountPool')}
                  value={this.state.accountPools.filter((pool) => pool.value === this.state.accountPool)}
                />
                <div className="error__text" />
              </div>
            ) : (
              <div className="input__split">
                <div className="input__half">
                  <span className="input__text">Login Email</span>
                  <input
                    type="text"
                    className={this.state.emailChanged ? (this.state.emailComplete ? 'input' : 'input incomplete') : 'input'}
                    ref="emailField"
                    value={this.state.loginEmail}
                    onChange={this.handleEmail}
                    placeholder="example@aol.com"
                    disabled={!this.state.requireLogin}
                  />
                </div>
                <div className="input__half">
                  <span className="input__text">Login Password</span>
                  <input type="text" className="input" value={this.state.loginPass} placeholder="Password" onChange={(e) => this.handleChange(e, 'loginPass')} disabled={!this.state.requireLogin} />
                </div>
              </div>
            )}
            <div className="input__full">
              <span className="input__text">Start Task At</span>
              <input type="datetime-local" className="input" step="1" disabled={!this.state.isScheduled} onChange={(e) => this.handleChange(e, 'scheduledTime')} />
              <div className="error__text"></div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input
                      type="checkbox"
                      className="form__switch--checkbox"
                      onChange={() => {
                        this.handleSwitchChange('requireLogin');
                      }}
                      checked={this.state.requireLogin}
                    />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Login</span>
                </div>
              </div>
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('useProfileGroup')} disabled={this.state.editing} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Profile Group</span>
                </div>
              </div>
            </div>
          </div>
          <div className="createtask-inputs__section">
            <div className="input__full">
              <span className="input__text">Input Type</span>
              <Select
                options={monitorTypes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSelectChange(e, 'monitorType');
                }}
                defaultValue={monitorTypes[0]}
                value={monitorTypes.filter((type) => type.value === this.state.monitorType)}
              />
            </div>
            <div className="input__full">
              <span className="input__text">{this.state.monitorType === 'variant' ? 'Variants' : this.state.monitorType === 'url' ? 'URLs' : 'Keywords'}</span>
              <CreatableSelect
                components={keywordsComponents}
                inputValue={this.state.monitorValue}
                onChange={this.handleKeywordsUpdate}
                onInputChange={this.handleKeywordsChange}
                onKeyDown={this.handleKeyDown}
                value={this.state.monitorInputValue}
                styles={keywordsStyles}
                placeholder={this.state.monitorType === 'variants' ? 'Variants' : this.state.monitorType === 'url' ? 'URLs' : 'Keywords'}
                menuIsOpen={false}
                isClearable
                isMulti
              />
            </div>
            <div className="input__full">
              <span className="input__text">Size(s)</span>
              <Select
                options={shopifySizes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSizeChange(e);
                }}
                value={shopifySizes.filter((size) => this.state.sizes.includes(size.value))}
                placeholder="Select Size(s):"
                isSearchable
                isMulti
                backspaceRemovesValue
                closeMenuOnSelect={false}
              />
            </div>
            <div className="input__full">
              <span className="input__text">Site Password</span>
              <input type="text" className="input" value={this.state.sitePass} placeholder="Password" onChange={(e) => this.handleChange(e, 'sitePass')} disabled={!this.state.requireSitePass} />
              <span className="error__text"></span>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('requireSitePass')} checked={this.state.requireSitePass} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Password Release</span>
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
          <div className="createtask-inputs__section">
            <div className="input__full">
              <span className="input__text">Mode</span>
              <Select
                options={ShopifyModes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSelectChange(e, 'mode');
                }}
                value={ShopifyModes.filter((mode) => mode.value === this.state.mode)}
                placeholder="Select Mode:"
              />
            </div>
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Monitor Delay</span>
                <input type="text" className="input" value={this.state.monitorDelay} onChange={(e) => this.handleChange(e, 'monitorDelay')} placeholder="2500" />
              </div>
              <div className="input__half">
                <span className="input__text">Retry Delay</span>
                <input type="text" className="input" value={this.state.retryDelay} onChange={(e) => this.handleChange(e, 'retryDelay')} placeholder="500" />
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <span className="input__text">Shipping Rate</span>
                <Select
                  options={this.state.shippingRates}
                  styles={this.state.useShippingRate ? selectStyles : disabledSelect}
                  onChange={(e) => this.handleSelectChange(e, 'shippingRate')}
                  value={this.state.shippingRates.filter((rate) => rate.value === this.state.shippingRate)}
                  placeholder="Select Rate:"
                  isDisabled={!this.state.useShippingRate}
                />
                <span className="error__text"></span>
              </div>
              <div className="input__half">
                <span className="input__text">Proxy Group</span>
                <Select
                  options={this.state.proxyGroups}
                  styles={selectStyles}
                  onChange={(e) => this.handleSelectChange(e, 'proxies')}
                  value={this.state.proxyGroups.filter((group) => group.value === this.state.proxies)}
                  placeholder="Select Proxy List:"
                />
                <span className="error__text"></span>
              </div>
            </div>
            <div className="input__split">
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input type="checkbox" className="form__switch--checkbox" onChange={() => this.handleSwitchChange('useShippingRate')} />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Shipping Rate</span>
                </div>
              </div>
              <div className="input__half">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input
                      type="checkbox"
                      className="form__switch--checkbox"
                      onChange={() => {
                        this.handleSwitchChange('useAccountPool');
                      }}
                      checked={this.state.useAccountPool}
                    />
                    <span className="form__switch"></span>
                  </label>
                  <span className="switch__text">Use Account Pool</span>
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
    taskGroups: state.tasks.groups,
    profileGroups: state.profiles.profileGroups,
    accountPools: state.tools.accountPools,
    shippingRates: state.tools.shippingRates,
  };
};

export default connect(mapStateToProps, actions)(Shopify);
