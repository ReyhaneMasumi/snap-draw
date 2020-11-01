import theme from '@mapbox/mapbox-gl-draw/src/lib/theme';

const modifiedDefaultStyles = theme.map(defaultStyle => {
  if (defaultStyle.id === 'gl-draw-line-inactive') {
    return {
      ...defaultStyle,
      filter: [
        ...defaultStyle.filter,
        ['!=', 'user_isSnapGuide', 'true'],
      ],
    };
  }

  return defaultStyle;
});

const customDrawStyles = [
  ...modifiedDefaultStyles,
  {
    'id': 'guide',
    'type': 'line',
    'filter': ['all',
      ['==', '$type', 'LineString'],
      ['==', 'user_isSnapGuide', 'true'],
    ],
    'layout': {
      'line-cap': 'round',
      'line-join': 'round'
    },
    'paint': {
      'line-color': '#ff0000',
      'line-width': 1,
      'line-dasharray': [5, 5],
    },
  },
];

export default customDrawStyles;
