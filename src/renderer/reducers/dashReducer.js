import { LOAD_ANALYTICS } from '../actions/types';

import axios from 'axios';

const initialState = {
  analytics: {},
};

export default function(state = initialState, action) {
  const newState = { ...state };

  switch (action.type) {
    case LOAD_ANALYTICS:
      newState.analytics = action.payload;
      console.log(newState);
      return newState;
    default:
      return newState;
  }
}
