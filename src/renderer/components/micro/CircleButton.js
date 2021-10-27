import React from 'react';
import PropTypes from 'prop-types';

/**
 * Circular button element
 */
class CircleButton extends React.Component {
  static propTypes = {
    /* Function to execute on click */
    clickFunction: PropTypes.func.isRequired,
    /* Name of icon to display */
    name: PropTypes.string.isRequired,
  };

  render() {
    return (
      <div onClick={this.props.clickFunction} className={`button--round`} tooltip-text={this.props.name === 'export' ? 'Import' : 'Export'}>
        <div className="animation__wrapper small">
          <div className={`${this.props.name}-animation`}></div>
        </div>
      </div>
    );
  }
}

export default CircleButton;
