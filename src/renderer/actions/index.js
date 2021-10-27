import axios from 'axios';

import {
  UPDATE_ONE_TASK,
  CREATE_TASKS,
  DELETE_ONE_TASK,
  LOAD_PROFILES,
  CREATE_PROFILE,
  DELETE_PROFILE,
  UPDATE_PROFILE,
  LOAD_TASKS,
  CREATE_PROF_GROUP,
  EDIT_PROF_GROUP,
  EDIT_TASK,
  SET_ACCOUNT_POOL,
  SET_RATES,
  SET_ANALYTICS,
  MASS_EDIT_TASK,
  IMPORT_PROFILES,
  DELETE_PROF_GROUP,
  HIDE_KEY,
  COUNT_CHECKOUT,
  LOAD_ANALYTICS,
  ADD_HARVESTER,
  DEL_HARVESTER,
  SET_HARVESTERS,
  SET_ANALYTICS_LOADED,
  UPDATE_HARVESTERS,
} from './types';

/**
 * Dispatch TASK actions, and send them to task reducer
 */
export const loadTasks = (tasks) => async (dispatch) => {
  dispatch({ type: LOAD_TASKS, payload: tasks });
};

export const updateOneTask = (task) => async (dispatch) => {
  dispatch({ type: UPDATE_ONE_TASK, payload: task });
};

export const createTasks = (tasks) => async (dispatch) => {
  dispatch({ type: CREATE_TASKS, payload: tasks });
};

export const deleteOneTask = (task) => async (dispatch) => {
  dispatch({ type: DELETE_ONE_TASK, payload: task });
};

export const editTask = (task, index) => async (dispatch) => {
  dispatch({ type: EDIT_TASK, payload: { task, index } });
};

export const massEditTask = (task) => async (dispatch) => {
  dispatch({ type: MASS_EDIT_TASK, payload: task });
};

export const countCheckout = () => async (dispatch) => {
  dispatch({ type: COUNT_CHECKOUT, payload: {} });
};

/**
 * Dispatch PROFILE actions, and send them to task reducer
 */
export const loadProfiles = (profiles, groups) => async (dispatch) => {
  dispatch({ type: LOAD_PROFILES, payload: { profiles, groups } });
};

export const createProfile = (profile) => async (dispatch) => {
  dispatch({ type: CREATE_PROFILE, payload: profile });
};

export const deleteProfile = (index) => async (dispatch) => {
  dispatch({ type: DELETE_PROFILE, payload: index });
};

export const updateProfile = (profile, i) => async (dispatch) => {
  dispatch({ type: UPDATE_PROFILE, payload: [profile, i] });
};

export const createProfGroup = (group) => async (dispatch) => {
  dispatch({ type: CREATE_PROF_GROUP, payload: group });
};

export const deleteProfGroup = (index) => async (dispatch) => {
  dispatch({ type: DELETE_PROF_GROUP, payload: index });
};

export const editProfGroup = (group, i) => async (dispatch) => {
  dispatch({ type: EDIT_PROF_GROUP, payload: { group, i } });
};

export const importProfiles = (profiles, groups) => async (dispatch) => {
  dispatch({ type: IMPORT_PROFILES, payload: { profiles, groups } });
};

/**
 * Dispatch FILE actions
 */
export const setAccountPools = (accounts) => async (dispatch) => {
  dispatch({ type: SET_ACCOUNT_POOL, payload: accounts });
};

export const setShippingRates = (rates) => async (dispatch) => {
  dispatch({ type: SET_RATES, payload: rates });
};

export const setAnalytics = (analytics) => async (dispatch) => {
  dispatch({ type: SET_ANALYTICS, payload: analytics });
};

export const addHarvester = (harvester) => async (dispatch) => {
  console.log('hello.... adddd???');
  dispatch({ type: ADD_HARVESTER, payload: harvester });
};

export const delHarvester = (harvester) => async (dispatch) => {
  dispatch({ type: DEL_HARVESTER, payload: harvester });
};

export const setHarvesters = (harvesters) => async (dispatch) => {
  dispatch({ type: SET_HARVESTERS, payload: harvesters });
};

export const updateHarvesters = (i, proxy) => async (dispatch) => {
  dispatch({ type: UPDATE_HARVESTERS, payload: { i, proxy } });
};

/**
 * Dispatch SETTINGS actions
 */

export const hideKey = () => async (dispatch) => {
  dispatch({ type: HIDE_KEY, payload: {} });
};

/** Load analytics */
export const setAnalyticsLoaded = (allAnalytics) => async (dispatch) => {
  dispatch({ type: SET_ANALYTICS_LOADED, payload: allAnalytics });
};
