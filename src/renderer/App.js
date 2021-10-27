import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import { MemoryRouter as Router } from 'react-router-dom';

/* Redux */
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import reduxThunk from 'redux-thunk';
import reducers from './reducers';

import './styles/main.scss';

import Application from './components/Application';

const store = createStore(reducers, {}, applyMiddleware(reduxThunk));

// Create main element
const mainElement = document.createElement('div');
mainElement.id = 'root'; // Feels weird typing this in react haha
document.body.appendChild(mainElement);

const App = () => (
  <AppContainer>
    <Router>
      <Application />
    </Router>
  </AppContainer>
);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  mainElement,
);
