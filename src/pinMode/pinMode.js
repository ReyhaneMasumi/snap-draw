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
    const vertices = [];
    
    const features = draw.getAll();
    features.features = features.features.filter(feature => {
      return coordAll(feature).some((coord, idx) => booleanPointInPolygon(coord, BBoxPolygon));
    });


    const _this = this;
    features.features.forEach(feature => {
      console.log("getFeaturesVertices -> feature", feature);
      const featureVertices = coordAll(feature);
      featureVertices.forEach(((featureVertex, vIdx) => {
        const alreadyDrawnIdx = vertices.findIndex(v => {          
          const c = v.vertex.coordinates;
          return c[0] === featureVertex[0] && c[1] === featureVertex[1] 
        });
        console.log("getFeaturesVertices -> alreadyDrawnIdx", alreadyDrawnIdx)

        if (alreadyDrawnIdx !== -1) {
          vertices[alreadyDrawnIdx].vertex.properties.featureIDs.push([feature.id, vIdx]);
        }
        else {
          vertices.push({
            vertex: this.newFeature({
              type: geojsonTypes.FEATURE,
              properties: { 
                featureIDs: [
                  [feature.id, vIdx]
                ]
               },
              id: feature.id + vIdx,
              geometry: {
                type: geojsonTypes.POINT,
                coordinates: featureVertex
              }
            })
          });
        }
      }).bind(_this))
    });

    vertices.forEach(
      (vertex => {
        return this.addFeature(vertex.vertex);
      }).bind(this)
    );

    state.features = features;
    state.vertices = vertices;
    state.points = vertices;
  };

  getFeaturesVertices();

  // for removing listener later on close
  state["moveendCallback"] = getFeaturesVertices;

  // this.map.on("moveend", getFeaturesVertices);
  // TODO: this (custom) event should fire when new draw features added to map
  // handling asyncly added features
  // this.map.on("featureChanged", getFeaturesVertices);

  return state;
};

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

pinMode.onClick = function(state, e) {
  SimpleSelect.onClick.call(this, state, e);
  console.log(this.getSelected());
};

pinMode.onMouseDown = function(state, e) {
  if (e.featureTarget) {
    state.selectedPointID = e.featureTarget.properties.id;
  }
  SimpleSelect.onMouseDown.call(this, state, e);
};

pinMode.onMouseUp = function(state, e) {
  state.selectedPointID = null;
  SimpleSelect.onMouseUp.call(this, state, e);
};

pinMode.onDrag = function(state, e) {
  if (!state.selectedPointID) return;
  console.log(e);

  // const pointIdx = state.points[state.selectedPointID].properties.user_idx;
  // const point = [...this.getSelected()[0].coordinates];
  SimpleSelect.onDrag.call(this, state, e);
  const movingPoint = this.getSelected()[0];
  console.log("pinMode.onDrag -> movingPoint", movingPoint)
  movingPoint.properties.featureIDs.forEach(([id, idx]) => {
    const f = state.draw.get(id);
    console.log("pinMode.onDrag -> f", f)
    f.geometry.coordinates[0][idx] = [
      e.lngLat.lng,
      e.lngLat.lat
    ];
    state.draw.add(f)
  });

  return;


  console.log({ point, lngLat: e.lngLat });
  state.features.features.forEach(feature => {
    const assumedFeatureIdx = coordAll(feature).findIndex(c => {
      return c[0] === point[0] && c[1] === point[1];
    });

    console.log({ feature, assumedFeatureIdx, coords: coordAll(feature) });
    const theOne = feature.coordinates[0][pointIdx];
    // if (theOne[0] === && theOne[1] === )
    if (assumedFeatureIdx !== -1) {
      feature.geometry.coordinates[0][assumedFeatureIdx] = [
        e.lngLat.lng,
        e.lngLat.lat
      ];
      console.log({ feature });
      state.draw.add(feature);
    }
  });

  // state.points[state.selectedPointID].updateCoordinate(
  //   "",
  //   e.lngLat.lng,
  //   e.lngLat.lat
  // );
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

  // this.changeMode("simple_select");

  // This relies on the the state of SnapPolygonMode being similar to DrawPolygon
  // DrawPolygon.onStop.call(this, state);
};

export default pinMode;
