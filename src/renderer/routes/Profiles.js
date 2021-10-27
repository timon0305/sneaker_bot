/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/state-in-constructor */
/* eslint-disable react/prefer-stateless-function */
import React from 'react';
import { NavLink as Link } from 'react-router-dom';
import { ipcRenderer } from 'electron';

/* Redux dependencies */
import { connect } from 'react-redux';
import * as actions from '../actions';

import '../styles/Profiles.scss';

import CreatableSelect from 'react-select/creatable';
import { selectStyles } from './creationComponents/SelectStyles';

/* Action icons for profile actions */
import createIcon from '../assets/actions/create.svg';
import createIconG from '../assets/actions/create_green.svg';
import saveIcon from '../assets/actions/save.svg';
import deleteIcon from '../assets/actions/delete.svg';
import editIcon from '../assets/actions/edit.svg';
import removeIcon from '../assets/actions/remove.svg';
import duplicateIcon from '../assets/actions/duplicate.svg';

/* Card icons for table */
import mastercardIcon from '../assets/tableIcons/mastercard.svg';
import amexIcon from '../assets/tableIcons/amex.svg';
import visaIcon from '../assets/tableIcons/visa.svg';
import discoverIcon from '../assets/tableIcons/discover.svg';
import dinersIcon from '../assets/tableIcons/diners.png';
import jcbIcon from '../assets/tableIcons/jcb.svg';

/* Control Info and Buttons */
import ControlInfo from '../components/micro/ControlInfo';
import CircleButton from '../components/micro/CircleButton';
import Button from '../components/micro/Button';
import EditModal from '../components/EditModal';
import { notifyMessage, toastColors } from '../components/micro/Toaster';

/**
 * #TODO:
 * - Adding profile groups
 * - Checking if profile name already exists when they try to create a new one
 */

class NewProfiles extends React.Component {
  state = {
    groupProfiles: [],
    groupName: '',
    editing: false,
    completed: false,
    index: 0,
    error: '',
  };

  componentDidMount() {
    ipcRenderer.on('importProfiles', (e, profiles, groups) => {
      this.props.importProfiles(profiles, groups);
      this.forceUpdate();
    });
  }

  /**
   * Adds profile to group
   */
  addToGroup = (profile) => {
    let { groupProfiles } = this.state;
    if (!groupProfiles.includes(profile.profilename)) {
      groupProfiles.push(profile.profilename);
    }
    this.setState({ groupProfiles }, this.checkComplete);
  };

  removeFromGroup = (i) => {
    let { groupProfiles } = this.state;
    groupProfiles.splice(i, 1);
    this.setState({ groupProfiles }, this.checkComplete);
  };

  handleCreatable = (e) => {
    if (e.__isNew__ === undefined) {
      this.setState({
        groupProfiles: e.value,
        groupName: e.label,
        editing: true,
        index: e.ind,
        completed: false,
      });
    } else {
      if (this.state.groupName !== '') {
        this.setState({
          groupName: e.label,
          groupProfiles: [],
          editing: false,
          index: 0,
        });
      } else {
        this.setState(
          {
            groupName: e.label,
            editing: false,
            index: 0,
          },
          this.checkComplete,
        );
      }
    }
  };

  checkComplete = () => {
    if (this.state.groupProfiles.length !== 0 && this.state.groupName !== '') {
      this.setState({ completed: true });
    } else {
      this.setState({ completed: false });
    }
  };

  duplicateProfile = (profile, index) => {
    let newProfile = { ...profile };
    let copyNum = 1;
    let profilename = `${this.props.currentProfileNames[index]} (${copyNum})`;
    console.log(`Duplicating profile...`);
    while (this.props.currentProfileNames.includes(profilename)) {
      console.log(`${profilename} already exists.`);
      copyNum += 1;
      profilename = `${this.props.currentProfileNames[index]} (${copyNum})`;
    }
    newProfile.profilename = profilename;
    ipcRenderer.send('profile-created', newProfile);
    console.log(`Creating duplicate profile: ${profilename}`);
    this.props.createProfile(newProfile);
    this.forceUpdate();
  };

  /**
   * Deletes profile given its index
   */
  deleteProfile = (index) => {
    let allow = true;
    this.props.currentTasks.forEach((task) => {
      if (task.profile === this.props.currentProfiles[index].profilename) {
        allow = false;
        return;
      }
    });

    if (!allow) {
      notifyMessage('Hold on!', 'Profile in use by a task!', toastColors.red);
      return;
    }

    let { groupProfiles } = this.state;
    this.props.deleteProfile(index);
    groupProfiles = groupProfiles.filter((profilename) => this.props.currentProfileNames.includes(profilename));
    this.setState({ groupProfiles });
    ipcRenderer.send('delete-profile', index);
    const notAllGroups = this.props.profileGroups.slice(1);
    notAllGroups.forEach((group) => {
      ipcRenderer.send('update-profile-group', { label: group.label, value: group.value, ind: group.ind }, group.ind - 1);
    });
    this.forceUpdate();
  };

  deleteGroup = () => {
    this.props.deleteProfGroup(this.state.index);
    this.setState({
      groupName: '',
      groupProfiles: [],
      editing: false,
      index: 0,
    });
    ipcRenderer.send('delete-profile-group', this.state.index - 1);
  };

  addGroup = () => {
    if (!this.state.editing) {
      this.props.createProfGroup({
        label: this.state.groupName,
        value: this.state.groupProfiles,
        ind: this.props.profileGroups.length,
      });
      notifyMessage('Success', `Created new profile group: ${this.state.groupName}.`, toastColors.blue);
      ipcRenderer.send('create-profile-group', {
        label: this.state.groupName,
        value: this.state.groupProfiles,
        ind: this.props.profileGroups.length - 1,
      });
    } else {
      this.props.editProfGroup({ label: this.state.groupName, value: this.state.groupProfiles, ind: this.state.index }, this.state.index);
      notifyMessage('Success', `${this.state.groupName} has been updated.`, toastColors.blue);
      ipcRenderer.send('update-profile-group', { label: this.state.groupName, value: this.state.groupProfiles, ind: this.state.index }, this.state.index - 1);
    }
    this.setState({ editing: true, completed: false, error: '' });
    this.forceUpdate();
  };

  importFile = (e) => {
    console.log('What the fuck');
    ipcRenderer.send('import-profiles', e.target.files[0].path);
    this.forceUpdate();
  };

  render() {
    return (
      <>
        <input
          ref="importFile"
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            let allow = true;
            this.props.currentTasks.forEach((task) => {
              if (this.props.currentProfileNames.includes(task.profile)) {
                allow = false;
              }
            });
            if (allow) {
              this.importFile(e);
            } else {
              notifyMessage('Hold on!', 'You have profiles in use by a task!', toastColors.red);
            }
          }}
        />
        <EditModal editOpen={this.props.editOpen} editClose={this.props.editClose} />
        <div className={`page__content ${this.props.editOpen ? 'hidden' : ''}`}>
          <div className="header">
            <h1>Profiles</h1>
          </div>
          <div className="control-buttons__wrapper">
            <div className="flex--right">
              <Link
                exact
                to="/createProfiles"
                className="button blue"
                onClick={() => {
                  this.props.setProfIndex(null);
                }}
              >
                <img src={createIcon} className="button__img" />
                Create
              </Link>
            </div>
            <div className="flex--right" style={{ color: '#6f7ead' }}>
              <ControlInfo color="blue" text={`${this.props.profileGroups.length} groups`} />
              <ControlInfo color="green" text={`${this.props.currentProfiles.length} profiles`} />
              <CircleButton clickFunction={() => this.refs.importFile.click()} name="export" />
              <CircleButton clickFunction={() => ipcRenderer.send('export-profiles')} name="import" />
            </div>
          </div>
          <div className="profiles__wrapper">
            <div className="pp-table__container">
              <div className="table">
                <div className="table__headings">
                  <div className="table__row">
                    <span></span>
                    <span>Profile Name</span>
                    <span>Card Type</span>
                    <span>Cardholder</span>
                    <span>Last Four</span>
                    <span>Actions</span>
                  </div>
                </div>
                {this.props.currentProfiles.length > 0 ? (
                  <div className="table__body">
                    {this.props.currentProfiles.map((profile, i) => (
                      <div className={this.state.groupProfiles.includes(profile.profilename) ? 'table__row selected' : 'table__row'}>
                        <span>
                          <div className="table__image__wrapper">
                            <img
                              src={
                                profile.cardtype === 'Mastercard'
                                  ? mastercardIcon
                                  : profile.cardtype === 'Visa'
                                  ? visaIcon
                                  : profile.cardtype === 'Amex'
                                  ? amexIcon
                                  : profile.cardtype === 'Discover'
                                  ? discoverIcon
                                  : profile.cardtype === 'Diners Club'
                                  ? dinersIcon
                                  : jcbIcon
                              }
                              alt=""
                              className="table__image"
                            />
                          </div>
                        </span>
                        <span onClick={() => this.addToGroup(profile)} style={{ cursor: 'pointer' }}>
                          {profile.profilename}
                        </span>
                        <span>{profile.cardtype}</span>
                        <span>{profile.cardholdername}</span>
                        <span>{profile.cardnumber.slice(String(profile.cardnumber).length - 4)}</span>
                        <span>
                          <Link
                            exact
                            to={`/createProfiles?${profile.profilename}&${i}`}
                            onClick={() => {
                              this.props.setProfIndex(i);
                            }}
                          >
                            <img src={editIcon} alt="" className="table__icon" />
                          </Link>
                          <img onClick={() => this.duplicateProfile(profile, i)} src={duplicateIcon} alt="" className="table__icon" />
                          <img onClick={() => this.deleteProfile(i)} src={deleteIcon} alt="" className="table__icon" />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-table">
                    <div className="no-table__text">No Profiles!</div>
                    <div>Click 'Create' to make some.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="third__wrapper">
              <h3>Profile Groups</h3>
              <div className="input__full">
                <div className="input__text">Group Name</div>
                <CreatableSelect
                  options={this.props.profileGroups.slice(1)}
                  styles={selectStyles}
                  onChange={(e) => {
                    this.handleCreatable(e);
                  }}
                  placeholder="Type new group name or select one"
                />
                <span className="error__text" />
              </div>
              <div className="input__text">Selected Groups (Click profile name to select)</div>
              <div className="selected-profiles__wrapper">
                {this.state.groupProfiles.map((profile, i) => (
                  <div className="selected__profile">
                    <div />
                    <div>{profile}</div>
                    <img src={removeIcon} alt="" className="remove-icon" onClick={() => this.removeFromGroup(i)} />
                  </div>
                ))}
              </div>
              {this.state.editing ? (
                <div className="input__split">
                  <div className="input__half">
                    <Button icon={deleteIcon} text="Delete" color="red" clickFunction={this.deleteGroup} />
                  </div>
                  <div className="input__half">
                    <Button
                      icon={this.state.editing ? saveIcon : createIconG}
                      text={this.state.editing ? 'Save' : 'Create'}
                      color={this.state.completed ? 'green' : 'green disabled'}
                      clickFunction={this.state.completed ? () => this.addGroup() : () => {}}
                    />
                  </div>
                </div>
              ) : (
                <div className="input__full">
                  <Button
                    icon={this.state.editing ? saveIcon : createIconG}
                    text={this.state.editing ? 'Save' : 'Create'}
                    color={this.state.completed ? 'green' : 'green disabled'}
                    clickFunction={this.state.completed ? () => this.addGroup() : () => {}}
                  />
                </div>
              )}
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
  currentProfiles: state.profiles.currentProfiles,
  currentProfileNames: state.profiles.currentProfileNames,
  profileGroups: state.profiles.profileGroups,
});

export default connect(mapStateToProps, actions)(NewProfiles);
