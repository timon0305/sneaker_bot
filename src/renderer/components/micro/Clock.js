import * as React from 'react';

const getTime = () => {
  const date = new Date();
  return `${date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()}:${date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()}:${
    date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()
  }`;
};

export default (props) => {
  const [time, setTime] = React.useState(props.time);
  setInterval(() => setTime(getTime()), 500);
  return <div>{time}</div>;
};
