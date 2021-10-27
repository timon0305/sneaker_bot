export const selectStyles = {
  control: (styles) => ({
    ...styles,
    width: '100%',
    backgroundColor: '#1b2545',
    borderColor: '#4f5b7a',
    borderWidth: '0px 0px 4px 0px',
    cursor: 'pointer',
    boxShadow: 'none',
    marginTop: '8px',
    maxHeight: '40px',
    minHeight: '40px',
    maxWidth: '100%',
    overflow: 'auto',
    overflowX: 'auto',
    '&:hover': {
      borderColor: '#4f5b7a',
    },
  }),
  placeholder: (styles) => ({
    ...styles,
    color: '#4f5b7a',
  }),
  input: (styles) => ({
    ...styles,
    color: '#6f7ead',
    maxWidth: '344px',
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#6f7ead',
  }),
  indicatorSeparator: (styles) => ({
    ...styles,
    backgroundColor: '#6f7ead',
  }),
  indicatorsContainer: (styles) => ({
    ...styles,
    svg: {
      fill: '#6f7ead',
    },
  }),
  menuList: (styles) => ({
    ...styles,
    color: '#414d6b',
  }),
  multiValue: (styles) => ({
    ...styles,
    backgroundColor: '#4f5b7a',
    maxWidth: '344px',
  }),
  multiValueLabel: (styles) => ({
    ...styles,
    color: 'white',
  }),
  multiValueRemove: (styles) => ({
    ...styles,
    '&:hover': {
      backgroundColor: '#ff3c5c3b',
      color: '#ff3c5d',
    },
  }),
  menu: (styles) => ({
    ...styles,
    zIndex: 3,
  }),
};

export const disabledSelect = {
  control: (styles) => ({
    ...styles,
    width: '100%',
    backgroundColor: '#171f3a',
    borderColor: '#1a2342',
    borderWidth: '0px 0px 4px 0px',
    cursor: 'pointer',
    boxShadow: 'none',
    marginTop: '8px',
    maxHeight: '40px',
    minHeight: '40px',
    overflow: 'auto',
    '&:hover': {
      borderColor: '#1a2342',
    },
  }),
  placeholder: (styles) => ({
    ...styles,
    color: '#3b445b',
  }),
  indicatorSeparator: (styles) => ({
    ...styles,
    backgroundColor: '#3b445b',
  }),
  indicatorsContainer: (styles) => ({
    ...styles,
    svg: {
      fill: '#3b445b',
    },
  }),
  input: (styles) => ({
    ...styles,
    color: '#3b445b',
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#3b445b',
  }),
};

export const keywordsStyles = {
  control: (styles) => ({
    ...styles,
    width: '100%',
    backgroundColor: '#1b2545',
    borderColor: '#4f5b7a',
    borderWidth: '0px 0px 4px 0px',
    cursor: 'pointer',
    boxShadow: 'none',
    marginTop: '8px',
    maxHeight: '40px',
    minHeight: '40px',
    overflow: 'auto',
    maxWidth: '100%',
    overflow: 'auto',
    '&:hover': {
      borderColor: '#4f5b7a',
    },
  }),
  placeholder: (styles) => ({
    ...styles,
    color: '#4f5b7a',
  }),
  input: (styles) => ({
    ...styles,
    color: '#6f7ead',
    maxWidth: '344px',
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#6f7ead',
  }),
  indicatorSeparator: (styles) => ({
    ...styles,
    backgroundColor: '#6f7ead',
  }),
  indicatorsContainer: (styles) => ({
    ...styles,
    color: '#6f7ead',
  }),
  menuList: (styles) => ({
    ...styles,
    color: '#414d6b',
  }),
  multiValue: (styles, { data }) => ({
    ...styles,
    backgroundColor: data.color === '#ff3c5d' ? '#ff3c5c3b' : '#00b36531',
    maxWidth: '344px',
  }),
  multiValueLabel: (styles, { data }) => ({
    ...styles,
    color: data.color,
  }),
  multiValueRemove: (styles, { data }) => ({
    ...styles,
    color: data.color,
    '&:hover': {
      backgroundColor: data.color,
      color: 'white',
    },
  }),
};

export const viewsStyles = {
  control: (styles) => ({
    ...styles,
    width: 'auto',
    backgroundColor: 'transparent',
    borderColor: '#4f5b7a',
    borderWidth: '0px 0px 0px 0px',
    cursor: 'pointer',
    boxShadow: 'none',
    marginTop: '8px',
    overflow: 'auto',
    overflowX: 'auto',
    maxHeight: '36px',
    minHeight: '36px',
    '&:hover': {
      borderColor: '#4f5b7a',
    },
  }),
  placeholder: (styles) => ({
    ...styles,
    color: '#4f5b7a',
  }),
  input: (styles) => ({
    ...styles,
    color: '#6f7ead',
    width: 'auto',
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#6f7ead',
  }),
  indicatorSeparator: (styles) => ({
    ...styles,
    backgroundColor: 'transparent',
  }),
  indicatorsContainer: (styles) => ({
    ...styles,
    svg: {
      fill: 'transparent',
    },
  }),
  menuList: (styles) => ({
    ...styles,
    color: '#414d6b',
  }),
  multiValue: (styles) => ({
    ...styles,
    backgroundColor: '#4f5b7a',
    maxWidth: '344px',
  }),
  multiValueLabel: (styles) => ({
    ...styles,
    color: 'white',
  }),
  multiValueRemove: (styles) => ({
    ...styles,
    '&:hover': {
      backgroundColor: '#ff3c5c3b',
      color: '#ff3c5d',
    },
  }),
  menu: (styles) => ({
    ...styles,
    zIndex: 3,
  }),
};

export const keywordsComponents = {
  DropdownIndicator: null,
};
