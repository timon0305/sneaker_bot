/* eslint-disable react/state-in-constructor */
import React from 'react';
import { ipcRenderer } from 'electron';
import { NavLink as Link } from 'react-router-dom';

import validator from 'card-validator';

import Button from '../components/micro/Button';
import EditModal from '../components/EditModal';
import { notifyMessage, toastColors } from '../components/micro/Toaster';

import '../styles/Profiles.scss';

/* React-select dependencies */
import Select from 'react-select';
import countryRegions from './creationComponents/CountryOptions';
import { selectStyles, disabledSelect } from './creationComponents/SelectStyles';

/* Action icons for profile actions */
import createIcon from '../assets/actions/create_green.svg';
import backIcon from '../assets/actions/back.svg';
import saveIcon from '../assets/actions/save.svg';

/* Credit Card Icons */
import Tilt from 'react-tilt';
import amexIcon from '../assets/cardIcons/amex.svg';
import discoverIcon from '../assets/cardIcons/discover.svg';
import mastercardIcon from '../assets/cardIcons/mastercard.svg';
import visaIcon from '../assets/cardIcons/visa.svg';
import dinersIcon from '../assets/cardIcons/diners.png';
import jcbIcon from '../assets/cardIcons/jcb.svg';
import ccChip from '../assets/cardIcons/chip.svg';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

const tiltOptions = {
  reverse: true, // reverse the tilt direction
  max: 35, // max tilt rotation (degrees)
  perspective: 1000, // Transform perspective, the lower the more extreme the tilt gets.
  scale: 1, // 2 = 200%, 1.5 = 150%, etc..
  speed: 600, // Speed of the enter/exit transition
  transition: true, // Set a transition on enter/exit.
  axis: null, // What axis should be disabled. Can be X or Y.
  reset: true, // If the tilt effect has to be reset on exit.
  easing: 'cubic-bezier(.03,.98,.52,.99)', // Easing on enter/exit.
};

class ProfileCreation extends React.Component {
  state = {
    profile: {
      profilename: '',
      email: '',
      phone: '',
      firstname: '',
      lastname: '',
      shipping: {
        address: '',
        apt: '',
        city: '',
        country: 'United States',
        countrycode: 'US',
        state: 'AL',
        zip: '',
      },
      billing: {
        address: '',
        apt: '',
        city: '',
        country: 'United States',
        countrycode: 'US',
        state: 'AL',
        zip: '',
      },
      cardholdername: '',
      cardnumber: '',
      cvv: '',
      expdate: '',
      usebilling: false,
      useonce: false,
      cardtype: '',
    },
    emailChanged: false,
    emailComplete: false,
    cardDateChanged: false,
    cardDateValid: false,
    cvvChanged: false,
    cvvValid: false,
    ccChanged: false,
    ccValid: false,
    completed: false,
    shippingStates: countryRegions[234].regions,
    billingStates: countryRegions[234].regions,
    shippingState: { label: 'Alabama', value: 'AL' },
    billingState: { label: 'Alabama', value: 'AL' },
    cardIcon: visaIcon,
    editing: false,
    profileIndex: null,
    errortext: null,
  };

  /**
   * handles changes for inputs and updates state
   *
   * @param {any} e - The event the onChange is being called by
   * @param {string} toUpdate - The state to update
   */
  handleChange = (e, toUpdate) => {
    if (toUpdate === 'cvv' || toUpdate === 'cardnumber' || toUpdate === 'expdate') {
      if (isNaN(e.target.value)) return;
    }
    let newVal = e.target.value;
    this.setState(
      (prevState) => ({
        profile: {
          ...prevState.profile,
          [toUpdate]: newVal,
        },
      }),
      this.checkComplete,
    );
  };

  /* Update state of shipping */
  updateShipping = (e, toUpdate) => {
    let newVal = e.target.value;
    this.setState(
      (prevState) => ({
        profile: {
          ...prevState.profile,
          shipping: {
            ...prevState.profile.shipping,
            [toUpdate]: newVal,
          },
        },
      }),
      this.checkComplete,
    );
  };

  /* Update state of billing */
  updateBilling = (e, toUpdate) => {
    let newVal = e.target.value;
    this.setState(
      (prevState) => ({
        profile: {
          ...prevState.profile,
          billing: {
            ...prevState.profile.billing,
            [toUpdate]: newVal,
          },
        },
      }),
      this.checkComplete,
    );
  };

  /* Update country and update react select options
		for states */
  handleCountry = (e, toUpdate) => {
    if (toUpdate === 'shipping') {
      this.setState(
        (prevState) => ({
          profile: {
            ...prevState.profile,
            shipping: {
              ...prevState.profile.shipping,
              country: e.label,
              countrycode: e.value,
              state: '',
            },
          },
          shippingStates: e.regions,
        }),
        this.checkComplete,
      );
    } else {
      this.setState(
        (prevState) => ({
          profile: {
            ...prevState.profile,
            billing: {
              ...prevState.profile.billing,
              country: e.label,
              countrycode: e.value,
              state: '',
            },
          },
          billingStates: e.regions,
        }),
        this.checkComplete,
      );
    }
  };

  /**
   * Update selected region
   */
  handleState = (e, toUpdate) => {
    if (toUpdate === 'shipping') {
      this.setState(
        (prevState) => ({
          profile: {
            ...prevState.profile,
            shipping: {
              ...prevState.profile.shipping,
              state: e.value,
            },
          },
          shippingState: e,
        }),
        this.checkComplete,
      );
    } else {
      this.setState(
        (prevState) => ({
          profile: {
            ...prevState.profile,
            billing: {
              ...prevState.profile.billing,
              state: e.value,
            },
          },
          billingState: e,
        }),
        this.checkComplete,
      );
    }
  };

  /**
   * handles the changes being made to an email, uses regex
   * to make sure its valid input
   *
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
      (prevState) => ({
        profile: {
          ...prevState.profile,
          email: this.refs.emailField.value,
        },
        emailComplete: valid,
      }),
      this.checkComplete,
    );
  };

  handleKeyDown = (e) => {
    switch (e.key) {
      case 'Backspace':
        if (this.refs.exp.value.length === 4) {
          this.refs.exp.value = this.refs.exp.value.slice(0, -1);
        }
        break;
      case '/':
        break;
      default:
        if (this.refs.exp.value.length === 2) {
          this.refs.exp.value = `${this.refs.exp.value}/`;
        }
    }
  };

  /**
   * checks if expiry date is valid
   */
  handleExp = () => {
    let valid = false;
    if (this.refs.exp.value) {
      if (/(((0[1-9])|(1[0-2]))\/([2-9][0-9]))/.test(this.refs.exp.value)) valid = true;
      this.setState({ cardDateChanged: true });
    } else {
      this.setState({ cardDateChanged: false });
    }

    this.setState(
      (prevState) => ({
        profile: {
          ...prevState.profile,
          expdate: this.refs.exp.value.substr(0, 5),
        },
        cardDateValid: valid,
      }),
      this.checkComplete,
    );
  };

  /**
   * Checks if CVV is valid
   */
  handleCVV = () => {
    let valid = false;
    if (this.refs.cvv.value) {
      if (/^[0-9]{3,4}$/.test(this.refs.cvv.value)) valid = true;
      this.setState({ cvvChanged: true });
    } else {
      this.setState({ cvvChanged: false });
    }

    this.setState(
      (prevState) => ({
        profile: {
          ...prevState.profile,
          cvv: this.refs.cvv.value,
        },
        cvvValid: valid,
      }),
      this.checkComplete,
    );
  };

  /**
   * Gets the card type
   */
  getCardType = (number) => {
    let cardtype = 'Visa';
    let cardIcon = visaIcon;

    if (validator.number(number).card) {
      const cardType = validator.number(number).card.type;
      console.log(cardType);

      if (cardType === 'discover') {
        cardtype = 'Discover';
        cardIcon = discoverIcon;
      } else if (cardType === 'mastercard') {
        cardtype = 'Mastercard';
        cardIcon = mastercardIcon;
      } else if (cardType === 'american-express') {
        cardtype = 'Amex';
        cardIcon = amexIcon;
      } else if (cardType === 'diners-club') {
        cardtype = 'Diners Club';
        cardIcon = dinersIcon;
      } else if (cardType === 'jcb') {
        cardtype = 'JCB';
        cardIcon = jcbIcon;
      } else {
        cardtype = 'Visa';
        cardIcon = visaIcon;
      }
    }

    this.setState((prevState) => ({
      profile: {
        ...prevState.profile,
        cardtype,
      },
      cardIcon,
    }));
  };

  /**
   * Validates credit card number
   */
  handleCC = () => {
    let valid = false;
    if (this.refs.cc.value) {
      if (this.refs.cc.value.includes('-')) {
        return;
      }
      if (validator.number(this.refs.cc.value).isValid) {
        valid = true;
        if (validator.number(this.refs.cc.value).card.type !== 'american-express') {
          console.log('Hello??');
          this.refs.cc.value = this.refs.cc.value.substr(0, 4) + ' ' + this.refs.cc.value.substr(4, 4) + ' ' + this.refs.cc.value.substr(8, 4) + ' ' + this.refs.cc.value.substr(12);
        } else {
          this.refs.cc.value = this.refs.cc.value.substr(0, 4) + ' ' + this.refs.cc.value.substr(4, 6) + ' ' + this.refs.cc.value.substr(10);
        }
      }
      this.setState({ ccChanged: true }, this.getCardType(this.refs.cc.value));
    } else {
      this.setState({ ccChanged: false });
    }

    this.setState(
      (prevState) => ({
        profile: {
          ...prevState.profile,
          cardnumber: this.refs.cc.value,
        },
        ccValid: valid,
      }),
      this.checkComplete,
    );
  };

  /**
   * load profile user wants to edit
   *
   * @param {any} profile - profile being loaded
   * @param {int} i - index of profile being loaded
   */
  loadProfile = (profile, i) => {
    console.log(countryRegions.length);
    const shippingStates = countryRegions.filter((country) => country.value === profile.shipping.countrycode)[0].regions;
    const billingStates = countryRegions.filter((country) => country.value === profile.billing.countrycode)[0].regions;
    let cardtype = profile.cardtype;
    this.setState({
      profile: profile,
      emailChanged: true,
      emailComplete: true,
      cardDateChanged: true,
      cardDateValid: true,
      cvvChanged: true,
      cvvValid: true,
      ccChanged: true,
      ccValid: true,
      completed: false,
      editing: true,
      profileIndex: i,
      cardIcon:
        cardtype === 'Mastercard'
          ? mastercardIcon
          : cardtype === 'Amex'
          ? amexIcon
          : cardtype === 'Discover'
          ? discoverIcon
          : cardtype === 'JCB'
          ? jcbIcon
          : cardtype === 'Diners Club'
          ? dinersIcon
          : visaIcon,
      shippingStates: shippingStates,
      billingStates: billingStates,
    });
  };

  /**
   * createProfile
   * sends profile data to reducer and backend
   *
   */
  createProfile = () => {
    if (this.state.editing) {
      let profileNames = [...this.props.currentProfileNames];
      profileNames.splice(this.state.profileIndex, 1);
      if (profileNames.includes(this.state.profile.profilename)) {
        notifyMessage('Not Saved!', 'Cannot use same profile name twice', toastColors.red);
        this.setState({
          completed: false,
        });
        return;
      }
      console.log(`${this.state.profile.profilename} being updated.`);
      this.props.updateProfile(this.state.profile, this.state.profileIndex);
      notifyMessage('Saved', `${this.state.profile.profilename} has been updated.`, toastColors.blue);
      ipcRenderer.send('update-profile', this.state.profile, this.state.profileIndex);
      this.refs.leave.click();
    } else {
      if (this.props.currentProfileNames.includes(this.state.profile.profilename)) {
        this.setState({
          errortext: 'Cannot use the same profile name twice!',
          completed: false,
        });
        return;
      }
      ipcRenderer.send('profile-created', this.state.profile);
      console.log(`Creating new profile: ${this.state.profile.profilename}`);
      this.props.createProfile(this.state.profile);
      notifyMessage('Success', `Created new profile: ${this.state.profile.profilename}`, toastColors.blue);
    }
    this.setState({ errortext: null, completed: false });
    this.forceUpdate();
  };

  checkComplete = () => {
    if (
      this.state.profile.profilename != '' &&
      this.state.emailComplete &&
      this.state.profile.phone != '' &&
      this.state.profile.firstname != '' &&
      this.state.profile.lastname != '' &&
      this.state.profile.shipping.address != '' &&
      this.state.profile.shipping.state != '' &&
      this.state.profile.shipping.city != '' &&
      this.state.profile.shipping.zip != '' &&
      this.state.profile.shipping.country != '' &&
      this.state.ccValid &&
      this.state.cvvValid &&
      this.state.cardDateValid &&
      this.state.profile.cardholdername != '' &&
      (!this.state.profile.usebilling ||
        (this.state.profile.billing.address != '' &&
          this.state.profile.billing.state != '' &&
          this.state.profile.billing.city != '' &&
          this.state.profile.billing.zip != '' &&
          this.state.profile.billing.country != ''))
    )
      this.setState({ completed: true });
    else this.setState({ completed: false });
  };

  componentDidMount() {
    if (this.props.profIndex !== null) {
      this.loadProfile(this.props.currentProfiles[this.props.profIndex], this.props.profIndex);
    }
    /*
    if (this.props.location.search) {
      let x = this.props.location.search.split('&');
      x[0] = x[0].substr(1, x[0].length - 1);
      x[1] = x[1].substr(0, x[1].length);
      x[1] = parseInt(x[1]);
      this.props.currentProfiles.forEach(profile => {
        if (profile.profilename === x[0]) {
          this.loadProfile(profile, x[1]);
          return;
        }
      });
    } */
  }

  render() {
    return (
      <>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        <div className={`page__content ${this.props.editOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Create Profile</h1>
          </div>
          <div className="createtask-form__wrapper">
            <div className="createprofile-inputs__wrapper">
              <div className="createtask-inputs__section">
                <h3>Profile Information</h3>
                <div className="input__full">
                  <span className="input__text">Profile Name</span>
                  <input onChange={(e) => this.handleChange(e, 'profilename')} value={this.state.profile.profilename} type="text" className="input" placeholder="Profile Name" />
                </div>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">Email</span>
                    <input
                      type="text"
                      ref="emailField"
                      value={this.state.profile.email}
                      onChange={this.handleEmail}
                      className={this.state.emailChanged ? (this.state.emailComplete ? 'input' : 'input incomplete') : 'input'}
                      placeholder="Email"
                    />
                    <span className="error__text"></span>
                  </div>
                  <div className="input__half">
                    <span className="input__text">Phone</span>
                    <input onChange={(e) => this.handleChange(e, 'phone')} value={this.state.profile.phone} type="text" className="input" placeholder="Phone" />
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
                            this.setState(
                              (prevState) => ({
                                profile: {
                                  ...prevState.profile,
                                  useonce: !this.state.profile.useonce,
                                },
                              }),
                              this.checkComplete,
                            );
                          }}
                          checked={this.state.profile.useonce}
                        />
                        <span className="form__switch"></span>
                      </label>
                      <span className="switch__text">Use Once</span>
                    </div>
                  </div>
                </div>
                <h3>Billing</h3>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">First Name</span>
                    <input
                      onChange={(e) => this.handleChange(e, 'billingFirstName')}
                      value={this.state.billingFirstName}
                      type="text"
                      className="input"
                      placeholder="First Name"
                      disabled={!this.state.profile.usebilling}
                    />
                  </div>
                  <div className="input__half">
                    <span className="input__text">Last Name</span>
                    <input
                      onChange={(e) => this.handleChange(e, 'billingLastName')}
                      value={this.state.billingLastName}
                      type="text"
                      className="input"
                      placeholder="Last Name"
                      disabled={!this.state.profile.usebilling}
                    />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__twurd">
                    <span className="input__text">Address</span>
                    <input
                      onChange={(e) => this.updateBilling(e, 'address')}
                      value={this.state.profile.billing.address}
                      type="text"
                      className="input"
                      placeholder="Address"
                      disabled={!this.state.profile.usebilling}
                    />
                  </div>
                  <div className="input__third">
                    <span className="input__text">Apt | Suite</span>
                    <input
                      onChange={(e) => this.updateBilling(e, 'apt')}
                      value={this.state.profile.billing.apt}
                      type="text"
                      className="input"
                      placeholder="Apt | Suite"
                      disabled={!this.state.profile.usebilling}
                    />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">City</span>
                    <input
                      onChange={(e) => this.updateBilling(e, 'city')}
                      value={this.state.profile.billing.city}
                      type="text"
                      className="input"
                      placeholder="City"
                      disabled={!this.state.profile.usebilling}
                    />
                  </div>
                  <div className="input__half">
                    <span className="input__text">State</span>
                    <Select
                      options={this.state.billingStates}
                      styles={this.state.profile.usebilling ? selectStyles : disabledSelect}
                      value={this.state.profile.billing.state !== '' ? this.state.billingStates.filter((state) => state.value === this.state.profile.billing.state) : this.state.billingStates[0]}
                      onChange={(e) => {
                        this.handleState(e, 'billing');
                      }}
                      placeholder="Select State:"
                      isSearchable
                      backspaceRemovesValue
                      isDisabled={!this.state.profile.usebilling}
                    />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__third">
                    <span className="input__text">Zipcode</span>
                    <input
                      onChange={(e) => this.updateBilling(e, 'zip')}
                      value={this.state.profile.billing.zip}
                      type="text"
                      className="input"
                      placeholder="Zip Code"
                      disabled={!this.state.profile.usebilling}
                    />
                  </div>
                  <div className="input__twurd">
                    <span className="input__text">Country</span>
                    <Select
                      options={countryRegions}
                      styles={this.state.profile.usebilling ? selectStyles : disabledSelect}
                      defaultValue={countryRegions[234]}
                      value={countryRegions.filter((region) => region.value === this.state.profile.billing.countrycode)}
                      placeholder="Select Country:"
                      onChange={(e) => {
                        this.handleCountry(e, 'billing');
                      }}
                      isSearchable
                      backspaceRemovesValue
                      isDisabled={!this.state.profile.usebilling}
                    />
                  </div>
                </div>
              </div>
              <div className="createtask-inputs__section">
                <h3>Shipping</h3>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">First Name</span>
                    <input onChange={(e) => this.handleChange(e, 'firstname')} value={this.state.profile.firstname} type="text" className="input" placeholder="First Name" />
                  </div>
                  <div className="input__half">
                    <span className="input__text">Last Name</span>
                    <input onChange={(e) => this.handleChange(e, 'lastname')} value={this.state.profile.lastname} type="text" className="input" placeholder="Last Name" />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__twurd">
                    <span className="input__text">Address</span>
                    <input onChange={(e) => this.updateShipping(e, 'address')} value={this.state.profile.shipping.address} type="text" className="input" placeholder="Address" />
                  </div>
                  <div className="input__third">
                    <span className="input__text">Apt | Suite</span>
                    <input onChange={(e) => this.updateShipping(e, 'apt')} value={this.state.profile.shipping.apt} type="text" className="input" placeholder="Apt | Suite" />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">City</span>
                    <input onChange={(e) => this.updateShipping(e, 'city')} value={this.state.profile.shipping.city} type="text" className="input" placeholder="City" />
                  </div>
                  <div className="input__half">
                    <span className="input__text">State</span>
                    <Select
                      options={this.state.shippingStates}
                      styles={selectStyles}
                      value={this.state.profile.shipping.state !== '' ? this.state.shippingStates.filter((state) => state.value === this.state.profile.shipping.state) : this.state.shippingStates[0]}
                      onChange={(e) => {
                        this.handleState(e, 'shipping');
                      }}
                      placeholder="Select State:"
                      isSearchable
                      backspaceRemovesValue
                    />
                  </div>
                </div>
                <div className="input__split">
                  <div className="input__third">
                    <span className="input__text">Zipcode</span>
                    <input onChange={(e) => this.updateShipping(e, 'zip')} value={this.state.profile.shipping.zip} type="text" className="input" placeholder="Zip Code" />
                    <span className="error__text"></span>
                  </div>
                  <div className="input__twurd">
                    <span className="input__text">Country</span>
                    <Select
                      options={countryRegions}
                      styles={selectStyles}
                      defaultValue={countryRegions[234]}
                      value={countryRegions.filter((region) => region.value === this.state.profile.shipping.countrycode)}
                      placeholder="Select Country:"
                      onChange={(e) => {
                        this.handleCountry(e, 'shipping');
                      }}
                      isSearchable
                      backspaceRemovesValue
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
                          onChange={() => {
                            this.setState(
                              (prevState) => ({
                                profile: {
                                  ...prevState.profile,
                                  usebilling: !this.state.profile.usebilling,
                                },
                              }),
                              this.checkComplete,
                            );
                          }}
                          checked={this.state.profile.usebilling}
                        />
                        <span className="form__switch"></span>
                      </label>
                      <span className="switch__text">Different Billing</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="createtask-inputs__section">
                <div className="card__wrapper">
                  <Tilt options={tiltOptions}>
                    <div className={`card ${this.state.profile.cardtype}`}>
                      <div className="card--top">
                        <img src={ccChip} alt="" className="card-chip" />
                        <img src={this.state.cardIcon} alt="" className="card-icon" />
                      </div>
                      <div className="card--mid">
                        ****-****-****-
                        {this.state.profile.cardnumber.replace(/-|\s/g, '').length > 12 ? this.state.profile.cardnumber.replace(/-|\s/g, '').substr(12) : '****'}
                      </div>
                      <div className="card--bottom">
                        <div className="card__info">
                          <div className="card__text--small">CARD HOLDER</div>
                          <div className="card__text">{this.state.profile.cardholdername.length > 0 ? this.state.profile.cardholdername : 'JOHN DOE'}</div>
                        </div>
                        <div className="card__info">
                          <div className="card__text--small">EXPIRES</div>
                          <div className="card__text">{this.state.profile.expdate.length > 0 ? this.state.profile.expdate : '01/23'}</div>
                        </div>
                      </div>
                    </div>
                  </Tilt>
                </div>
                <h3>Payment Information</h3>
                <div className="input__full">
                  <span className="input__text">Cardholder</span>
                  <input onChange={(e) => this.handleChange(e, 'cardholdername')} value={this.state.profile.cardholdername} type="text" className="input" placeholder="Name" />
                </div>
                <div className="input__full">
                  <span className="input__text">Card Number</span>
                  <input
                    ref="cc"
                    onChange={this.handleCC}
                    value={this.state.profile.cardnumber}
                    type="text"
                    className={this.state.ccChanged ? (this.state.ccValid ? 'input' : 'input incomplete') : 'input'}
                    placeholder="Card Number"
                  />
                </div>
                <div className="input__split">
                  <div className="input__half">
                    <span className="input__text">Expiry Date</span>
                    <input
                      ref="exp"
                      onChange={this.handleExp}
                      value={this.state.profile.expdate}
                      type="text"
                      className={this.state.cardDateChanged ? (this.state.cardDateValid ? 'input' : 'input incomplete') : 'input'}
                      placeholder="01/23"
                      onKeyDown={this.handleKeyDown}
                    />
                  </div>
                  <div className="input__half">
                    <span className="input__text">CVV</span>
                    <input
                      ref="cvv"
                      onChange={this.handleCVV}
                      value={this.state.profile.cvv}
                      type="text"
                      className={this.state.cvvChanged ? (this.state.cvvValid ? 'input' : 'input incomplete') : 'input'}
                      placeholder="CVV"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="ct-buttons__wrapper">
              <div></div>
              <div className="flex--right">
                <span className="error__text--large">{this.state.errortext}</span>
                <Link to="/profiles" className="button blue" ref="leave">
                  <img src={backIcon} alt="" className="button__img" />
                  Back
                </Link>
                <Button
                  clickFunction={this.state.completed ? this.createProfile : () => {}}
                  icon={this.state.editing ? saveIcon : createIcon}
                  text={this.state.editing ? 'Save' : 'Create'}
                  color={this.state.completed ? 'green' : 'green disabled'}
                />
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
const mapStateToProps = (state) => ({
  currentProfiles: state.profiles.currentProfiles,
  currentProfileNames: state.profiles.currentProfileNames,
});

export default connect(mapStateToProps, actions)(ProfileCreation);
