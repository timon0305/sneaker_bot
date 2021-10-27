import React from 'react';
import PropTypes from 'prop-types';

/**
 * Universal button
 */
class Button extends React.Component {
  static propTypes = {
    /* Function to execute on click */
    clickFunction: PropTypes.func,
    /* Color of the button */
    color: PropTypes.string.isRequired,
    /* Icon displayed in button */
    icon: PropTypes.object.isRequired,
    /* Text displayed in button */
    text: PropTypes.string.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool,
  };

  render() {
    return (
      <div disabled={this.props.disabled} onClick={this.props.clickFunction} className={`button ${this.props.color} ${this.props.className}`}>
        {this.props.icon ? <img alt="" className="button__img" src={this.props.icon} /> : <></>}
        {this.props.text}
      </div>
    );
  }
}

export default Button;
