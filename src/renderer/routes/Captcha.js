import React from 'react';
import { ipcRenderer } from 'electron';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

import { notifyMessage, toastColors } from '../components/micro/Toaster';

import '../styles/Captcha.scss';
import Button from '../components/micro/Button';
import EditModal from '../components/EditModal';
import QTModal from '../components/QTModal';

import Select from 'react-select';
import { selectStyles } from './creationComponents/SelectStyles';

import createIcon from '../assets/actions/create.svg';
import createIcon2 from '../assets/actions/create_green.svg';
import closeIcon from '../assets/actions/close.svg';

class ShopifyDefault extends React.Component {
  render() {
    return (
      <div className="harvester__description">
        <span className="green">Shopify</span> -<span className="blue"> Default</span>
      </div>
    );
  }
}

class ShopifyCheckout extends React.Component {
  render() {
    return (
      <div className="harvester__description">
        <span className="green">Shopify</span> -<span className="yellow"> Checkout</span>
      </div>
    );
  }
}

class Supreme extends React.Component {
  render() {
    return (
      <div className="harvester__description">
        <span className="red">Supreme</span> -<span className="blue"> Default</span>
      </div>
    );
  }
}

class Captcha extends React.Component {
  state = {
    createOpen: false,
    newHarvesterName: '',
    newHarvesterType: '',
    proxyChanged: false,
    proxyValid: false,
    newHarvesterProxy: '',
    newHarvesterEmail: '',
    newHarvesterPassword: '',
    harvesterReady: false,
    proxies: [],
  };

  componentDidMount() {
    console.log(this.props.harvesters);
    this.props.harvesters.forEach((harvester) => {
      let proxies = this.state.proxies;
      let proxy = harvester.proxy;
      let newProxy = null;
      if (proxy !== null) {
        newProxy = `${proxy.proxyURL.substring(6)}${proxy.username ? `:${proxy.username}` : ''}${proxy.password ? `:${proxy.password}` : ''}`;
      }
      proxies.push(newProxy);
      this.setState({ proxies });
    });
    console.log(this.state.proxies);
  }

  selectType = (e) => {
    this.setState({ newHarvesterType: e.value }, this.checkComplete);
  };

  handleChange = (e, toUpdate) => {
    this.setState(
      {
        [toUpdate]: e.target.value,
      },
      this.checkComplete,
    );
  };

  handleProxyChange = (e, i) => {
    let proxies = this.state.proxies;
    proxies[i] = e.target.value;
    this.setState({ proxies });
  };

  checkComplete = () => {
    if (this.state.newHarvesterName !== '' && this.state.newHarvesterType !== '') {
      this.setState({ harvesterReady: true });
    } else {
      this.setState({ harvesterReady: false });
    }
  };

  validateProxy = () => {
    let valid = false;
    const validation = /\b((?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?):\d{2,5}(:\w+:\w+)?\b/;
    if (this.refs.proxyField.value) {
      if (this.refs.proxyField.value.match(validation)) {
        valid = true;
      }
      this.setState({ proxyChanged: true });
    } else {
      this.setState({ proxyChanged: false });
    }

    this.setState({
      newHarvesterProxy: this.refs.proxyField.value,
      proxyValid: valid,
    });
  };

  createHarvester = () => {
    if (this.state.proxyChanged && !this.state.proxyValid) {
      notifyMessage('Uh oh!', 'Invalid proxy.', toastColors.red);
      return;
    }

    let proxy = null;
    if (this.state.newHarvesterProxy) {
      let preSplit = this.state.newHarvesterProxy.split(':', 4);
      proxy = {
        proxyURL: `https=${preSplit[0]}:${preSplit[1]}`,
        username: preSplit[2] ? preSplit[2] : '',
        password: preSplit[3] ? preSplit[3] : '',
      };
    }

    const data = {
      harvesterName: this.state.newHarvesterName,
      harvesterType: this.state.newHarvesterType,
      proxy,
      harvesterEmail: this.state.newHarvesterEmail,
      harvesterPassword: this.state.newHarvesterPassword,
    };

    ipcRenderer.send('addHarvester', data);

    this.props.addHarvester(data);

    let proxies = this.state.proxies;
    proxies.push(this.state.newHarvesterProxy);

    this.setState({
      newHarvesterName: '',
      newHarvesterType: '',
      newHarvesterProxy: '',
      newHarvesterEmail: '',
      newHarvesterPassword: '',
      harvesterReady: false,
      createOpen: false,
      proxies,
      proxyChanged: false,
      proxyValid: false,
    });

    this.forceUpdate();
  };

  deleteHarvester = (harvester) => {
    ipcRenderer.send('delHarvester', harvester);
  };

  render() {
    return (
      <>
        <div className={`edit__modal__wrapper ${this.state.createOpen ? 'show' : ''}`}>
          <div className="edit__modal">
            <div className="edit__modal__inputs">
              <div className="edit__modal__header">
                <h3>New Harvester</h3>
                <div id="editModal" className="button--round light" onClick={() => this.setState({ createOpen: false })}>
                  <img id="editModal" src={closeIcon} alt="" className="button--round__image" />
                </div>
              </div>
              <div className="input__full">
                <span className="input__text">Harvester Name</span>
                <input type="text" className="input" placeholder="Unique Name" value={this.state.newHarvesterName} onChange={(e) => this.handleChange(e, 'newHarvesterName')} />
              </div>
              <div className="input__full">
                <span className="input__text">Harvester Type</span>
                <Select
                  options={[
                    { label: 'Shopify Default', value: 'shopify' },
                    { label: 'Shopify Checkout', value: 'shopifyCheckout' },
                    { label: 'Supreme', value: 'supreme' },
                  ]}
                  styles={selectStyles}
                  placeholder="Harvester Type:"
                  onChange={(e) => {
                    this.selectType(e);
                  }}
                  value={[
                    { label: 'Shopify Default', value: 'shopify' },
                    { label: 'Shopify Checkout', value: 'shopifyCheckout' },
                    { label: 'Supreme', value: 'supreme' },
                  ].filter((option) => option.value === this.state.newHarvesterType)}
                />
              </div>
              <div className="input__full">
                <span className="input__text">Proxy</span>
                <input
                  type="text"
                  className={this.state.proxyChanged ? (this.state.proxyValid ? 'input' : 'input incomplete') : 'input'}
                  placeholder="Proxy"
                  ref="proxyField"
                  value={this.state.newHarvesterProxy}
                  onChange={this.validateProxy}
                />
              </div>
            </div>
            <Button clickFunction={this.state.harvesterReady ? this.createHarvester : () => {}} color={this.state.harvesterReady ? 'green' : 'green disabled'} text="Create" icon={createIcon2} />
          </div>
        </div>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        {this.props.qtOpen ? <QTModal qtOpen={this.props.qtOpen} qtClose={this.props.qtClose} /> : <></>}
        <div className={`page__content ${this.props.editOpen || this.props.qtOpen || this.state.createOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Harvesters</h1>
          </div>
          <div className="control-buttons__wrapper">
            <div className="flex--right">
              <Button
                color="blue"
                text="Create"
                icon={createIcon}
                clickFunction={() => {
                  this.setState({ createOpen: !this.state.createOpen });
                }}
              />
            </div>
          </div>
          <div className={this.props.harvesters.length === 0 ? 'harvester__table harvester__table--hidden' : 'harvester__table'}>
            {this.props.harvesters.map((harvester, i) => (
              <div className="harvester__box">
                <div className="harvester__top">
                  <div className="harvester__title">{harvester.harvesterName}</div>
                  <div className="button--round light">
                    <img
                      src={closeIcon}
                      alt=""
                      className="button--round__image"
                      onClick={() => {
                        this.deleteHarvester(harvester);
                        this.props.delHarvester(harvester);
                      }}
                    />
                  </div>
                </div>
                {harvester.harvesterType === 'shopify' ? <ShopifyDefault /> : harvester.harvesterType === 'shopifyCheckout' ? <ShopifyCheckout /> : <Supreme />}
                <div className="harvester__description">Proxy</div>
                <input type="text" className="input" placeholder="No Proxy Set" value={this.state.proxies[i]} onChange={(e) => this.handleProxyChange(e, i)} />
                <div className="harvester__buttons">
                  <div className="flex--right">
                    <Button
                      clickFunction={() => {
                        this.props.updateHarvesters(i, this.state.proxies[i]);
                        ipcRenderer.send('setProxy', harvester, this.state.proxies[i]);
                      }}
                      text="Set Proxy"
                      icon={null}
                      color="blue"
                    />
                    <Button clickFunction={() => ipcRenderer.send('openLogin', harvester)} text="Login" icon={null} color="red" />
                    <Button clickFunction={() => ipcRenderer.send('launchHarvester', harvester)} text="Launch" icon={null} color="green" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={this.props.harvesters.length === 0 ? 'harvester__message' : 'harvester__message--hidden'}>
            <div className="no-table__text">No Harvesters!</div>
            <div>Click 'Create' to make one.</div>
          </div>
        </div>
      </>
    );
  }
}

/**
 * maps reducer state to react props
 *
 * @param {any} state - reducer state
 *
 */
const mapStateToProps = (state) => ({
  harvesters: state.tools.harvesters,
});

export default connect(mapStateToProps, actions)(Captcha);
