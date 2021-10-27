/* eslint-disable no-trailing-spaces */
/* eslint-disable react/state-in-constructor */
/* eslint-disable react/prop-types */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import { ipcRenderer } from 'electron';

import Select from 'react-select';
import { selectStyles } from '../routes/creationComponents/SelectStyles';
import { sizes } from '../routes/creationComponents/SelectOptions';

import closeIcon from '../assets/actions/close.svg';
import saveIcon from '../assets/actions/save.svg';

import Button from './micro/Button';
import { notifyMessage, toastColors } from './micro/Toaster';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

class EditModal extends React.Component {
  state = {
    editLink: null,
    monitorDelay: null,
    checkoutDelay: null,
    errorDelay: null,
    sizes: null,
    siteType: 'shopify',
    taskGroups: [],
    specificIds: null,
  };

  handleChange = (e, toUpdate) => {
    if (toUpdate === 'monitorDelay' || toUpdate === 'checkoutDelay') {
      if (isNaN(e.target.value)) return;
    }
    this.setState({
      [toUpdate]: e.target.value,
    });
  };

  /**
   * handles changes for react-select dropdowns
   *
   * @param {any} e - the event the onChange is being called by
   * @param {string} toUpdate - the state to update
   */
  handleSelectChange = (e, toUpdate) => {
    this.setState({
      [toUpdate]: e.value,
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
    this.setState({ sizes });
  };

  editAll = () => {
    let monitorType = 'keywords';
    let monitorInput = [];
    if (this.state.editLink !== null && this.state.editLink !== '') {
      if (this.state.editLink.includes('https://') || this.state.editLink.includes('http://')) {
        monitorType = 'url';
      } else if (this.state.editLink.includes('+') || this.state.editLink.includes('-')) {
        monitorType = 'keywords';
      } else {
        monitorType = 'variant';
        if (isNaN(this.state.editLink)) {
          notifyMessage('Warning', 'Mass edit keywords require + and - symbols', toastColors.red);
          return;
        }
        if (this.state.editLink.includes(',')) {
          notifyMessage('Warning', 'Cannot mass edit with variant lists!', toastColors.red);
          return;
        }
      }

      if (monitorType === 'keywords') {
        monitorInput = this.state.editLink.replace(/\s/g, '').split(',');
        this.setState({ editLink: monitorInput });
      }
    }

    ipcRenderer.send('edit-all-tasks', {
      monitorType,
      monitorInput: this.state.editLink,
      checkoutDelay: this.state.checkoutDelay,
      monitorDelay: this.state.monitorDelay,
      sizes: this.state.sizes,
      siteType: this.state.siteType,
      specificIds: this.state.specificIds,
    });
    console.log('Sending mass edit parameters to backend:', this.state);
    this.props.editClose(false);
  };

  componentDidMount() {
    let taskGroups = [];
    taskGroups.push({ label: 'All', value: this.props.taskGroups.All });
    Object.keys(this.props.taskGroups).map((group) => {
      if (group !== 'All') {
        taskGroups.push({ label: group, value: this.props.taskGroups[group] });
      }
    });
    this.setState({ taskGroups, specificIds: this.props.taskGroups.All });
  }

  render() {
    return (
      <div id="editModal" className={`edit__modal__wrapper ${this.props.editOpen ? 'show' : ''}`}>
        <div id="editModal" className="edit__modal">
          <div id="editModal" className="edit__modal__inputs">
            <div id="editModal" className="edit__modal__header">
              <h3 id="editModal">Mass Edit</h3>
              <div id="editModal" className="button--round light" onClick={() => this.props.editClose(false)}>
                <img id="editModal" src={closeIcon} alt="" className="button--round__image" />
              </div>
            </div>
            <div className="input__split" id="editModal">
              <div className="input__half">
                <span className="input__text" id="editModal">
                  Site
                </span>
                <Select
                  options={[
                    { label: 'Shopify', value: 'shopify' },
                    { label: 'Supreme', value: 'supreme' },
                  ]}
                  styles={selectStyles}
                  placeholder="Select Site:"
                  onChange={(e) => {
                    this.handleSelectChange(e, 'siteType');
                  }}
                  value={[
                    { label: 'Shopify', value: 'shopify' },
                    { label: 'Supreme', value: 'supreme' },
                  ].filter((option) => option.value === this.state.siteType)}
                />
              </div>
              <div className="input__half">
                <span className="input__text" id="editModal">
                  Task Group
                </span>
                <Select
                  options={this.state.taskGroups}
                  styles={selectStyles}
                  placeholder="Select Group:"
                  onChange={(e) => {
                    this.handleSelectChange(e, 'specificIds');
                  }}
                />
              </div>
            </div>
            <span id="editModal" className="input__text">
              Monitor Input
            </span>
            <div id="editModal" className="input__full">
              <input id="editModal" type="text" className="input" value={this.state.editLink} onChange={(e) => this.handleChange(e, 'editLink')} placeholder="Keywords, URL, or Variant" />
            </div>
            <span id="editModal" className="input__text">
              Sizes
            </span>
            <div className="input__full" id="editModal">
              <Select
                options={sizes}
                styles={selectStyles}
                onChange={(e) => {
                  this.handleSizeChange(e);
                }}
                isMulti
                isSearchable
                backspaceRemovesValue
                placeholder="Select Size(s):"
                closeMenuOnSelect={false}
              />
            </div>
            <div className="input__split">
              <div className="input__half">
                <span id="editModal" className="input__text">
                  Monitor Delay
                </span>
                <input id="editModal" type="text" className="input" value={this.state.monitorDelay} onChange={(e) => this.handleChange(e, 'monitorDelay')} placeholder="0" />
              </div>
              <div className="input__half">
                <span id="editModal" className="input__text">
                  Checkout Delay
                </span>
                <input id="editModal" type="text" className="input" value={this.state.checkoutDelay} onChange={(e) => this.handleChange(e, 'checkoutDelay')} placeholder="0" />
              </div>
            </div>
          </div>
          <Button clickFunction={this.editAll} icon={saveIcon} color="green" text="Edit" />
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
    taskGroups: state.tasks.groups,
  };
};

export default connect(mapStateToProps, actions)(EditModal);
