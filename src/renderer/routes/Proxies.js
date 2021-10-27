/* eslint-disable react/prefer-stateless-function */
import React from 'react';
import { ipcRenderer } from 'electron';
/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

import '../styles/Proxies.scss';

import proxiesIcon from '../assets/tableIcons/proxies_b.svg';
import DeleteIcon from '../assets/actions/delete.svg';
import EditIcon from '../assets/actions/edit.svg';
import createIcon from '../assets/actions/create_green.svg';
import saveIcon from '../assets/actions/save.svg';

import Button from '../components/micro/Button';
import { notifyMessage, toastColors } from '../components/micro/Toaster';
import ControlInfo from '../components/micro/ControlInfo';
import CircleButton from '../components/micro/CircleButton';
import EditModal from '../components/EditModal';

/**
 * #TODO:
 * - add better editing (can change name)
 * - add isEditing boolean when editing and change button to say save
 * - add a "lastEntered" key to reducers, and make id of task using that
 * - add testing for proxies (select group via react select drop down
 * 		and control buttons will become enabled, and you can test);
 * - when group is selected from react-select, update table
 * - add toggle switch for use profile group
 * - if they use profile group, make a task for each profile
 */

class Proxies extends React.Component {
  state = {
    proxyGroups: [],
    totalProxies: 0,
    groupNameInput: '',
    proxiesInput: '',
    currentGroupIndex: null,
    editing: false,
    completed: false,
  };

  /**
   * handles input and updates state
   *
   * @param {any} e - Input Event
   * @param {string} toUpdate - State to update
   */
  handleInput = (e, toUpdate) => {
    this.setState({ [toUpdate]: e.target.value }, this.checkComplete);
  };

  /**
   * checks if proxy group form is complete
   */
  checkComplete = () => {
    if (this.state.groupNameInput != '' && this.state.proxiesInput != '') this.setState({ completed: true });
    else this.setState({ completed: false });
  };

  /**
   * saves current group being created/edited
   */
  saveGroup = () => {
    /* Put proxies in the input into an array
			and remove any spaces */
    let newProxies = this.state.proxiesInput.split('\n');
    var proxies = [];
    for (let i = 0; i < newProxies.length; i += 1) {
      if (newProxies[i].length !== 0) {
        proxies.push(newProxies[i]);
      }
    }

    /* Get current groups */
    let proxyGroups = this.state.proxyGroups;
    let proxyGroup = {
      proxyGroupName: this.state.groupNameInput,
      proxies: proxies,
    };

    /* If they are editing update the index of
			the group they are editing */
    if (this.state.editing) {
      proxyGroups[this.state.currentGroupIndex] = proxyGroup;
      notifyMessage('Success', `${this.state.groupNameInput} has been updated.`, toastColors.blue);
    } else {
      const usedNames = this.state.proxyGroups.filter((group) => group.proxyGroupName === this.state.groupNameInput);
      if (usedNames.length === 0) {
        proxyGroups.push(proxyGroup);
        notifyMessage('Success', `Created new proxy group: ${this.state.groupNameInput}.`, toastColors.blue);
      } else {
        notifyMessage('Error!', 'Proxy group name already exists.', toastColors.red);
        return;
      }
    }

    /* Calculate total proxies */
    let totalProxies = 0;
    proxyGroups.forEach((group) => {
      totalProxies += group.proxies.length;
    });

    /* Set state and save new groups array */
    this.setState({
      proxyGroups,
      totalProxies,
      editing: false,
      currentGroupIndex: null,
      groupNameInput: '',
      proxiesInput: '',
    });
    ipcRenderer.send('create-proxy-group', proxyGroups);
  };

  /**
   * loads a group into input to edit
   *
   * @param {array} group - the group to load in
   * @param {int} i - index of the group
   */
  loadGroup = (group, i) => {
    let proxiesInput = '';
    group.proxies.forEach((proxy) => {
      proxiesInput = proxiesInput + proxy + '\n';
    });
    this.setState({
      groupNameInput: group.proxyGroupName,
      proxiesInput,
      currentGroupIndex: i,
      editing: true,
    });
  };

  /**
   * delete proxy group from array
   *
   * @param {int} toDel - index of group to delete
   */
  deleteGroup = (toDel) => {
    let allow = true;
    this.props.currentTasks.forEach((task) => {
      if (task.proxies === this.state.proxyGroups[toDel].proxyGroupName) {
        allow = false;
        return;
      }
    });

    if (!allow) {
      notifyMessage('Hold on!', 'Proxies in use by a task!', toastColors.red);
      return;
    }

    /* Check if currently editing is being deleted */
    if (toDel === this.state.currentGroupIndex) {
      this.setState({
        groupNameInput: '',
        proxiesInput: '',
        currentGroupIndex: null,
        editing: false,
      });
    }

    /* Remove group from array */
    let proxyGroups = this.state.proxyGroups;
    proxyGroups.splice(toDel, 1);

    /* Calculate total proxies */
    let totalProxies = 0;
    proxyGroups.forEach((group) => {
      totalProxies += group.proxies.length;
    });

    /* Set state and save file */
    this.setState({ proxyGroups: proxyGroups, totalProxies }, ipcRenderer.send('create-proxy-group', proxyGroups));
  };

  componentDidMount() {
    ipcRenderer.send('get-proxies');
    ipcRenderer.on('sendProxies', (e, proxyGroups) => {
      let totalProxies = 0;
      proxyGroups.forEach((group) => {
        totalProxies += group.proxies.length;
      });
      this.setState({
        proxyGroups,
        totalProxies,
      });
    });
  }

  render() {
    return (
      <>
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        <div className={`page__content ${this.props.editOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Proxies</h1>
          </div>
          <div className="control-buttons__wrapper">
            <div className="flex--right"></div>
            <div className="flex--right" style={{ color: '#6f7ead' }}>
              <ControlInfo color="blue" text={`${this.state.proxyGroups.length} groups`} />
              <ControlInfo color="green" text={`${this.state.totalProxies} proxies`} />
              <CircleButton clickFunction={() => {}} name="export" />
              <CircleButton clickFunction={() => {}} name="import" />
            </div>
          </div>
          <div className="proxies__wrapper">
            <div className="pp-table__container">
              <div className="table">
                <div className="table__headings">
                  <div className="table__row">
                    <span></span>
                    <span>Group Name</span>
                    <span>Number of Proxies</span>
                    <span>Actions</span>
                  </div>
                </div>
                {this.state.proxyGroups.length > 0 ? (
                  <div className="table__body">
                    {this.state.proxyGroups.map((group, i) => (
                      <div className="table__row">
                        <span>
                          <div className="table__image__wrapper">
                            <img src={proxiesIcon} alt="" className="table__image" />
                          </div>
                        </span>
                        <span>{group.proxyGroupName}</span>
                        <span>{group.proxies.length}</span>
                        <span>
                          <img
                            alt="Edit"
                            className="table__icon"
                            src={EditIcon}
                            onClick={() => {
                              this.loadGroup(group, i);
                            }}
                          />
                          <img
                            alt="Delete"
                            className="table__icon"
                            src={DeleteIcon}
                            onClick={() => {
                              this.deleteGroup(i);
                            }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-table">
                    <div className="no-table__text">No Proxies!</div>
                    <div>Paste some in to the right.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="third__wrapper">
              <div className="third-input__wrapper">
                <h3>Proxy Groups</h3>
                <div className="input__full">
                  <span className="input__text">Group Name</span>
                  <input type="text" className="input" placeholder="Enter New Group Name" onChange={(e) => this.handleInput(e, 'groupNameInput')} value={this.state.groupNameInput} />
                  <span className="error__text"></span>
                </div>
                <div className="proxies__textbox__wrapper">
                  <span className="input__text">Paste Proxies</span>
                  <textarea placeholder="Paste Proxies Here" className="proxies__textbox" onChange={(e) => this.handleInput(e, 'proxiesInput')} value={this.state.proxiesInput}></textarea>
                </div>
              </div>
              <div className="input__full">
                <Button
                  clickFunction={this.state.completed ? this.saveGroup : () => {}}
                  color={this.state.completed ? 'green' : 'green disabled'}
                  icon={this.state.editing ? saveIcon : createIcon}
                  text={this.state.editing ? 'Save' : 'Create'}
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
 * maps reducer state to react props
 *
 * @param {any} state - reducer state
 *
 */
const mapStateToProps = (state) => ({
  currentTasks: state.tasks.currentTasks,
});

export default connect(mapStateToProps, actions)(Proxies);
