import React from 'react';
import PropTypes from 'prop-types';

/**
 * Small information container displayed above tasks, profiles, and
 * proxies pages
 */
class ControlInfo extends React.Component {
  static propTypes = {
    /* Color of the circle inside the container */
    color: PropTypes.string.isRequired,
    /* Text inside the container */
    text: PropTypes.string.isRequired,
  };

  render() {
    return (
      <div className="control-info__wrapper">
        <div className={'control-info__circle ' + this.props.color}></div>
        <div className="control-info__text">{this.props.text}</div>
      </div>
    );
  }
}

export default ControlInfo;
