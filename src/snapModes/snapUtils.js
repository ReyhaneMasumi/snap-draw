import { geojsonTypes } from "@mapbox/mapbox-gl-draw/src/constants";
import {
  bboxPolygon,
  booleanPointInPolygon,
  getCoords,
  distance,
  polygonToLine,
  nearestPointOnLine,
  midpoint
} from "@turf/turf";

export const IDS = {
  VERTICAL_GUIDE: "VERTICAL_GUIDE",
  HORIZONTAL_GUIDE: "HORIZONTAL_GUIDE"
};

// Note: this lng/lat rounding doesn't have anything to do with snapping,
// but can reduce output file size quite a lot
// There's not much point in 13 decimal places of lng/lat.

// Number of decimal places in lat/lng values
// One day could be configurable
export const ACCURACY = {
  "1 m": 5,
  "10 cm": 6,
  "1 cm": 7,
  "1 mm": 8
};

const round = (num, decimals) =>
  Math.round(num * 10 ** decimals) / 10 ** decimals;

export const roundLngLatTo1Cm = num => num; //round(num, ACCURACY["1 cm"]);

/**
 * Takes a point and maybe adds it to the list of vertices.
 *
 * Mutates vertices.
 *
 * @param {object} vertices
 * @param {Array<number>} vertices.vertical
 * @param {Array<number>} vertices.horizontal
 * @param {object} point
 * @param {number} point.x
 * @param {number} point.y
 * @param {boolean} [forceInclusion]
 */
export const addPointTovertices = (
  map,
  vertices,
  coordinates,
  forceInclusion
) => {
  // Round to the nearest pixel, reduces the number of vertices and also is just sensible
  // const x = Math.round(point.x);
  // const y = Math.round(point.y);
  // const x = point.x;
  // const y = point.y;
  // const {lng, lat} = coordinates;
  const { width: w, height: h } = map.getCanvas();
  // Don't add points not visible on the page (it's annoying)
  const { x, y } = map.project(coordinates);
  const pointIsOnTheScreen = x > 0 && x < w && y > 0 && y < h;

  // But do add off-screen points if forced (e.g. for the current feature)
  // So features will always snap to their own points
  if (pointIsOnTheScreen || forceInclusion) {
    // Don't add duplicates
    vertices.push(coordinates);
    // if (!vertices.vertical.includes(lng)) vertices.vertical.push(lng);
    // if (!vertices.horizontal.includes(lat)) vertices.horizontal.push(lat);
  }
};

/**
 * Loops over all features to get vertical and horizontal vertices to snap to
 *
 * @param map
 * @param draw
 * @param currentFeature
 * @returns {{vertical: Array, horizontal: Array}}
 */
export const createSnapList = (map, draw, currentFeature) => {
  const features = draw.getAll().features;
  const snapList = [];

  const bboxAsPolygon = (() => {
    const canvas = map.getCanvas(),
      w = canvas.width,
      h = canvas.height,
      cUL = map.unproject([0, 0]).toArray(),
      cUR = map.unproject([w, 0]).toArray(),
      cLR = map.unproject([w, h]).toArray(),
      cLL = map.unproject([0, h]).toArray();

    return bboxPolygon([cLL, cUR].flat());
  })();

  const vertices = [];

  const addVerticesTovertices = (coordinates, isCurrentFeature = false) => {
    if (!Array.isArray(coordinates)) throw Error("Your array is not an array");

    if (Array.isArray(coordinates[0])) {
      // coordinates is an array of arrays, we must go deeper
      coordinates.forEach(addVerticesTovertices);
    } else {
      // If not an array of arrays, only consider arrays with two items
      if (coordinates.length === 2) {
        addPointTovertices(map, vertices, coordinates, isCurrentFeature);
      }
    }
  };

  features.forEach(feature => {
    // currentfeature
    if (feature.id === currentFeature.id) {
      if (currentFeature.type === geojsonTypes.POLYGON) {
        // For the current polygon, the last two points are the mouse position and back home
        // so we chop those off (else we get vertices showing where the user clicked, even
        // if they were just panning the map)
        addVerticesTovertices(
          feature.geometry.coordinates[0].slice(0, -2),
          true
        );
      }
      return;
    }

    // If this is re-running because a user is moving the map, the features might include
    // vertices or the last leg of a polygon
    if (
      feature.id === IDS.HORIZONTAL_GUIDE ||
      feature.id === IDS.VERTICAL_GUIDE
    )
      return;

    addVerticesTovertices(feature.geometry.coordinates);
    snapList.push(feature);
  });

  return [snapList, vertices];
};

/**
 * For a given point, this returns any vertical and/or horizontal vertices within snapping distance
 *
 * @param vertices
 * @param point
 * @param snapPx
 * @returns {{vertical: number | undefined, horizontal: number | undefined}}
 */
const getNearbyvertices = (map, vertices, point, coords, snapPx) => {
  const verticals = [];
  const horizontals = [];

  vertices.forEach(vertex => {
    verticals.push(vertex[0]);
    horizontals.push(vertex[1]);
  });

  const nearbyVerticalGuide = verticals.find(
    px => Math.abs(px - coords.lng) < 0.009
  );

  const nearbyHorizontalGuide = verticals.find(
    py => Math.abs(py - coords.lat) < 0.009
  );

  // const verticesPoints = vertices.map((v) => map.project(v));
  // const nearbyVerticalGuide = verticesPoints
  //   .map((p) => p.x)
  //   .find((px) => Math.abs(px - point.x) < snapPx);

  // const nearbyHorizontalGuide = verticesPoints
  //   .map((p) => p.y)
  //   .find((py) => Math.abs(py - point.y) < snapPx);

  return {
    verticalPx: nearbyVerticalGuide,
    horizontalPx: nearbyHorizontalGuide
  };
};

const calcLayerDistances = (map, lngLat, layer) => {
  // the point P which we want to snap (probpably the marker that is dragged)
  const P = [lngLat.lng, lngLat.lat];

  // is this a marker?
  const isMarker = layer.geometry.type === "Point";
  // is it a polygon?
  const isPolygon = layer.geometry.type === "Polygon";

  let lines = undefined;

  // the coords of the layer
  const latlngs = getCoords(layer);

  if (isMarker) {
    const [lng, lat] = latlngs;
    // return the info for the marker, no more calculations needed
    return {
      latlng: { lng, lat },
      distance: distance(latlngs, P)
    };
  }

  if (isPolygon) lines = polygonToLine(layer);
  else lines = layer;

  const nearestPoint = nearestPointOnLine(lines, P);
  const [lng, lat] = nearestPoint.geometry.coordinates;

  return {
    latlng: { lng, lat },
    segment: lines.geometry.coordinates.slice(
      nearestPoint.properties.index,
      nearestPoint.properties.index + 2
    ),
    distance: nearestPoint.properties.dist,
    isMarker
  };
};

const calcClosestLayer = (map, lngLat, layers) => {
  let closestLayer = {};

  // loop through the layers
  layers.forEach((layer, index) => {
    // find the closest latlng, segment and the distance of this layer to the dragged marker latlng
    const results = calcLayerDistances(map, lngLat, layer);

    // save the info if it doesn't exist or if the distance is smaller than the previous one
    if (
      closestLayer.distance === undefined ||
      results.distance < closestLayer.distance
    ) {
      closestLayer = results;
      closestLayer.layer = layer;
    }
  });

  // return the closest layer and it's data
  // if there is no closest layer, return undefined
  return closestLayer;
};

// minimal distance before marker snaps (in pixels)
const metersPerPixel = function(latitude, zoomLevel) {
  const earthCircumference = 40075017;
  const latitudeRadians = latitude * (Math.PI / 180);
  return (
    (earthCircumference * Math.cos(latitudeRadians)) /
    Math.pow(2, zoomLevel + 8)
  );
};

// we got the point we want to snap to (C), but we need to check if a coord of the polygon
// receives priority over C as the snapping point. Let's check this here
const checkPrioritiySnapping = (map, closestLayer) => {
  // A and B are the points of the closest segment to P (the marker position we want to snap)
  const A = closestLayer.segment[0];
  const B = closestLayer.segment[1];

  // C is the point we would snap to on the segment.
  // The closest point on the closest segment of the closest polygon to P. That's right.
  const C = [closestLayer.latlng.lng, closestLayer.latlng.lat];

  // distances from A to C and B to C to check which one is closer to C
  const distanceAC = distance(A, C);
  const distanceBC = distance(B, C);

  // closest latlng of A and B to C
  let closestVertexLatLng = distanceAC < distanceBC ? A : B;

  // distance between closestVertexLatLng and C
  let shortestDistance = distanceAC < distanceBC ? distanceAC : distanceBC;

  // snap to middle (M) of segment if option is enabled
  if (true) {
    const M = midpoint(A, B).geometry.coordinates;
    const distanceMC = distance(M, C);

    if (distanceMC < distanceAC && distanceMC < distanceBC) {
      // M is the nearest vertex
      closestVertexLatLng = M;
      shortestDistance = distanceMC;
    }
  }

  // the distance that needs to be undercut to trigger priority
  const priorityDistance = 1.25;

  // the latlng we ultemately want to snap to
  let snapLatlng;

  // if C is closer to the closestVertexLatLng (A, B or M) than the snapDistance,
  // the closestVertexLatLng has priority over C as the snapping point.
  if (shortestDistance < priorityDistance) {
    snapLatlng = closestVertexLatLng;
  } else {
    snapLatlng = C;
  }

  // return the copy of snapping point
  const [lng, lat] = snapLatlng;
  return { lng, lat };
};

/**
 * Returns snap points if there are any, otherwise the original lng/lat of the event
 * Also, defines if vertices should show on the state object
 *
 * Mutates the state object
 *
 * @param state
 * @param e
 * @returns {{lng: number, lat: number}}
 */
export const snap = (state, e) => {
  // TODO (davidg): 'snapAndDrawvertices'
  let lng = e.lngLat.lng;
  let lat = e.lngLat.lat;

  // Holding alt bypasses all snapping
  if (e.originalEvent.altKey) {
    state.showVerticalSnapLine = false;
    state.showHorizontalSnapLine = false;

    return { lng, lat };
  }

  if (state.snapList.length <= 0) {
    return false;
  }

  const closestLayer = calcClosestLayer(
    state.map,
    { lng, lat },
    state.snapList
  );

  // if no layers found. Can happen when circle is the only visible layer on the map and the hidden snapping-border circle layer is also on the map
  if (Object.keys(closestLayer).length === 0) {
    return false;
  }

  const isMarker = closestLayer.isMarker;

  let snapLatLng;
  if (!isMarker) {
    snapLatLng = checkPrioritiySnapping(state.map, closestLayer);
    // snapLatLng = closestLayer.latlng;
  } else {
    snapLatLng = closestLayer.latlng;
  }

  const minDistance = 15 * metersPerPixel(snapLatLng.lat, state.map.getZoom());

  const showGrid = false;
  let verticalPx, horizontalPx;

  if (showGrid) {
    const nearestGuidline = getNearbyvertices(
      state.map,
      state.vertices,
      e.point,
      e.lngLat,
      state.snapPx
    );

    verticalPx = nearestGuidline.verticalPx;
    horizontalPx = nearestGuidline.horizontalPx;

    if (verticalPx) {
      // Draw a line from top to bottom
      // const lngLat = state.map.unproject({ x: verticalPx, y: e.point.y });

      const lngLatTop = { lng: verticalPx, lat: e.lngLat.lat + 10 };
      const lngLatBottom = { lng: verticalPx, lat: e.lngLat.lat - 10 };

      // const lngLatTop = state.map.unproject({ x: verticalPx, y: 0 });
      // const lngLatBottom = state.map.unproject({
      //   x: verticalPx,
      //   y: window.innerHeight
      // });
      // const lngLatPoint = state.map.unproject({ x: verticalPx, y: e.point.y });

      state.verticalGuide.updateCoordinate(0, lngLatTop.lng, lngLatTop.lat);
      state.verticalGuide.updateCoordinate(
        1,
        lngLatBottom.lng,
        lngLatBottom.lat
      );

      // lng = lngLat.lng;
      // lat = e.lngLat.lat;
      // lng = lngLatPoint.lng;
      // lat = lngLatPoint.lat;
    }

    // if (horizontalPx) {
    //   // Draw a line from left to right
    //   const lngLatLeft = state.map.unproject({ x: 0, y: horizontalPx });
    //   const lngLatRight = state.map.unproject({
    //     x: window.innerWidth,
    //     y: horizontalPx,
    //   });
    //   const lngLatPoint = state.map.unproject({
    //     x: e.point.x,
    //     y: horizontalPx,
    //   });

    //   state.horizontalGuide.updateCoordinate(0, lngLatLeft.lng, lngLatLeft.lat);
    //   state.horizontalGuide.updateCoordinate(
    //     1,
    //     lngLatRight.lng,
    //     lngLatRight.lat
    //   );

    //   lng = lngLatPoint.lng;
    //   lat = lngLatPoint.lat;
    // }

    // if (verticalPx && horizontalPx) {
    //   // For rather complicated reasons, we need to explicitly set both so it behaves on a rotated map
    //   const lngLatPoint = state.map.unproject({
    //     x: verticalPx,
    //     y: horizontalPx,
    //   });

    //   lng = lngLatPoint.lng;
    //   lat = lngLatPoint.lat;
    // }

    state.showVerticalSnapLine = !!verticalPx;
    state.showHorizontalSnapLine = !!horizontalPx;
  }

  if (closestLayer.distance * 1000 < minDistance) {
    // snap the marker
    // marker.setLatLng(snapLatLng);

    return snapLatLng;

    // marker._snapped = true;

    // const triggerSnap = () => {
    //   this._snapLatLng = snapLatLng;
    //   marker.fire('pm:snap', eventInfo);
    //   this._layer.fire('pm:snap', eventInfo);
    // };

    // // check if the snapping position differs from the last snap
    // // Thanks Max & car2go Team
    // const a = this._snapLatLng || {};
    // const b = snapLatLng || {};

    // if (a.lat !== b.lat || a.lng !== b.lng) {
    //   triggerSnap();
    // }
  } else if (verticalPx || horizontalPx) {
    if (verticalPx) {
      lng = verticalPx;
    }
    if (horizontalPx) {
      lat = horizontalPx;
    }
    // no more snapping
    // if it was previously snapped...
    // ...unsnap
    // this._unsnap(eventInfo);

    // marker._snapped = false;

    // // and fire unsnap event
    // eventInfo.marker.fire('pm:unsnap', eventInfo);
    // this._layer.fire('pm:unsnap', eventInfo);
  } else {
    return { lng, lat };
  }

  return { lng, lat };
};

export const getGuideFeature = id => ({
  id,
  type: geojsonTypes.FEATURE,
  properties: {
    isSnapGuide: "true" // for styling
  },
  geometry: {
    type: geojsonTypes.LINE_STRING,
    coordinates: []
  }
});

export const shouldHideGuide = (state, geojson) => {
  if (
    geojson.properties.id === IDS.VERTICAL_GUIDE &&
    !state.showVerticalSnapLine
  ) {
    return true;
  }

  if (
    geojson.properties.id === IDS.HORIZONTAL_GUIDE &&
    !state.showHorizontalSnapLine
  ) {
    return true;
  }

  return false;
};
