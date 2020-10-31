import {
  geojsonTypes,
  modes,
  cursors
} from "@mapbox/mapbox-gl-draw/src/constants";
import doubleClickZoom from "@mapbox/mapbox-gl-draw/src/lib/double_click_zoom";
import DrawPolygon from "@mapbox/mapbox-gl-draw/src/modes/draw_polygon";
import SimpleSelect from "@mapbox/mapbox-gl-draw/src/modes/simple_select";

import {
  addPointTovertices,
  getCurrentViewportBBox,
  createSnapList,
  findSnapFeatures,
  getGuideFeature,
  IDS,
  roundLngLatTo1Cm,
  shouldHideGuide,
  snap
} from "../snapModes/snapUtils";
import {
  coordAll,
  getCoords,
  bboxPolygon,
  flatten,
  booleanPointInPolygon
} from "@turf/turf";

const pinMode = { ...SimpleSelect };
// const pinMode = {};

pinMode.onSetup = function({ draw, snapPx = 10, isSnappy = false }) {
  const selectedFeatures = draw.getSelected();
  this.clearSelectedFeatures();
  doubleClickZoom.disable(this);

  // A dog's breakfast
  const state = {
    map: this.map,
    draw,
    selectedFeatures,
    selectedPointID: null
  };

  const getFeaturesVertices = () => {
    const BBoxPolygon = bboxPolygon(getCurrentViewportBBox(this.map).flat());
    const features = draw.getAll();
    features.features = features.features.filter(feature => {
      return coordAll(feature).some(coord =>
        booleanPointInPolygon(coord, BBoxPolygon)
      );
    });
    const vertices = coordAll(features);

    const _this = this;

    const points = vertices.map(
      ((vertex, idx) => {
        // this = _this;
        return this.newFeature({
          type: geojsonTypes.FEATURE,
          properties: { idx },
          id: idx.toString(),
          geometry: {
            type: geojsonTypes.POINT,
            coordinates: vertex
          }
        });
      }).bind(_this)
    );

    points.forEach(
      (point => {
        // this = _this;
        return this.addFeature(point);
      }).bind(_this)
    );

    state.features = features;
    state.vertices = vertices;
    state.points = points;
  };

  getFeaturesVertices();

  // for removing listener later on close
  state["moveendCallback"] = getFeaturesVertices;

  this.map.on("moveend", getFeaturesVertices);
  // TODO: this (custom) event should fire when new draw features added to map
  // handling asyncly added features
  this.map.on("featureChanged", getFeaturesVertices);

  return state;
};

// pinMode.onDrag = function(state, e) {
//   console.log(e);
// };

// pinMode.onClick = function(state, e) {
//   if (!e.featureTarget) {
//     state.selectedPointID = null;
//     return;
//   }

//   console.log(e.featureTarget);

//   state.selectedPointID = e.featureTarget.properties.id;
//   // this.setSelected(e.featureTarget.properties.id);
//   SimpleSelect.clickOnFeature.call(this, state, e);
// };

pinMode.onMouseDown = function(state, e) {
  if (e.featureTarget) {
    state.selectedPointID = e.featureTarget.properties.id;
  }
  SimpleSelect.onMouseUp.call(this, state, e);
};

pinMode.onMouseUp = function(state, e) {
  state.selectedPointID = null;
  SimpleSelect.onMouseUp.call(this, state, e);
};

pinMode.onMouseMove = function(state, e) {
  if (!state.selectedPointID) return;
  console.log(e);
  SimpleSelect.onMouseMove.call(this, state, e);

  const point = state.points[state.selectedPointID];
  console.log({ point });
  state.features.features.forEach(feature => {
    const assumedFeatureIdx = coordAll(feature).findIndex(c => {
      c[0] === point.coordinates[0] && c[1] === point.coordinates[1];
    });
    console.log({ feature, assumedFeatureIdx });
    if (assumedFeatureIdx) {
      feature.geometry.coordinates[assumedFeatureIdx] = [
        e.lngLat.lng,
        e.lngLat.lat
      ];
      state.draw.add(feature);
    }
  });
};

// This is 'extending' DrawPolygon.toDisplayFeatures
pinMode.toDisplayFeatures = function(state, geojson, display) {
  // console.log({ geojson });
  // This relies on the the state of SnapPolygonMode being similar to DrawPolygon
  SimpleSelect.toDisplayFeatures.call(this, state, geojson, display);
  // display(geojson);
};

// This is 'extending' DrawPolygon.onStop
pinMode.onStop = function(state) {
  // remove moveemd callback
  this.map.off("moveend", state.moveendCallback);

  this.changeMode("simple_select");

  // This relies on the the state of SnapPolygonMode being similar to DrawPolygon
  // DrawPolygon.onStop.call(this, state);
};

export default pinMode;
