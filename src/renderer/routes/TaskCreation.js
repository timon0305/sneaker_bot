import React from 'react';

import '../styles/TaskCreation.scss';

/* Card icons */
import shopifyIcon from '../assets/sites/shopify.png';
import supremeIcon from '../assets/sites/supreme.png';
import footlockerIcon from '../assets/sites/footlocker.png';
import ysIcon from '../assets/sites/yeezysupply.png';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

/* Different creation pages */
import Shopify from './creationComponents/Shopify';
import Supreme from './creationComponents/Supreme';
import Snipes from './creationComponents/Snipes';
import YeezySupply from './creationComponents/YeezySupply';
import EditModal from '../components/EditModal';

class TaskCreation extends React.Component {
  state = {
    siteGroup: 'shopify',
    editing: false,
  };

  componentDidMount() {
    if (this.props.taskIndex !== null) {
      this.setState({ editing: true });
      console.log(this.props.currentTasks[this.props.taskIndex]);
      if (this.props.currentTasks[this.props.taskIndex].siteType === 'shopify-advanced' || this.props.currentTasks[this.props.taskIndex].siteType === 'shopify-safe') {
        this.setState({ siteGroup: 'shopify' });
      } else if (this.props.currentTasks[this.props.taskIndex].siteType === 'supreme') {
        this.setState({ siteGroup: 'supreme' });
      } else if (this.props.currentTasks[this.props.taskIndex].siteType === 'snipes-safe' || this.props.currentTasks[this.props.taskIndex].siteType === 'snipes-normal') {
        this.setState({ siteGroup: 'snipes' });
      } else {
        this.setState({ siteGroup: 'yeezysupply' });
      }
    }
  }

  render() {
    return (
      <>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        <div className={`page__content ${this.props.editOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Create Tasks</h1>
          </div>
          <div className="sites__wrapper">
            <div
              className={this.state.siteGroup === 'shopify' ? 'site__wrapper site__wrapper--active shopify--active' : this.state.editing ? 'site__wrapper disabled' : 'site__wrapper shopify'}
              onClick={() => {
                if (!this.state.editing) this.setState({ siteGroup: 'shopify' });
              }}
            >
              <img src={shopifyIcon} alt="" style={{ height: '70px' }} />
            </div>
            <div
              className={this.state.siteGroup === 'supreme' ? 'site__wrapper site__wrapper--active supreme--active' : this.state.editing ? 'site__wrapper disabled' : 'site__wrapper supreme'}
              onClick={() => {
                if (!this.state.editing) this.setState({ siteGroup: 'supreme' });
              }}
            >
              <img src={supremeIcon} alt="" style={{ height: '50px' }} />
            </div>
            <div
              className={this.state.siteGroup === 'snipes' ? 'site__wrapper site__wrapper--active snipes--active' : this.state.editing ? 'site__wrapper disabled' : 'site__wrapper snipes'}
              onClick={() => {
                if (!this.state.editing) this.setState({ siteGroup: 'snipes' });
              }}
            >
              <img src={footlockerIcon} alt="" style={{ height: '120px', paddingLeft: '10px' }} />
            </div>
            <div
              className={this.state.siteGroup === 'yeezysupply' ? 'site__wrapper site__wrapper--active yeezy--active' : this.state.editing ? 'site__wrapper disabled' : 'site__wrapper disabled'}
              onClick={() => {
                // if (!this.state.editing) this.setState({siteGroup: 'yeezysupply'});
              }}
            >
              {<img src={null} alt="" style={{ height: '50px' }} />}
            </div>
          </div>
          {this.state.siteGroup === 'shopify' ? (
            <Shopify taskIndex={this.props.taskIndex} />
          ) : this.state.siteGroup === 'supreme' ? (
            <Supreme taskIndex={this.props.taskIndex} />
          ) : this.state.siteGroup === 'snipes' ? (
            <Snipes taskIndex={this.props.taskIndex} />
          ) : (
            <YeezySupply taskIndex={this.props.taskIndex} />
          )}
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
const mapStateToProps = (state) => {
  return {
    currentTasks: state.tasks.currentTasks,
    currentProfileNames: state.profiles.currentProfileNames,
  };
};

export default connect(mapStateToProps, actions)(TaskCreation);
