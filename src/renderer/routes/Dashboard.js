import React from 'react';
import CountUp from 'react-countup';

/* Redux dependencies */
import { connect } from 'react-redux';
import { ipcRenderer } from 'electron';
import * as actions from '../actions';

import '../styles/Dashboard.scss';

import moneyIcon from '../assets/otherIcons/money.svg';
import checkoutsIcon from '../assets/otherIcons/checkouts.svg';
import declinesIcon from '../assets/otherIcons/declines.svg';
import createIcon from '../assets/actions/create_green.svg';
import reloadIcon from '../assets/actions/reload.svg';
import shareIcon from '../assets/actions/share.svg';

import Button from '../components/micro/Button';
import EditModal from '../components/EditModal';
import QTModal from '../components/QTModal';

class Dashboard extends React.Component {
  state = {
    checkoutIndex: -1,
    // loaded: false,
    analytics: [],
    allAnalytics: [],
    hideDeclines: false,
    // key: '',
  };

  loadCheckout = (index) => {
    this.setState({ checkoutIndex: index });
  };

  componentDidMount() {
    if (!this.props.analyticsLoaded) {
      console.log('Loading analytics...');
      ipcRenderer.send('getAnalytics');
      ipcRenderer.on('sendAnalytics', (e, analytics) => {
        this.setState({ analytics: JSON.parse(analytics).checkouts, allAnalytics: JSON.parse(analytics).checkouts });
        this.props.setAnalyticsLoaded(JSON.parse(analytics).checkouts);
      });
    } else {
      this.setState({ analytics: this.props.allAnalytics, allAnalytics: this.props.allAnalytics });
    }
  }

  hideDeclines = () => {
    let { analytics } = this.state;
    if (!this.state.hideDeclines) {
      analytics = analytics.filter((checkout) => checkout.success === true);
      console.log(analytics);
      this.setState({ analytics, checkoutIndex: -1, hideDeclines: true });
    } else {
      this.setState({ analytics: this.state.allAnalytics, checkoutIndex: -1, hideDeclines: false });
    }
  };

  reloadAnalytics = () => {
    ipcRenderer.send('getAnalytics');
    ipcRenderer.on('sendAnalytics', (e, analytics) => {
      this.setState({ analytics: JSON.parse(analytics).checkouts, allAnalytics: JSON.parse(analytics).checkouts });
    });
  };

  shareSetup = () => {
    if (this.state.checkoutIndex !== -1) {
      console.log('Hello we are trying to send this shit');
      ipcRenderer.send('shareSetup', this.state.analytics[this.state.checkoutIndex]);
    }
  };

  convertDate = (time) => {
    const date = new Date(time);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
  };

  render() {
    return (
      <>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        {this.props.qtOpen ? <QTModal qtOpen={this.props.qtOpen} qtClose={this.props.qtClose} /> : <></>}
        <div className={`page__content ${this.props.editOpen || this.props.qtOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Analytics</h1>
          </div>
          <div className="dashboard__wrapper">
            <div className="analytics green">
              <div className="analytics__image__wrapper">
                <img src={moneyIcon} alt="" className="analytics__image" />
              </div>
              <div className="analytics__text">
                <div className="analytics__description">Total Spent:</div>
                <CountUp
                  start={0}
                  end={this.state.analytics
                    .filter((checkout) => checkout.success === true)
                    .reduce((a, b) => {
                      return a + parseFloat(b.item.price);
                    }, 0)}
                  prefix="$"
                  duration={1}
                  className="analytics__value"
                />
              </div>
            </div>
            <div className="analytics blue">
              <div className="analytics__image__wrapper">
                <img src={checkoutsIcon} alt="" className="analytics__image" />
              </div>
              <div className="analytics__text">
                <div className="analytics__description">Checkouts:</div>
                <CountUp start={0} end={this.state.analytics.filter((checkout) => checkout.success === true).length} duration={2} className="analytics__value" />
              </div>
            </div>
            <div className="analytics red">
              <div className="analytics__image__wrapper">
                <img src={declinesIcon} alt="" className="analytics__image" />
              </div>
              <div className="analytics__text">
                <div className="analytics__description">Declines:</div>
                <CountUp start={0} end={this.state.allAnalytics.filter((checkout) => checkout.success === false).length} duration={2} className="analytics__value" />
              </div>
            </div>
          </div>
          <div className="dashboard__wrapper">
            <div className="analytics__wrapper">
              <div className="table">
                <div className="table__headings">
                  <div className="table__row">
                    <span />
                    <span>Product</span>
                    <span>Size</span>
                    <span>Price</span>
                    <span>Status</span>
                    <span>Store</span>
                    <span>Date</span>
                  </div>
                </div>
                <div className="table__body">
                  {this.state.analytics.map((checkout, i) => (
                    <div onClick={() => this.loadCheckout(i)} className={this.state.checkoutIndex === i ? 'table__row selected' : 'table__row'}>
                      <span>
                        <div className="table__image__wrapper">
                          <img src={checkout.item.imageUrl} alt="" className="table__image" />
                        </div>
                      </span>
                      <span>{checkout.item.name}</span>
                      <span>{checkout.item.size}</span>
                      <span>{checkout.item.price ? checkout.item.price : 'N/A'}</span>
                      <span style={checkout.success === true ? { color: '#46ff65', fontWeight: 'bold' } : { color: '#ff4646', fontWeight: 'bold' }}>
                        {checkout.success === true ? 'Success' : 'Decline'}
                      </span>
                      <span>{checkout.item.site}</span>
                      <span>{this.convertDate(checkout.details.checkoutTime)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="analytics__buttons__wrapper">
                <Button text={this.state.hideDeclines ? 'Show All' : 'Show Checkouts Only'} icon={null} clickFunction={this.hideDeclines} color="blue" />
                <div className="square-button" onClick={() => this.reloadAnalytics()}>
                  <img src={reloadIcon} alt="" className="square-button-img" />
                </div>
              </div>
            </div>
            <div className="setup__wrapper">
              <div className="setup__container">
                <div>
                  <h3>Details</h3>
                  {this.state.checkoutIndex !== -1 ? (
                    <>
                      <div className="product__details">
                        <div className="product__image__wrapper">
                          <img className="product__image" src={this.state.analytics[this.state.checkoutIndex].item.imageUrl} />
                        </div>
                        <div className="product__details__text">
                          <div className="product__title">{this.state.analytics[this.state.checkoutIndex].item.name}</div>
                          <div className="product__date">{this.convertDate(this.state.analytics[this.state.checkoutIndex].details.checkoutTime)}</div>
                        </div>
                      </div>
                      <h3>Setup</h3>
                      <div className="input__split">
                        <div className="input__half">
                          <span className="input__text">Mode</span>
                          {this.state.analytics[this.state.checkoutIndex].details.task.mode}
                        </div>
                        <div className="input__half">
                          <span className="input__text">Monitor Input</span>
                          {this.state.analytics[this.state.checkoutIndex].details.task.monitorInput}
                        </div>
                      </div>
                      <div className="input__split">
                        <div className="input__half">
                          <span className="input__text">Monitor Delay</span>
                          {this.state.analytics[this.state.checkoutIndex].details.task.monitorDelay}
                        </div>
                        <div className="input__half">
                          <span className="input__text">Error Delay</span>
                          {this.state.analytics[this.state.checkoutIndex].details.task.errorDelay}
                        </div>
                      </div>
                    </>
                  ) : (
                    <></>
                  )}
                </div>
                <div className="flex--between">
                  <Button text="Task from Setup" icon={createIcon} clickFunction={() => {}} color="green disabled" className="half--button" />
                  <Button text="Share Setup" icon={shareIcon} clickFunction={this.shareSetup} color="blue" className="half--button" />
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
 * maps reducer state to react props
 *
 * @param {any} state - reducer state
 *
 */
const mapStateToProps = (state) => ({
  allAnalytics: state.tools.allAnalytics,
  analyticsLoaded: state.tools.analyticsLoaded,
});

export default connect(mapStateToProps, actions)(Dashboard);
