import {
  geojsonTypes,
  modes,
  cursors
} from "@mapbox/mapbox-gl-draw/src/constants";
import doubleClickZoom from "@mapbox/mapbox-gl-draw/src/lib/double_click_zoom";
import DrawLine from "@mapbox/mapbox-gl-draw/src/modes/draw_line_string";
import {
  addPointTovertices,
  createSnapList,
  findSnapFeatures,
  getGuideFeature,
  IDS,
  roundLngLatTo1Cm,
  shouldHideGuide,
  snap
} from "./snapUtils";

const SnapLineMode = { ...DrawLine };

SnapLineMode.onSetup = function({ draw, snapPx = 10, isSnappy = false }) {
  const line = this.newFeature({
    type: geojsonTypes.FEATURE,
    properties: {},
    geometry: {
      type: geojsonTypes.LINE_STRING,
      coordinates: [[]]
    }
  });

  const verticalGuide = this.newFeature(getGuideFeature(IDS.VERTICAL_GUIDE));
  const horizontalGuide = this.newFeature(
    getGuideFeature(IDS.HORIZONTAL_GUIDE)
  );

  this.addFeature(line);
  this.addFeature(verticalGuide);
  this.addFeature(horizontalGuide);

  const selectedFeatures = draw.getSelected();
  this.clearSelectedFeatures();
  doubleClickZoom.disable(this);

  const [snapList, vertices] = createSnapList(this.map, draw, line);

  // A dog's breakfast
  const state = {
    map: this.map,
    draw,
    line,
    currentVertexPosition: 0,
    vertices,
    snapList,
    selectedFeatures,
    snapPx,
    verticalGuide,
    horizontalGuide,
    direction: "forward" // expected by DrawLineString
  };

  const moveendCallback = () => {
    const [snapList, vertices] = createSnapList(this.map, draw, line);
    state.vertices = vertices;
    state.snapList = snapList;
  };

  // for removing listener later on close
  state["moveendCallback"] = moveendCallback;

  this.map.on("moveend", moveendCallback);
  // TODO: this (custom) event should fire when new draw features added to map
  // handling asyncly added features
  this.map.on("featureChanged", moveendCallback);

  return state;
};

SnapLineMode.onClick = function(state) {
  // We save some processing by rounding on click, not mousemove
  const lng = roundLngLatTo1Cm(state.snappedLng);
  const lat = roundLngLatTo1Cm(state.snappedLat);

  // End the drawing if this click is on the previous position
  // Note: not bothering with 'direction'
  if (state.currentVertexPosition > 0) {
    const lastVertex = state.line.coordinates[state.currentVertexPosition - 1];

    state.lastVertex = lastVertex;

    if (lastVertex[0] === lng && lastVertex[1] === lat) {
      return this.changeMode(modes.SIMPLE_SELECT, {
        featureIds: [state.line.id]
      });
    }
  }

  // const point = state.map.project({ lng: lng, lat: lat });

  addPointTovertices(state.map, state.vertices, { lng, lat });

  state.line.updateCoordinate(state.currentVertexPosition, lng, lat);

  state.currentVertexPosition++;

  state.line.updateCoordinate(state.currentVertexPosition, lng, lat);
};

SnapLineMode.onMouseMove = function(state, e) {
  const { lng, lat } = snap(state, e);

  state.line.updateCoordinate(state.currentVertexPosition, lng, lat);
  state.snappedLng = lng;
  state.snappedLat = lat;

  if (
    state.lastVertex &&
    state.lastVertex[0] === lng &&
    state.lastVertex[1] === lat
  ) {
    this.updateUIClasses({ mouse: cursors.POINTER });

    // cursor options:
    // ADD: "add"
    // DRAG: "drag"
    // MOVE: "move"
    // NONE: "none"
    // POINTER: "pointer"
  } else {
    this.updateUIClasses({ mouse: cursors.ADD });
  }
};

// This is 'extending' DrawLine.toDisplayFeatures
SnapLineMode.toDisplayFeatures = function(state, geojson, display) {
  if (shouldHideGuide(state, geojson)) return;

  // This relies on the the state of SnapLineMode being similar to DrawLine
  DrawLine.toDisplayFeatures(state, geojson, display);
};

// This is 'extending' DrawLine.onStop
SnapLineMode.onStop = function(state) {
  this.deleteFeature(IDS.VERTICAL_GUIDE, { silent: true });
  this.deleteFeature(IDS.HORIZONTAL_GUIDE, { silent: true });

  // remove moveemd callback
  this.map.off("moveend", state.moveendCallback);

  // This relies on the the state of SnapLineMode being similar to DrawLine
  DrawLine.onStop.call(this, state);
};

export default SnapLineMode;
