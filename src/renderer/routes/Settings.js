/* eslint-disable max-len */
import React from 'react';
import { ipcRenderer } from 'electron';

import Select from 'react-select';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

import { selectStyles } from './creationComponents/SelectStyles';
import { sizes } from './creationComponents/SelectOptions';

import { version as novaVersion } from '../../../package.json';

import EditModal from '../components/EditModal';
import Button from '../components/micro/Button';
import { notifyMessage, toastColors } from '../components/micro/Toaster';
import '../styles/Settings.scss';

import dashboardIcon from '../assets/actions/dashboard.svg';
import updateIcon from '../assets/actions/update.svg';
import updateGreenIcon from '../assets/actions/updateGreen.svg';
import updateRedIcon from '../assets/actions/updateRed.svg';
import deactivateIcon from '../assets/actions/deactivate.svg';
import saveIcon from '../assets/actions/save.svg';
import discordIcon from '../assets/otherIcons/discord.svg';
import infoIcon from '../assets/otherIcons/info.svg';
import showIcon from '../assets/actions/show.svg';
import hideIcon from '../assets/actions/hide.svg';
import closeIcon from '../assets/actions/close.svg';

import QTModal from '../components/QTModal';

const premeRegions = [
  { label: 'US', value: 'US' },
  { label: 'EU', value: 'EU' },
  { label: 'JP', value: 'JP' },
];

// eslint-disable-next-line react/prefer-stateless-function
class Settings extends React.Component {
  state = {
    logOpen: false,
    logId: '',
    key: '',
    avatar: '',
    username: '',
    webhook: '',
    sendDeclines: true,
    useProfileGroup: false,
    proxyGroups: [],
    profiles: [],
    qtSizes: [],
    qtProfiles: [],
    qtMonitorDelay: 2500,
    qtCheckoutDelay: 1500,
    qtProxyList: '',
    qtNumTasks: 5,
    qtSupremeRegion: 'US',
    qtShippingRate: '',
    shippingRates: [],
    changed: false,
    asAccessToken: '',
    asAPIkey: '',
    useAutoSolve: false,
    tab: 'qt',
    updating: false,
    checkingUpdate: false,
    updateMessage: 'Check for Updates',
    updateColor: 'blue',
    timeoutId: null,
    saveMessage: '',
  };

  openLog = () => {
    this.setState({ logOpen: !this.state.logOpen });
  };

  handleChange = (e, toUpdate) => {
    this.setState({ [toUpdate]: e.target.value, changed: true });
    if (this.state.timeoutId) clearTimeout(this.state.timeoutId);
    const timeoutId = setTimeout(() => {
      this.saveSettings();
    }, 750);
    this.setState({ timeoutId });
  };

  saveSettings = () => {
    console.log('Saving');
    this.setState({ saveMessage: 'Autosaving...' });
    const { webhook, sendDeclines, qtSizes, qtProfiles, qtMonitorDelay, qtCheckoutDelay, qtProxyList, qtNumTasks, qtSupremeRegion, qtShippingRate, asAccessToken, asAPIkey, useAutoSolve } = this.state;
    ipcRenderer.send('set-settings', {
      webhook,
      sendDeclines,
      qtSizes,
      qtProfiles,
      qtMonitorDelay,
      qtCheckoutDelay,
      qtProxyList,
      qtNumTasks,
      qtSupremeRegion,
      qtShippingRate,
      asAccessToken,
      asAPIkey,
      useAutoSolve,
    });
    this.setState({ changed: false });
    // notifyMessage('Saved', 'Settings have been saved successfully', toastColors.blue);
  };

  sendTest = () => {
    if (this.state.webhook == '' || !this.state.webhook) {
      notifyMessage('No Webhook Found', 'Please enter a webhook before testing!', toastColors.red);
      return;
    }
    ipcRenderer.send('send-test', this.state.webhook);
    notifyMessage('Webhook Sent', "Check your webhook's target channel!", toastColors.blue);
  };

  /**
   * handles sizes array (since all other input are only single value)
   *
   * @param {any} e - the event the onChange is being called by
   */
  handleSizeChange = (e) => {
    const qtSizes = [];
    if (e != null) {
      e.forEach((size) => {
        qtSizes.push(size.value);
      });
    }
    this.setState({ qtSizes, changed: true });
    if (this.state.timeoutId) clearTimeout(this.state.timeoutId);
    const timeoutId = setTimeout(() => {
      this.saveSettings();
    }, 750);
    this.setState({ timeoutId });
  };

  handleProfileChange = (e) => {
    let qtProfiles = [];
    if (this.state.useProfileGroup) {
      qtProfiles = e.value;
    } else {
      qtProfiles.push(e.value);
    }
    this.setState({ qtProfiles, changed: true });
    if (this.state.timeoutId) clearTimeout(this.state.timeoutId);
    const timeoutId = setTimeout(() => {
      this.saveSettings();
    }, 750);
    this.setState({ timeoutId });
  };

  handleSelectChange = (e, toUpdate) => {
    this.setState({
      [toUpdate]: e.value,
      changed: true,
    });
    if (this.state.timeoutId) clearTimeout(this.state.timeoutId);
    const timeoutId = setTimeout(() => {
      this.saveSettings();
    }, 750);
    this.setState({ timeoutId });
  };

  checkForUpdates = () => {
    if (this.state.checkingUpdate || this.state.updating) return;
    this.setState({
      checkingUpdate: true,
      updateMessage: 'Checking for Updates...',
    });
    ipcRenderer.send('checkForUpdates');
  };
  viewLogs = () => {
    ipcRenderer.send('view-logs');
  };

  componentDidMount() {
    /*  AUTO UPDATER */

    ipcRenderer.on('update:reset', () => {
      this.setState({
        updating: false,
        checkingUpdate: false,
        updateMessage: 'Check for Updates',
        updateColor: 'blue',
      });
    });

    ipcRenderer.on('update:avail', () => {
      setTimeout(() => {
        this.setState({
          updateMessage: 'New Update Found!',
          updateColor: 'green',
          checkingUpdate: false,
        });
      }, 1000);
    });

    ipcRenderer.on('update:downloading', () => {
      this.setState({
        updating: true,
        updateMessage: 'Downloading...',
        updateColor: 'blue',
      });
    });

    ipcRenderer.on('update:downloaded', () => {
      this.setState({
        updateMessage: 'Update Downloaded!',
        updateColor: 'green',
      });
    });

    ipcRenderer.on('update:not-avail', () => {
      setTimeout(() => {
        this.setState({
          updateMessage: "You're up to date!",
          updateColor: 'blue',
        });
        setTimeout(() => {
          this.setState({
            updateMessage: 'Check for Updates',
            checkingUpdate: false,
            updating: false,
          });
        }, 1500);
      }, 1000);
    });

    ipcRenderer.on('update:anerror', () => {
      setTimeout(() => {
        this.setState({
          updateMessage: 'Checking Update Error',
          updateColor: 'red',
        });
        setTimeout(() => {
          this.setState({
            updateMessage: 'Check for Updates',
            updateColor: 'blue',
            checkingUpdate: false,
            updating: false,
          });
        }, 1500);
      }, 2000);
    });

    ipcRenderer.on('update:percent', (e, arg) => {
      this.setState({
        updateMessage: `Downloading... ${arg}%`,
      });
    });

    ipcRenderer.on('send-autosave', () => {
      this.setState(
        {
          saveMessage: 'Saved.',
        },
        () => {
          setTimeout(() => {
            this.setState({ saveMessage: '' });
          }, 1000);
        },
      );
    });

    ipcRenderer.send('get-settings');
    ipcRenderer.on('sendSettings', (e, settings) => {
      console.log(settings);
      const license = settings.key || 'DEV-ENVIRONMENT';
      this.setState({
        webhook: settings.webhook,
        sendDeclines: settings.sendDeclines,
        qtProfiles: settings.qtProfiles,
        qtSizes: settings.qtSizes,
        qtMonitorDelay: settings.qtMonitorDelay,
        qtCheckoutDelay: settings.qtCheckoutDelay,
        qtProxyList: settings.qtProxyList,
        qtNumTasks: settings.qtNumTasks,
        qtSupremeRegion: settings.qtSupremeRegion,
        qtShippingRate: settings.qtShippingRate,
        asAccessToken: settings.asAccessToken,
        asAPIkey: settings.asAPIkey,
        useAutoSolve: settings.useAutoSolve,
        key: license,
        avatar: settings.userAvatar,
        username: settings.username,
      });
    });

    const profiles = [];
    this.props.currentProfileNames.forEach((profile) => {
      profiles.push({ value: profile, label: profile });
    });
    this.setState({ profiles });

    ipcRenderer.send('get-proxies');
    ipcRenderer.on('sendProxies', (e, sentProxies) => {
      const proxyGroups = [{ label: 'localhost', value: 'localhost' }];
      sentProxies.forEach((group) => {
        proxyGroups.push({ value: group.proxyGroupName, label: group.proxyGroupName });
      });
      this.setState({ proxyGroups });
    });

    const shippingRates = [];
    this.props.shippingRates.forEach((rate) => {
      shippingRates.push({ label: rate.name, value: rate.rate });
    });
    this.setState({ shippingRates });
  }

  sendLogs = () => {
    console.log('Sending logs...');
    const logId = Math.floor(100000 + Math.random() * 900000);
    this.setState({ logId });
    ipcRenderer.send('send-logs', logId);
    this.openLog();
  };

  render() {
    return (
      <>
        <div className={`edit__modal__wrapper ${this.state.logOpen ? 'show' : ''}`}>
          <div className="log__modal">
            <div className="edit__modal__header">
              <h3 />
              <div className="button--round light" onClick={() => this.openLog()}>
                <img src={closeIcon} alt="" className="button--round__image" />
              </div>
            </div>
            <div className="log__info">
              <div className="log__title">
                The Log ID below has been <span className="bold">copied to your clipboard.</span> Use this Log ID when creating your ticket.
              </div>
              <div className="log__id">{this.state.logId}</div>
            </div>
          </div>
        </div>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        <QTModal qtOpen={this.props.qtOpen} qtClose={this.props.qtClose} />
        <div className={`page__content ${this.props.editOpen || this.props.qtOpen || this.state.logOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Settings</h1>
          </div>
          <div className="profile__info">
            <div className="profile-image__wrapper">
              <img src={this.state.avatar} alt="" className="profile__image" />
            </div>
            <div className="profile-text__wrapper">
              <span className="profile-text--light">Welcome</span>
              <div className="profile-text--main">{this.state.username}</div>
            </div>
            <div className="profile-text__wrapper">
              <span className="profile-text--light">License Type</span>
              <div className="profile-text--main">Renewal</div>
            </div>
            <div className="profile-text__wrapper">
              <span className="profile-text--light">License Key</span>
              <div className="profile-text--main">
                <span className={this.props.showKey ? '' : 'blur-text'}>{this.state.key}</span>
                <img src={this.props.showKey ? hideIcon : showIcon} alt="" className="hide-key" onClick={() => this.props.hideKey()} />
              </div>
            </div>
            <div className="flex--right">
              <Button
                clickFunction={() => {
                  ipcRenderer.send('open-dash');
                }}
                color="blue"
                text="Dashboard"
                icon={dashboardIcon}
              />
              <Button
                clickFunction={() => {
                  ipcRenderer.send('deactivate');
                }}
                color="red"
                text="Deactivate"
                icon={deactivateIcon}
              />
            </div>
          </div>
          <div className="flex--between">
            <div className="settings-section__wrapper">
              <h2>Webhooks</h2>
              <div className="input__full">
                <span className="input__text">Discord Webhook</span>
                <div className="webhook__input__wrapper">
                  <img src={discordIcon} alt="" className="webhook__image" />
                  <input type="text" placeholder="Paste Webhook Here" className="webhook__input" value={this.state.webhook} onChange={(e) => this.handleChange(e, 'webhook')} />
                </div>
              </div>
              <div className="flex--between">
                <div className="switch__wrapper">
                  <label className="form__switch--back">
                    <input
                      type="checkbox"
                      className="form__switch--checkbox"
                      checked={!this.state.sendDeclines}
                      onChange={() => this.setState({ sendDeclines: !this.state.sendDeclines, changed: true })}
                    />
                    <span className="form__switch" />
                  </label>
                  <span className="switch__text">Don't Send Declines</span>
                </div>
                <Button clickFunction={this.sendTest} color="green" text="Send Test" icon={null} />
              </div>
              <h2>Version</h2>
              <div className="version__wrapper">
                <div className="flex--right">
                  <img src={infoIcon} alt="" className="version__image" />
                  <span className="version-text--light">Bot Version</span>
                  <span className="version-text">{novaVersion}</span>
                </div>
                <Button
                  clickFunction={() => {
                    this.checkForUpdates();
                  }}
                  color={this.state.updateColor}
                  disabled={!!(this.state.checkingUpdate || this.state.updating)}
                  className="flex--right update__button"
                  text={this.state.updateMessage}
                  icon={this.state.updateColor == 'blue' ? updateIcon : this.state.updateColor === 'green' ? updateGreenIcon : updateRedIcon}
                />
              </div>
            </div>
            <div className="settings-section__split">
              <div className="settings-tabs">
                <div onClick={() => this.setState({ tab: 'qt' })} className={`settings-tab left ${this.state.tab === 'qt' ? 'selected' : ''}`}>
                  Quicktasks
                </div>
                <div onClick={() => this.setState({ tab: 'as' })} className={`settings-tab right ${this.state.tab === 'as' ? 'selected' : ''}`}>
                  Autosolve
                </div>
              </div>
              <div className={`split__wrapper ${this.state.tab == 'qt' ? 'active' : ''}`}>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">Size(s)</span>
                    <Select
                      options={sizes}
                      value={sizes.filter((size) => this.state.qtSizes.includes(size.value))}
                      styles={selectStyles}
                      onChange={(e) => this.handleSizeChange(e)}
                      placeholder="Select Sizes:"
                      isMulti
                      isSearchable
                    />
                  </div>
                  <div className="input__half">
                    <span className="input__text">{`Profile ${this.state.useProfileGroup ? 'Group' : ''}`}</span>
                    <Select
                      options={this.state.useProfileGroup ? this.props.profileGroups : this.state.profiles}
                      value={
                        this.state.useProfileGroup
                          ? this.props.profileGroups.filter((group) => this.state.qtProfiles === group.value)
                          : this.state.profiles.filter((profile) => this.state.qtProfiles[0] === profile.label)
                      }
                      onChange={(e) => this.handleProfileChange(e)}
                      styles={selectStyles}
                      placeholder={this.state.useProfileGroup ? 'Select Profile Group:' : 'Select Profile:'}
                      isSearchable
                    />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__third">
                    <span className="input__text">Monitor Delay</span>
                    <input type="text" className="input" placeholder="2500" onChange={(e) => this.handleChange(e, 'qtMonitorDelay')} value={this.state.qtMonitorDelay} />
                  </div>
                  <div className="input__third">
                    <span className="input__text">Checkout Delay</span>
                    <input type="text" className="input" placeholder="1500" onChange={(e) => this.handleChange(e, 'qtCheckoutDelay')} value={this.state.qtCheckoutDelay} />
                  </div>
                  <div className="input__third">
                    <span className="input__text">Number of Tasks</span>
                    <input type="text" className="input" placeholder="1500" onChange={(e) => this.handleChange(e, 'qtNumTasks')} value={this.state.qtNumTasks} />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__third">
                    <span className="input__text">Proxy Group</span>
                    <Select
                      options={this.state.proxyGroups}
                      value={this.state.proxyGroups.filter((group) => group.value === this.state.qtProxyList)}
                      onChange={(e) => this.handleSelectChange(e, 'qtProxyList')}
                      placeholder="Select Proxy Group:"
                      styles={selectStyles}
                      isSearchable
                    />
                  </div>
                  <div className="input__third">
                    <span className="input__text">Shipping Rate</span>
                    <Select
                      options={this.state.shippingRates}
                      value={this.state.shippingRates.filter((rate) => rate.value === this.state.qtShippingRate)}
                      onChange={(e) => this.handleSelectChange(e, 'qtShippingRate')}
                      styles={selectStyles}
                      isSearchable
                    />
                    <span className="error__text" />
                  </div>
                  <div className="input__third">
                    <span className="input__text">Supreme Region</span>
                    <Select
                      options={premeRegions}
                      value={premeRegions.filter((region) => region.label === this.state.qtSupremeRegion)}
                      onChange={(e) => this.handleSelectChange(e, 'qtSupremeRegion')}
                      styles={selectStyles}
                      isSearchable
                    />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__half">
                    <div className="switch__wrapper">
                      <label className="form__switch--back">
                        <input
                          type="checkbox"
                          className="form__switch--checkbox"
                          checked={this.state.useProfileGroup}
                          onChange={() => this.setState({ useProfileGroup: !this.state.useProfileGroup })}
                        />
                        <span className="form__switch" />
                      </label>
                      <span className="switch__text">Use Profile Group</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`split__wrapper ${this.state.tab == 'as' ? 'active' : ''}`}>
                <div className="input__full">
                  <span className="input__text">AutoSolve Access Token</span>
                  <input type="text" className="input" placeholder="XXXX-XXXX-XXXX-XXXX" onChange={(e) => this.handleChange(e, 'asAccessToken')} value={this.state.asAccessToken} />
                </div>
                <div className="input__full">
                  <span className="input__text">AutoSolve API Key</span>
                  <input type="text" className="input" placeholder="XXXX-XXXX-XXXX-XXXX" onChange={(e) => this.handleChange(e, 'asAPIkey')} value={this.state.asAPIkey} />
                  <div className="error__text" />
                </div>
                <div className="input__split">
                  <div className="switch__wrapper">
                    <label className="form__switch--back">
                      <input
                        type="checkbox"
                        className="form__switch--checkbox"
                        checked={!this.state.useAutoSolve}
                        onChange={() => {
                          this.setState({ useAutoSolve: !this.state.useAutoSolve, changed: true });
                          ipcRenderer.send('toggle-aycd');
                        }}
                      />
                      <span className="form__switch" />
                    </label>
                    <span className="switch__text">Use Autosolve</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="ct-buttons__wrapper">
            <div className="saving__text">{this.state.saveMessage}</div>
            <div className="flex--right">
              {/*<Button clickFunction={this.sendLogs} color="blue" text="Send Logs" icon={null} />*/}
              <Button clickFunction={this.state.changed ? this.saveSettings : () => {}} color={this.state.changed ? 'green' : 'green disabled'} text="Save" icon={saveIcon} />
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
  currentProfileNames: state.profiles.currentProfileNames,
  profileGroups: state.profiles.profileGroups,
  shippingRates: state.tools.shippingRates,
  showKey: state.tools.showKey,
});

export default connect(mapStateToProps, actions)(Settings);
