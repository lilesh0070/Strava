// Interactive map rendered with Leaflet + OpenStreetMap tiles inside a WebView.
// No API key needed. Route updates are pushed in via injectJavaScript.
//
// Battery: during a recording only the *new* points and the current position cross the bridge
// (window.append), instead of re-sending and redrawing the whole route every second. A full
// redraw (window.reset) happens only when the data set itself changes or the page (re)loads.
import React, { useEffect, useMemo, useRef } from 'react';
import { Linking, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import type { Point } from '../lib/geo';
import { mapState, routeUpdate, type MapState } from '../lib/routeSync';
import { useTheme, type Palette } from '../lib/theme';

type WebViewHandle = { injectJavaScript(js: string): void };
// react-native-webview's class typings resolve props to `never` with the default generic; re-type it.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebViewHandle> }>;

type Props = {
  segments: Point[][];
  current?: Point | null;
  follow?: boolean; // live mode: keep the current position centred
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  /** Hidden (e.g. another tab is showing): hold updates and send them in one go when visible again. */
  paused?: boolean;
  /** Change this (e.g. a filter value) to re-frame the map around the new routes. */
  fitKey?: string;
};

const buildHtml = (C: Palette) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:${C.bg}}
.leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.6)!important}
.leaflet-tile-pane{filter:${C.scheme === 'dark' ? 'invert(.92) hue-rotate(180deg) saturate(.4) brightness(.9)' : 'saturate(.35) brightness(1.04)'}}</style>
</head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([20.59,78.96],4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
map.attributionControl.setPrefix(false);
var lines=L.layerGroup().addTo(map), marks=L.layerGroup().addTo(map), me=null, fitted=false, polys=[], fitKey=null;
var style={color:'${C.route}',weight:5,opacity:.95};
function dot(ll,c,r){return L.circleMarker(ll,{radius:r||6,color:'#fff',weight:2,fillColor:c,fillOpacity:1});}
function setCur(cur,follow){
  if(!cur) return;
  if(!me){me=dot(cur,'${C.accent}',8).addTo(map);} else me.setLatLng(cur);
  if(follow){ if(fitted) map.panTo(cur); else { map.setView(cur,16); fitted=true; } }
}
window.reset=function(d){
  if(d.fitKey!=null && d.fitKey!==fitKey){ fitKey=d.fitKey; fitted=false; }
  lines.clearLayers();marks.clearLayers();polys=[];
  var all=[];
  d.segs.forEach(function(s,i){ polys[i]=L.polyline(s,style).addTo(lines); all=all.concat(s); });
  setCur(d.cur,d.follow);
  if(!d.follow && all.length>1 && !fitted){ map.fitBounds(L.latLngBounds(all),{padding:[30,30]}); fitted=true; }
  else if(!d.follow && all.length===1 && !fitted){ map.setView(all[0],15); fitted=true; }
};
window.append=function(d){
  d.segs.forEach(function(x){
    var i=x[0]; if(!polys[i]) polys[i]=L.polyline([],style).addTo(lines);
    x[1].forEach(function(p){ polys[i].addLatLng(p); });
  });
  setCur(d.cur,d.follow);
};
window.update=window.reset;
</script></body></html>`;

export default function RouteMap({ segments, current, follow = false, style, interactive = true, paused = false, fitKey }: Props) {
  const { C } = useTheme();
  const ref = useRef<WebViewHandle>(null);
  const html = useMemo(() => buildHtml(C), [C]);
  const source = useMemo(() => ({ html, baseUrl: 'https://localhost/' }), [html]);
  const ready = useRef(false);
  // what the page already has: which segments array, how many points per segment, which position
  const sent = useRef<MapState>({ segs: null, lens: [], cur: '' });

  useEffect(() => { ready.current = false; }, [C.scheme]); // the WebView remounts with the new theme

  const sync = (full: boolean) => {
    if (!ready.current || !ref.current || (paused && !full)) return;
    const cur = current ? [current.lat, current.lng] : null;
    const curKey = cur ? cur.join() : '';
    const u = routeUpdate(sent.current, segments, curKey, full);
    if (u.kind === 'none') return; // nothing new: no bridge traffic, no redraw
    ref.current.injectJavaScript(`window.${u.kind}(${JSON.stringify({ segs: u.segs, cur, follow, fitKey: fitKey ?? null })});true;`);
    sent.current = mapState(segments, curKey);
  };
  // Runs after every render but only compares lengths; segments grow in place while recording.
  useEffect(() => { sync(false); });

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: C.bg }, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        key={C.scheme}
        ref={ref}
        originWhitelist={['*']}
        source={source}
        // links (e.g. the OSM attribution) open in the browser instead of replacing the map
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith('https://localhost') || req.url.startsWith('about:') || req.url.startsWith('data:')) return true;
          Linking.openURL(req.url).catch(() => undefined);
          return false;
        }}
        onLoadEnd={() => { ready.current = true; sync(true); }}
        style={{ backgroundColor: C.bg }}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}
