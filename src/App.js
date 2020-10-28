import React, { useRef, useEffect } from "react";
import mapboxGl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import {
  union,
  lineIntersect,
  lineOffset,
  featureCollection,
  geometryCollection,
  difference,
  getCoords,
  booleanWithin,
  point,
  lineCoords,
  lineString,
  lineToPolygon,
  polygon,
  lineSplit,
  buffer,
  transformTranslate,
  transformScale,
  circle,
  length,
  combine,
  simplify,
  pointsWithinPolygon,
  dissolve,
  flatten,
  multiPolygon
} from "@turf/turf";

import SnapPolygonMode from "./snapModes/SnapPolygonMode";
import SnapPointMode from "./snapModes/SnapPointMode";
import SnapLineMode from "./snapModes/SnapLineMode";
import RotateMode from "mapbox-gl-draw-rotate-mode";
import FreehandMode from "mapbox-gl-draw-freehand-mode";
import DrawRectangleRestrict, {
  DrawStyles
} from "mapbox-gl-draw-rectangle-restrict-area";
// import { TxRectMode, TxCenter } from "mapbox-gl-draw-rotate-scale-rect-mode";
import DrawRectangle from "@geostarters/mapbox-gl-draw-rectangle-assisted-mode";
import customDrawStyles from "./customDrawStyles";
import "./style.css";

let map;
let draw;
let undoList = new Array();
let redoList = new Array();

export default function App() {
  if (mapboxGl.getRTLTextPluginStatus() === "unavailable")
    mapboxGl.setRTLTextPlugin(
      "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
      err => {
        err && console.error(err);
      },
      true
    );
  let mapRef = useRef(null);
  let mapContainer = "#map";

  useEffect(() => {
    map = new mapboxGl.Map({
      container: mapRef.current || "",
      style: `https://map.ir/vector/styles/main/mapir-xyz-light-style.json`,
      center: [51.3857, 35.6102],
      zoom: 10,
      pitch: 0,
      interactive: false,
      hash: true,
      attributionControl: true,
      // customAttribution: '© Map © Openstreetmap',
      transformRequest: url => {
        return {
          url: url,
          headers: {
            "x-api-key":
              "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImRiZWU0YWU4OTk4OTA3MmQ3OTFmMjQ4ZDE5N2VhZTgwZWU2NTUyYjhlYjczOWI2NDdlY2YyYzIzNWRiYThiMzIzOTM5MDkzZDM0NTY2MmU3In0.eyJhdWQiOiI5NDMyIiwianRpIjoiZGJlZTRhZTg5OTg5MDcyZDc5MWYyNDhkMTk3ZWFlODBlZTY1NTJiOGViNzM5YjY0N2VjZjJjMjM1ZGJhOGIzMjM5MzkwOTNkMzQ1NjYyZTciLCJpYXQiOjE1OTA4MjU0NzIsIm5iZiI6MTU5MDgyNTQ3MiwiZXhwIjoxNTkzNDE3NDcyLCJzdWIiOiIiLCJzY29wZXMiOlsiYmFzaWMiXX0.M_z4xJlJRuYrh8RFe9UrW89Y_XBzpPth4yk3hlT-goBm8o3x8DGCrSqgskFfmJTUD2wC2qSoVZzQKB67sm-swtD5fkxZO7C0lBCMAU92IYZwCdYehIOtZbP5L1Lfg3C6pxd0r7gQOdzcAZj9TStnKBQPK3jSvzkiHIQhb6I0sViOS_8JceSNs9ZlVelQ3gs77xM2ksWDM6vmqIndzsS-5hUd-9qdRDTLHnhdbS4_UBwNDza47Iqd5vZkBgmQ_oDZ7dVyBuMHiQFg28V6zhtsf3fijP0UhePCj4GM89g3tzYBOmuapVBobbX395FWpnNC3bYg7zDaVHcllSUYDjGc1A", //dev api key
            "Mapir-SDK": "reactjs"
          }
        };
      }
    });
    draw = new MapboxDraw({
      modes: {
        ...MapboxDraw.modes,
        draw_polygon: FreehandMode, //Add Freehand functionality to draw polygon mode
        snap_point: SnapPointMode,
        snap_polygon: SnapPolygonMode,
        snap_line: SnapLineMode,
        RotateMode: RotateMode,
        DrawRectangle: DrawRectangle,
        DrawRectangleRestrict: DrawRectangleRestrict //draw rectangle with restrict area
      },
      styles: DrawStyles,
      userProperties: true
    });
    map.once("load", () => {
      map.resize();
      map.addControl(draw, "top-right");
      // map.addSource("cut", {
      //   type: "geojson",
      //   data: {
      //     type: "Feature",
      //     properties: {},
      //     geometry: {
      //       type: "Polygon",
      //       coordinates: [
      //         [
      //           [51.41742415918904, 35.73019558439101],
      //           [51.31319413385742, 35.702773908694724],
      //           [51.378997493472525, 35.665562843119986],
      //           [51.45008537540798, 35.67776544979942],
      //           [51.46619566741822, 35.70822028156377],
      //           [51.41742415918904, 35.73019558439101]
      //         ],
      //         [
      //           [51.3912510159731, 35.71074723666955],
      //           [51.37309541966354, 35.707043205182174],
      //           [51.42013718612387, 35.69351115851519],
      //           [51.42256052020156, 35.71823451788042],
      //           [51.3912510159731, 35.71074723666955]
      //         ]
      //       ]
      //     }
      //   }
      // });
      // map.addLayer({
      //   id: "cutttt",
      //   source: "cut",
      //   type: "fill",
      //   paint: {
      //     "fill-outline-color": "#2E0767",
      //     "fill-color": "#E71566",
      //     "fill-opacity": 0.1
      //   }
      // });
      draw.set({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            id: "example-id",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [51.41742415918904, 35.73019558439101],
                  [51.31319413385742, 35.702773908694724],
                  [51.378997493472525, 35.665562843119986],
                  [51.45008537540798, 35.67776544979942],
                  [51.46619566741822, 35.70822028156377],
                  [51.41742415918904, 35.73019558439101]
                ]
              ]
            }
          },
          {
            id: "example2-id",
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [52.4267578125, 35.71083783530009],
                  [51.45008537540798, 35.67776544979942],
                  [51.378997493472525, 35.665562843119986],
                  [50.80078125, 35.31736632923788],
                  [51.73461914062499, 35.20298910562885],
                  [52.4267578125, 35.71083783530009]
                ]
              ]
            }
          }
        ]
      });
    });
  }, []);

  const cutPolygun = () => {
    // console.log(draw.getSelected());
    let main = draw.getSelected();
    let cut;
    draw.changeMode("draw_polygon");
    map.once("draw.create", e => {
      cut = e.features[0];
      main = main.features[0];
      let afterCut = difference(main, cut);
      draw.delete([cut.id, main.id]);
      draw.add(afterCut);
    });
  };

  const unionPolygons = () => {
    let unionPoly = union(...draw.getSelected().features);
    let ids = draw.getSelected().features.map(i => i.id);
    console.log({ unionPoly });
    draw.delete(ids);
    draw.add(unionPoly);
  };

  function polygonCut(poly, line, idPrefix) {
    const THICK_LINE_UNITS = "kilometers";
    const THICK_LINE_WIDTH = 0.001;
    var i, j, id, intersectPoints, lineCoords, forCut, forSelect;
    var thickLineString, thickLinePolygon, clipped, polyg, intersect;
    var polyCoords = [];
    var cutPolyGeoms = [];
    var cutFeatures = [];
    var offsetLine = [];
    var retVal = null;

    if (
      (poly.type != "Polygon" && poly.type != "MultiPolygon") ||
      line.type != "LineString"
    ) {
      return retVal;
    }

    if (typeof idPrefix === "undefined") {
      idPrefix = "";
    }

    intersectPoints = lineIntersect(poly, line);
    if (intersectPoints.features.length == 0) {
      return retVal;
    }

    var lineCoords = getCoords(line);
    if (
      booleanWithin(point(lineCoords[0]), poly) ||
      booleanWithin(point(lineCoords[lineCoords.length - 1]), poly)
    ) {
      return retVal;
    }

    offsetLine[0] = lineOffset(line, THICK_LINE_WIDTH, {
      units: THICK_LINE_UNITS
    });
    offsetLine[1] = lineOffset(line, -THICK_LINE_WIDTH, {
      units: THICK_LINE_UNITS
    });

    for (i = 0; i <= 1; i++) {
      forCut = i;
      forSelect = (i + 1) % 2;
      polyCoords = [];
      for (j = 0; j < line.coordinates.length; j++) {
        polyCoords.push(line.coordinates[j]);
      }
      for (
        j = offsetLine[forCut].geometry.coordinates.length - 1;
        j >= 0;
        j--
      ) {
        polyCoords.push(offsetLine[forCut].geometry.coordinates[j]);
      }
      polyCoords.push(line.coordinates[0]);

      thickLineString = lineString(polyCoords);
      thickLinePolygon = lineToPolygon(thickLineString);
      clipped = difference(poly, thickLinePolygon);

      cutPolyGeoms = [];
      for (j = 0; j < clipped.geometry.coordinates.length; j++) {
        polyg = polygon(clipped.geometry.coordinates[j]);
        intersect = lineIntersect(polyg, offsetLine[forSelect]);
        if (intersect.features.length > 0) {
          cutPolyGeoms.push(polyg.geometry.coordinates);
        }
      }

      cutPolyGeoms.forEach(function(geometry, index) {
        id = idPrefix + (i + 1) + "." + (index + 1);
        cutFeatures.push(
          polygon(geometry, {
            id: id
          })
        );
      });
    }

    if (cutFeatures.length > 0) retVal = featureCollection(cutFeatures);

    return retVal;
  }

  const splitPolygons = () => {
    let main = draw.getSelected();
    let line;
    draw.changeMode("draw_line_string");
    map.once("draw.create", e => {
      line = e.features[0];
      main = main.features[0];
      let polycut = polygonCut(main.geometry, line.geometry, "piece-");
      // let intersectPoints = lineIntersect(line, main);
      // console.log({ intersectPoints });
      // let offsetLine = lineOffset(line, 0.01, {
      //   units: "meters"
      // });
      // console.log({ offsetLine });
      // let thickLineCorners = featureCollection([line, offsetLine]);
      // console.log({ thickLineCorners });
      // let thickLinePolygon = convex(explode(thickLineCorners));
      // console.log({ thickLinePolygon });
      // let clipped = difference(main, thickLinePolygon);
      // console.log({ clipped });
      draw.delete([line.id, main.id]);
      draw.add(polycut);
    });
  };

  const splitLines = () => {
    let main = draw.getSelected();
    let splitter;
    // draw.changeMode("draw_point"); //split with point
    // draw.changeMode("draw_line_string"); //split with line
    draw.changeMode("draw_polygon"); //split with polygon
    map.once("draw.create", e => {
      splitter = e.features[0];
      main = main.features[0];
      var split = lineSplit(main, splitter);
      draw.delete([splitter.id, main.id]);
      draw.add(split);
    });
  };

  const bufferFeature = () => {
    let main = draw.getSelected().features[0];
    let parallel = buffer(main, 500, { units: "meters" });
    draw.add(parallel);
  };

  const copyFeature = () => {
    let main = draw.getSelected().features[0];
    console.log(main);
    var translatedPoly = transformTranslate(main, 2, 35);
    console.log({ translatedPoly });
    // draw.add(translatedPoly);
    //If id had not changed, the main feature will transformTranslate!
    draw.add({
      id: `copy_of_${translatedPoly.id}`,
      type: translatedPoly.type,
      geometry: translatedPoly.geometry,
      properties: translatedPoly.properties
    });
  };

  const scaleFeature = () => {
    let main = draw.getSelected().features[0];
    let scaledPoly = transformScale(main, 0.3);
    // draw.add(scaledPoly);
    //If id had not changed, the main feature will transformScale!
    draw.add({
      id: `copy_of_${scaledPoly.id}`,
      type: scaledPoly.type,
      geometry: scaledPoly.geometry,
      properties: scaledPoly.properties
    });
  };

  const drawCircle = () => {
    draw.changeMode("draw_line_string");
    map.once("draw.create", e => {
      var radius = length(e.features[0], { units: "kilometers" });
      let options = {
        steps: 200,
        units: "kilometers",
        properties: { foo: "bar" }
      };
      let circleFeature = circle(
        e.features[0].geometry.coordinates[0],
        radius,
        options
      );
      // var collection = featureCollection([circleFeature, e.features[0]], {
      //   id: "new"
      // });
      // var combined = combine(collection);
      // console.log({ combined });
      // draw.delete(e.features[0].id);
      // var options2 = { tolerance: 1, highQuality: false };
      // var simplified = simplify(circleFeature, options2);
      draw.add(circleFeature);
    });
  };

  const pinning = () => {
    let main = draw.getSelected().features;
    let inter = intersect(main[0], main[1]);
    console.log({ inter });
    unionPolygons();
    // let vertices = draw.getSelectedPoints();
    // console.log({ vertices });
    // let searchWithin = draw
    //   .getAll()
    //   .features.filter(
    //     i =>
    //       (i.geometry.type === "Polygon") | (i.geometry.type === "MultiPolygon")
    //   );
    // console.log({ searchWithin });
    // let collection = featureCollection([...searchWithin], {
    //   id: "new"
    // });
    // console.log({ collection });
    // let ptsWithin = pointsWithinPolygon(vertices, collection);
    // console.log({ ptsWithin });
    // if (ptsWithin.features.length > 0) {
    //   // draw.changeMode("simple_select", {
    //   //   featureIds: [ptsWithin.features[0].id, ptsWithin.features[1].id] //there is no id vertices ---> How is if there is no need to id??
    //   // });
    //   //   let dissolved = dissolve(collection);
    //   //   console.log({ dissolved });
    //   //   draw.add(dissolved);
    //   // let combined = combine(collection);
    //   let combined = multiPolygon([
    //     searchWithin[0].geometry.coordinates,
    //     searchWithin[1].geometry.coordinates
    //   ]);
    //   draw.delete([searchWithin[0].id, searchWithin[1].id]);
    //   console.log({ combined });
    //   draw.add(combined);
    //   map.on("draw.update", e => {
    //     let flattenFeature = flatten(e.features[0]);
    //     console.log(flattenFeature);
    //     draw.delete([combined.id]);
    //     draw.add(flattenFeature);
    //   });
    // }
  };

  const undo = () => {
    let redoTemp = new Array();
    if (!undoList[undoList.length - 1]) {
      console.log("There is no action to UNDO!");
      return;
    }
    let lastOne = undoList.pop();
    lastOne.forEach((el, i) => {
      redoTemp.push(draw.get([el.id]));
      draw.add(el);
    });
    console.log({ redoTemp });
    redoList.push(redoTemp);
  };

  const redo = () => {
    let undoTemp = new Array();
    if (!redoList[redoList.length - 1]) {
      console.log("There is no action to REDO!");
      return;
    }
    let latest = redoList.pop();
    console.log({ latest });
    latest.forEach((el, i) => {
      undoTemp.push(draw.get([el.id]));
      draw.add(el);
    });
    undoList.push(undoTemp);
  };

  useEffect(() => {
    map.on("draw.modechange", () => {
      let before = draw.getSelected().features;
      map.on("draw.update", e => {
        if (e.features !== before) {
          if (before !== undoList[undoList.length - 1]) undoList.push(before);
        }
        console.log({ undoList });
      });
    });
  }, [draw]);

  return (
    <div className="map-wrapper">
      <button
        onClick={() => {
          draw?.changeMode("snap_polygon", { draw: draw });
        }}
      >
        snap_polygon
      </button>
      <button
        onClick={() => {
          draw?.changeMode("snap_point", { draw: draw });
        }}
      >
        snap_point
      </button>
      <button
        onClick={() => {
          draw?.changeMode("snap_line", { draw: draw });
        }}
      >
        snap_line
      </button>
      <button
        onClick={() => {
          cutPolygun();
        }}
      >
        cut
      </button>
      <button
        onClick={() => {
          unionPolygons();
        }}
      >
        union
      </button>
      <button
        onClick={() => {
          splitPolygons();
        }}
      >
        split
      </button>
      <button
        onClick={() => {
          splitLines();
        }}
      >
        split_line
      </button>
      <button
        onClick={() => {
          bufferFeature();
        }}
      >
        buffer
      </button>
      <button
        onClick={() => {
          copyFeature();
        }}
      >
        copy
      </button>
      <button
        onClick={() => {
          scaleFeature();
        }}
      >
        scale
      </button>
      <button
        onClick={() => {
          draw?.changeMode("RotateMode");
        }}
      >
        rotate(mode)
      </button>
      <button
        onClick={() => {
          draw?.changeMode("DrawRectangle");
        }}
      >
        DrawRectangle(mode)
      </button>
      <button
        onClick={() => {
          draw?.changeMode("DrawRectangleRestrict", {
            areaLimit: 5 * 1_000_000, // 5 km2, optional
            escapeKeyStopsDrawing: true, // default true
            allowCreateExceeded: false, // default false
            exceedCallsOnEachMove: false, // default false
            exceedCallback: area => console.log("exceeded!", area), // optional
            areaChangedCallback: area => console.log("updated", area) // optional
          });
        }}
      >
        DrawRectangleRestrict(mode)
      </button>
      <button
        onClick={() => {
          drawCircle();
        }}
      >
        circle
      </button>
      <button
        onClick={() => {
          pinning();
        }}
      >
        pin
      </button>
      <button
        onClick={() => {
          undo();
        }}
      >
        undo
      </button>
      <button
        onClick={() => {
          redo();
        }}
      >
        redo
      </button>
      <div id="map" ref={mapRef} />
    </div>
  );
}
