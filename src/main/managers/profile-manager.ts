import * as path from 'path';
import * as fs from 'fs';
import { app, dialog } from 'electron';
import mainWindow from '../helpers/main-window';
import { IProfile } from '../interfaces';
import regions from '../helpers/profile-regions';

import { STATE_MAPPING } from './constants';

const userDataPath = app.getPath('userData');

// TODO: Add profile types. (Waiting for completed profile format)
let allProfiles = [];
let allProfileGroups = [];
const profilesFile = path.join(userDataPath, 'profiles.json');

/**
 * Gets all saved profiles and saves them to an array
 */
function getAllProfiles(): void {
  const profiles = fs.readFileSync(profilesFile, 'utf8');
  const { savedProfiles, profileGroups } = JSON.parse(profiles);
  allProfiles = savedProfiles;
  allProfileGroups = profileGroups;
  /*
  savedProfiles.forEach(profile => {
    allProfiles.push(profile);
  });
  profileGroups.forEach(group => {
    allProfileGroups.push(group);
  }); */
}

/**
 * Initializes profiles file. If it doesnt exist, it makes one.
 */
function initProfiles(): void {
  if (!fs.existsSync(profilesFile)) {
    fs.writeFileSync(
      profilesFile,
      '{"savedProfiles":[{"billing":{"address":"","apt":"","city":"","country":"United States","countrycode":"US","state":"AL","zip":""},"cardholdername":"John Doe","cardnumber":"4242424242424242","cardtype":"Visa","cvv":"123","email":"example@gmail.com","expdate":"01/23","firstname":"John","lastname":"Doe","phone":"1234567890","profilename":"Example","shipping":{"address":"1234 My Street","apt":"","city":"New York","country":"United States","countrycode":"US","state":"NY","zip":"12345"},"usebilling":false,"useonce":false}],"profileGroups":[]}',
      'utf8',
    );
  } else {
    getAllProfiles();
  }
}

function saveProfile(profileData): void {
  const profiles = allProfiles;
  let alreadyExists = false;
  for (let i = 0; i < profiles.length; i += 1) {
    if (profiles[i].profilename === profileData.profilename) {
      profiles[i] = profileData;
      alreadyExists = true;
      break;
    }
  }
  if (!alreadyExists) {
    profiles.push(profileData);
  }
  const profilesFileData = { savedProfiles: profiles, profileGroups: allProfileGroups };
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
}

function saveGroup(groupData) {
  // console.log('this is being called somehow?');
  const groups = allProfileGroups;
  groups.push(groupData);
  const profilesFileData = { savedProfiles: allProfiles, profileGroups: groups };
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
}

function deleteGroup(index) {
  const groups = allProfileGroups;
  groups.splice(index, 1);
  const profilesFileData = { savedProfiles: allProfiles, profileGroups: groups };
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
}

function updateGroup(groupData, index): void {
  // console.log(index);
  allProfileGroups[index] = groupData;
  const profilesFileData = { savedProfiles: allProfiles, profileGroups: allProfileGroups };
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
}

function deleteProfile(index): void {
  allProfiles.splice(index, 1);
  const profilesFileData = { savedProfiles: allProfiles, profileGroups: allProfileGroups };
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
}

function updateProfile(profile, index): void {
  // console.log(`updating profile ${profile.profilename}`);
  allProfiles[index] = profile;
  const profilesFileData = { savedProfiles: allProfiles, profileGroups: allProfileGroups };
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
}

function sendProfiles(): void {
  if (allProfiles.length === 0) {
    getAllProfiles();
  }
  mainWindow.sendProfiles(allProfiles, allProfileGroups);
}

function getProfile(profileWanted: string): any {
  let foundProfile = {};
  for (let i = 0; i < allProfiles.length; i += 1) {
    const profile = allProfiles[i];
    if (profile.profilename === profileWanted) {
      foundProfile = profile;
      break;
    }
  }
  return foundProfile;
}

function exportProfiles(): void {
  const options = {
    title: 'Save Profiles',
    defaultPath: 'profiles.json',
    buttonLabel: 'Save Profiles',
    filters: [{ name: '.json', extensions: ['json'] }],
  };
  const profilesFileData = { savedProfiles: allProfiles, profileGroups: allProfileGroups };

  dialog.showSaveDialog(options).then((filename) => {
    fs.writeFileSync(filename.filePath, JSON.stringify(profilesFileData), 'utf-8');
  });
}

function importProfiles(filePath): void {
  const openFile = fs.readFileSync(filePath, 'utf8');
  let importSuccess = true;
  const importErrors = {
    MAIN: 'main',
    KEYS: 'keys',
    BILLSHIP: 'billship',
  };
  let error = 'none';

  try {
    const profiles = JSON.parse(openFile);

    if (Object.keys(profiles).includes('savedProfiles') && Object.keys(profiles).includes('profileGroups')) {
      const checkProfiles = profiles.savedProfiles;
      checkProfiles.forEach((profile) => {
        const profileKeys = Object.keys(profile);
        if (
          profileKeys.includes('billing') &&
          profileKeys.includes('shipping') &&
          profileKeys.includes('cardnumber') &&
          profileKeys.includes('cardholdername') &&
          profileKeys.includes('cardtype') &&
          profileKeys.includes('expdate') &&
          profileKeys.includes('cvv') &&
          profileKeys.includes('email') &&
          profileKeys.includes('phone') &&
          profileKeys.includes('profilename') &&
          profileKeys.includes('firstname') &&
          profileKeys.includes('lastname') &&
          profileKeys.includes('usebilling') &&
          profileKeys.includes('useonce')
        ) {
          const shippingCountry = regions.filter(
            (region) =>
              region.label === profile.shipping.country || region.value === profile.shipping.country || region.label === profile.shipping.countrycode || region.value === profile.shipping.countrycode,
          )[0];
          const billingCountry = regions.filter(
            (region) =>
              region.label === profile.billing.country || region.value === profile.billing.country || region.label === profile.billing.countrycode || region.value === profile.billing.countrycode,
          )[0];
          if (!(shippingCountry && billingCountry)) {
            importSuccess = false;
            error = importErrors.BILLSHIP;
          }
        } else {
          importSuccess = false;
          error = importErrors.KEYS;
        }
      });
    } else {
      importSuccess = false;
      error = importErrors.MAIN;
    }

    if (importSuccess) {
      allProfiles = profiles.savedProfiles;
      allProfileGroups = profiles.profileGroups;
      const profilesFileData = { savedProfiles: allProfiles, profileGroups: allProfileGroups };
      fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
      mainWindow.importProfiles(allProfiles, allProfileGroups);
      mainWindow.sendNotif({ title: 'Success!', message: 'Successfully imported profiles.', color: 'blue' });
    } else if (error === importErrors.MAIN) {
      mainWindow.sendNotif({ title: 'Error!', message: 'Missing main import format.', color: 'red' });
    } else if (error === importErrors.KEYS) {
      mainWindow.sendNotif({ title: 'Error!', message: 'Missing correct profile object key format.', color: 'red' });
    } else {
      mainWindow.sendNotif({ title: 'Error!', message: 'Incorrect billing/shipping format.', color: 'red' });
    }
  } catch (e) {
    mainWindow.sendNotif({ title: 'Error!', message: e.message, color: 'red' });
  }

  // AYCD FORMAT IMPORTING
  /*
  const openFile = fs.readFileSync(filePath, 'utf8');
  const profiles = JSON.parse(openFile);
  const newProfiles = [];
  profiles.forEach(profile => {
    const shippingCountry = regions.filter(
      region =>
        region.label === profile.shippingAddress.country.trim() ||
        region.value === profile.shippingAddress.country.trim(),
    )[0];
    const billingCountry = regions.filter(
      region =>
        region.label === profile.billingAddress.country.trim() ||
        region.value === profile.shippingAddress.country.trim(),
    )[0];
    const shippingStateArr = shippingCountry.regions.filter(
      state =>
        state.label === profile.shippingAddress.state.trim() || state.value === profile.shippingAddress.state.trim(),
    );
    const billingStateArr = billingCountry.regions.filter(
      state =>
        state.label === profile.billingAddress.state.trim() || state.value === profile.shippingAddress.state.trim(),
    );
    let shippingState = null;
    let billingState = null;
    if (shippingStateArr.length > 0) {
      shippingState = shippingStateArr[0].value;
    }
    if (billingStateArr.length > 0) {
      billingState = billingStateArr[0].value;
    }
    const newProfile: IProfile = {
      profilename: profile.name,
      firstname: profile.shippingAddress.name.split(' ')[0],
      lastname: profile.shippingAddress.name.split(' ')[1],
      email: profile.shippingAddress.email,
      phone: profile.shippingAddress.phone,
      cardholdername: profile.paymentDetails.nameOnCard,
      cardnumber: profile.paymentDetails.cardNumber,
      expdate: `${profile.paymentDetails.cardExpMonth}/${profile.paymentDetails.cardExpYear.substr(2)}`,
      cvv: profile.paymentDetails.cardCvv,
      cardtype: profile.paymentDetails.cardType,
      usebilling: profile.paymentDetails.sameBillingAndShippingAddress,
      shipping: {
        address: profile.shippingAddress.line1,
        apt: profile.shippingAddress.line2,
        city: profile.shippingAddress.city,
        country: profile.shippingAddress.country,
        countrycode: shippingCountry.value,
        state: shippingState,
        stateName: STATE_MAPPING[shippingState],
        zip: profile.shippingAddress.postCode,
      },
      billing: {
        address: profile.billingAddress.line1,
        apt: profile.billingAddress.line2,
        city: profile.billingAddress.city,
        country: profile.billingAddress.country,
        countrycode: billingCountry.value,
        state: billingState,
        stateName: STATE_MAPPING[billingState],
        zip: profile.billingAddress.postCode,
      },
    };
    newProfiles.push(newProfile);
  });

  allProfiles = newProfiles;
  allProfileGroups = [];
  const profilesFileData = {savedProfiles: allProfiles, profileGroups: allProfileGroups};
  fs.writeFileSync(profilesFile, JSON.stringify(profilesFileData));
  mainWindow.importProfiles(allProfiles, allProfileGroups); */
}

export default {
  initProfiles,
  saveProfile,
  allProfiles,
  sendProfiles,
  deleteProfile,
  getProfile,
  updateProfile,
  saveGroup,
  updateGroup,
  importProfiles,
  exportProfiles,
  deleteGroup,
};
