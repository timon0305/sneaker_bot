import React from 'react';
import Select from 'react-select';
import { ipcRenderer } from 'electron';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

import { shopifySites } from './creationComponents/SelectOptions';
import { selectStyles } from './creationComponents/SelectStyles';

import { notifyMessage, toastColors } from '../components/micro/Toaster';

import '../styles/Tools.scss';
import Button from '../components/micro/Button';
import EditModal from '../components/EditModal';
import QTModal from '../components/QTModal';

class Tools extends React.Component {
  state = {
    profiles: [],
    accountListName: '',
    accountSite: '',
    accounts: '',
    accountsReady: false,
    editingList: false,
    listIndex: -1,
    shippingRateName: '',
    shippingSite: '',
    shippingProfile: '',
    shippingURL: '',
    useCustom: false,
    customRate: '',
    shippingReady: false,
    editingRate: false,
    rateIndex: -1,
  };

  componentDidMount() {
    let profiles = [];
    this.props.currentProfileNames.forEach((profile) => {
      profiles.push({ value: profile, label: profile });
    });
    this.setState({ profiles });
    console.log(this.props);
  }

  handleChange = (e, toUpdate) => {
    this.setState({ [toUpdate]: e.target.value }, this.checkComplete);
  };

  handleSelect = (e, toUpdate) => {
    this.setState({ [toUpdate]: e.value }, this.checkComplete);
  };

  checkComplete = () => {
    const { accountListName, accountSite, accounts } = this.state;
    if (accountListName !== '' && accountSite !== '' && accounts !== '') {
      this.setState({ accountsReady: true });
    } else {
      this.setState({ accountsReady: false });
    }

    const { shippingRateName, shippingSite, shippingProfile, shippingURL, useCustom, customRate } = this.state;
    if (shippingRateName !== '' && ((shippingProfile !== '' && shippingURL !== '' && shippingSite !== '') || (useCustom && customRate !== ''))) {
      this.setState({ shippingReady: true });
    } else {
      this.setState({ shippingReady: false });
    }
  };

  loadAccountList = (index) => {
    let accounts = '';
    if (index !== null) {
      this.props.accountPools[index].accounts.forEach((account) => {
        accounts += account + '\n';
      });
      this.setState({
        accountListName: this.props.accountPools[index].accountListName,
        accountSite: this.props.accountPools[index].accountSite,
        accounts,
        accountsReady: false,
        editingList: true,
        listIndex: index,
      });
    } else {
      this.setState({
        accountListName: '',
        accountSite: '',
        accounts,
        accountsReady: false,
        editingList: false,
        listIndex: -1,
      });
    }
  };

  deletePool = () => {
    ipcRenderer.send('deleteAccountList', this.state.listIndex);
    this.setState({
      accountListName: '',
      accountSite: '',
      accounts: '',
      accountsReady: false,
      editingList: false,
      listIndex: -1,
    });
  };

  saveAccounts = () => {
    const { accountListName, accountSite } = this.state;
    const accounts = this.state.accounts.split('\n');
    if (this.state.editingList) {
      ipcRenderer.send('editAccountList', this.state.listIndex, { accountListName, accountSite, accounts });
    } else {
      ipcRenderer.send('addAccountList', { accountListName, accountSite, accounts });
    }
    this.setState({ accountsReady: false });
  };

  loadRate = (index) => {
    if (index !== null) {
      this.setState({
        useCustom: true,
        shippingRateName: this.props.shippingRates[index].name,
        customRate: this.props.shippingRates[index].rate,
        editingRate: true,
        rateIndex: index,
      });
    } else {
      this.setState({
        useCustom: false,
        customRate: '',
        shippingRateName: '',
        shippingSite: '',
        shippingProfile: '',
        shippingURL: '',
        editingRate: false,
        rateIndex: -1,
      });
    }
  };

  deleteRate = () => {
    ipcRenderer.send('deleteShippingRate', this.state.rateIndex);
    this.setState({
      useCustom: false,
      customRate: '',
      shippingRateName: '',
      shippingSite: '',
      shippingProfile: '',
      shippingURL: '',
      editingRate: false,
      rateIndex: -1,
    });
  };

  saveRate = () => {
    const { shippingRateName, shippingSite, shippingProfile, shippingURL, useCustom, customRate, editingRate, rateIndex } = this.state;
    if (editingRate) {
      ipcRenderer.send('editShippingRate', rateIndex, {
        shippingRateName,
        customRate,
      });
    } else {
      notifyMessage('Adding Rate', 'Grabbing new shipping rate...', toastColors.blue);
      ipcRenderer.send('addShippingRate', {
        shippingRateName,
        shippingSite,
        shippingProfile,
        shippingURL,
        useCustom,
        customRate,
      });
    }
  };

  render() {
    return (
      <>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        {this.props.qtOpen ? <QTModal qtOpen={this.props.qtOpen} qtClose={this.props.qtClose} /> : <></>}
        <div className={`page__content ${this.props.editOpen || this.props.qtOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Tools</h1>
          </div>
          <div className="tools__wrapper">
            <div className="tools__section">
              <h2>Account Pools</h2>
              <div className="tools__container">
                <div className="list__select">
                  <h3>Account List</h3>
                  <div onClick={() => this.loadAccountList(null)} className={this.state.editingList ? 'list__item' : 'list__item selected'}>
                    Create
                  </div>
                  {this.props.accountPools.map((pool, i) => (
                    <div onClick={() => this.loadAccountList(i)} className={this.state.listIndex === i ? 'list__item selected' : 'list__item'}>
                      {pool.accountListName}
                    </div>
                  ))}
                </div>
                <div className="list__form">
                  <div>
                    <div className="input__split">
                      <div className="input__half">
                        <span className="input__text">List Name</span>
                        <input
                          type="text"
                          className="input"
                          placeholder="My account list"
                          onChange={(e) => {
                            this.handleChange(e, 'accountListName');
                          }}
                          value={this.state.accountListName}
                        />
                      </div>
                      <div className="input__half">
                        <span className="input__text">Site</span>
                        <Select
                          options={shopifySites.slice(1)}
                          styles={selectStyles}
                          placeholder="Select Site:"
                          onChange={(e) => {
                            this.handleSelect(e, 'accountSite');
                          }}
                          value={shopifySites.filter((site) => site.value === this.state.accountSite)}
                        />
                      </div>
                    </div>
                    <div className="accounts__textbox__wrapper">
                      <span className="input__text">Accounts (email:pass)</span>
                      <textarea
                        placeholder="john@gmail.com:password1234"
                        className="proxies__textbox"
                        onChange={(e) => {
                          this.handleChange(e, 'accounts');
                        }}
                        value={this.state.accounts}
                      />
                    </div>
                  </div>
                  <div className="ct-buttons__wrapper">
                    <div />
                    <div className="flex--right">
                      {this.state.editingList ? <Button icon={null} text="Delete List" clickFunction={this.deletePool} color={'red'} /> : <></>}
                      <Button icon={null} text="Save List" clickFunction={this.state.accountsReady ? this.saveAccounts : () => {}} color={this.state.accountsReady ? 'green' : 'green disabled'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="tools__section">
              <h2>Shipping Rates</h2>
              <div className="tools__container">
                <div className="list__select">
                  <h3>Rate</h3>
                  <div onClick={() => this.loadRate(null)} className={this.state.editingRate ? 'list__item list__item-create' : 'list__item selected-create'}>
                    Create
                  </div>
                  {this.props.shippingRates.map((rate, i) => (
                    <div onClick={() => this.loadRate(i)} className={this.state.rateIndex === i ? 'list__item selected' : 'list__item'}>
                      {rate.name}
                    </div>
                  ))}
                </div>
                <div className="list__form">
                  <div>
                    <div className="input__full">
                      <span className="input__text">Rate Name</span>
                      <input
                        type="text"
                        className="input"
                        placeholder="Undefeated Rate"
                        onChange={(e) => {
                          this.handleChange(e, 'shippingRateName');
                        }}
                        value={this.state.shippingRateName}
                      />
                    </div>
                    {this.state.useCustom ? (
                      <div className="input__full">
                        <span className="input__text">Shipping Rate</span>
                        <input
                          type="text"
                          className="input"
                          placeholder="https://myshopify.com/products/example"
                          onChange={(e) => {
                            this.handleChange(e, 'customRate');
                          }}
                          value={this.state.customRate}
                        />
                        <div className="error__text" />
                      </div>
                    ) : (
                      <>
                        <div className="input__split">
                          <div className="input__half">
                            <span className="input__text">Site</span>
                            <Select
                              options={shopifySites.slice(1)}
                              styles={selectStyles}
                              placeholder="Select Site:"
                              onChange={(e) => {
                                this.handleSelect(e, 'shippingSite');
                              }}
                              value={shopifySites.filter((site) => site.value === this.state.shippingSite)}
                            />
                          </div>
                          <div className="input__half">
                            <span className="input__text">Profile</span>
                            <Select
                              options={this.state.profiles}
                              styles={selectStyles}
                              onChange={(e) => {
                                this.handleSelect(e, 'shippingProfile');
                              }}
                              value={this.state.profiles.filter((profile) => profile.value === this.state.shippingProfile)}
                            />
                          </div>
                        </div>
                        <div className="input__full">
                          <span className="input__text">Product URL</span>
                          <input
                            type="text"
                            className="input"
                            placeholder="https://myshopify.com/products/example"
                            onChange={(e) => {
                              this.handleChange(e, 'shippingURL');
                            }}
                            value={this.state.shippingURL}
                          />
                          <div className="error__text" />
                        </div>
                      </>
                    )}
                    <div className="input__split">
                      {this.state.editingRate ? (
                        <div className="input__half" />
                      ) : (
                        <div className="input__half">
                          <div className="switch__wrapper">
                            <label className="form__switch--back">
                              <input type="checkbox" className="form__switch--checkbox" onChange={() => this.setState({ useCustom: !this.state.useCustom })} />
                              <span className="form__switch" />
                            </label>
                            <span className="switch__text">Enter Rate Manually</span>
                          </div>
                        </div>
                      )}
                      <div className="input__half" />
                    </div>
                  </div>
                  <div>
                    <div className="ct-buttons__wrapper">
                      <div />
                      <div className="flex--right">
                        {this.state.editingRate ? <Button icon={null} text="Delete Rate" clickFunction={this.deleteRate} color="red" /> : <></>}
                        <Button icon={null} text="Save Rate" clickFunction={this.state.shippingReady ? this.saveRate : () => {}} color={this.state.shippingReady ? 'green' : 'green disabled'} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
const mapStateToProps = (state) => {
  return {
    currentProfileNames: state.profiles.currentProfileNames,
    accountPools: state.tools.accountPools,
    shippingRates: state.tools.shippingRates,
  };
};

export default connect(mapStateToProps, actions)(Tools);
