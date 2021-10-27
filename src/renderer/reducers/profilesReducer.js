import { LOAD_PROFILES, CREATE_PROFILE, DELETE_PROFILE, UPDATE_PROFILE, CREATE_PROF_GROUP, EDIT_PROF_GROUP, IMPORT_PROFILES, DELETE_PROF_GROUP } from '../actions/types';

const intialState = {
  currentProfiles: [],
  currentProfileNames: [],
  profileGroups: [],
  profilesLoaded: false,
};

export default function(state = intialState, action) {
  const newState = { ...state };

  /* Update newState based on action typee */
  switch (action.type) {
    /* Will take profiles sent from main, and append to state */
    case LOAD_PROFILES:
      if (!newState.profilesLoaded) {
        action.payload.profiles.forEach((profile) => {
          newState.currentProfiles.push(profile);
          newState.currentProfileNames.push(profile.profilename);
        });
        newState.profileGroups.push({ label: 'All', value: newState.currentProfileNames, ind: 0 });
        action.payload.groups.forEach((group) => {
          newState.profileGroups.push(group);
        });
      }
      console.log('Profiles loaded.');
      console.log(action.payload.profiles, action.payload.groups);
      console.log(newState);
      newState.profilesLoaded = true;
      return newState;
    /* Will take new profile data and add it to current state */
    case CREATE_PROFILE:
      if (!newState.currentProfileNames.includes(action.payload.profilename)) {
        newState.currentProfiles.push(action.payload);
        newState.currentProfileNames.push(action.payload.profilename);
        newState.profileGroups[0] = { label: 'All', value: newState.currentProfileNames, ind: 0 };
      }
      console.log('New profile created.');
      return newState;
    case UPDATE_PROFILE:
      newState.currentProfiles[action.payload[1]] = action.payload[0];
      newState.currentProfileNames[action.payload[1]] = action.payload[0].profilename;
      newState.profileGroups[0] = { label: 'All', value: newState.currentProfileNames, ind: 0 };
      console.log('Profile updated.');
      return newState;
    case DELETE_PROFILE:
      const delName = newState.currentProfileNames[action.payload];
      newState.currentProfiles.splice(action.payload, 1);
      newState.currentProfileNames.splice(action.payload, 1);
      newState.profileGroups.forEach((group, index) => {
        console.log(index);
        if (group.value.includes(delName)) {
          const newGroup = group.value.filter((profilename) => newState.currentProfileNames.includes(profilename));
          newState.profileGroups[index].value = newGroup;
        }
      });
      newState.profileGroups[0] = { label: 'All', value: newState.currentProfileNames, ind: 0 };
      console.log('Profile deleted.');
      return newState;
    case CREATE_PROF_GROUP:
      newState.profileGroups.push(action.payload);
      console.log('Profile group created.');
      return newState;
    case DELETE_PROF_GROUP:
      newState.profileGroups.splice(action.payload, 1);
      console.log('Deleted profile group.');
      return newState;
    case EDIT_PROF_GROUP:
      newState.profileGroups[action.payload.i] = action.payload.group;
      console.log('Profile group edited.');
      return newState;
    case IMPORT_PROFILES:
      newState.currentProfileNames = [];
      newState.currentProfiles = [];
      newState.profileGroups = [];
      action.payload.profiles.forEach((profile) => {
        newState.currentProfileNames.push(profile.profilename);
      });
      newState.currentProfiles = action.payload.profiles;
      newState.profileGroups.push({ label: 'All', value: newState.currentProfileNames, ind: 0 });
      action.payload.groups.forEach((group) => {
        newState.profileGroups.push(group);
      });
      console.log(newState);
      return newState;
    default:
      return newState;
  }
}
