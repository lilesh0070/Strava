// Interactive map rendered with Leaflet + OpenStreetMap tiles inside a WebView.
// No API key needed. Route updates are pushed in via injectJavaScript.
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import type { Point } from '../lib/geo';
import { C } from '../lib/theme';

type Props = {
  segments: Point[][];
  current?: Point | null;
  follow?: boolean; // live mode: keep the current position centred
  style?: ViewStyle;
  interactive?: boolean;
};

type WebViewHandle = { injectJavaScript(js: string): void };
// react-native-webview's class typings resolve props to `never` with the default generic; re-type it.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebViewHandle> }>;

const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:${C.bg}}
.leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.6)!important}
.leaflet-tile-pane{filter:brightness(.72) contrast(1.1) saturate(.6)}</style>
</head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([20.59,78.96],4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var lines=L.layerGroup().addTo(map), marks=L.layerGroup().addTo(map), me=null, fitted=false;
function dot(ll,c,r){return L.circleMarker(ll,{radius:r||6,color:'#fff',weight:2,fillColor:c,fillOpacity:1});}
window.update=function(d){
  lines.clearLayers();marks.clearLayers();
  var all=[];
  d.segs.forEach(function(s){ if(s.length>1){ L.polyline(s,{color:'${C.route}',weight:5,opacity:.95}).addTo(lines);} all=all.concat(s); });
  if(!d.follow && all.length){ dot(all[0],'#22c55e').addTo(marks); dot(all[all.length-1],'#ef4444').addTo(marks); }
  if(d.cur){ if(!me){me=dot(d.cur,'${C.accent}',8);} me.setLatLng(d.cur).addTo(marks); }
  if(d.follow && d.cur){ map.setView(d.cur, fitted?map.getZoom():16); fitted=true; }
  else if(!d.follow && all.length>1 && !fitted){ map.fitBounds(L.latLngBounds(all),{padding:[30,30]}); fitted=true; }
  else if(!d.follow && all.length===1 && !fitted){ map.setView(all[0],15); fitted=true; }
};
</script></body></html>`;

export default function RouteMap({ segments, current, follow = false, style, interactive = true }: Props) {
  const ref = useRef<WebViewHandle>(null);
  const payload = useMemo(
    () =>
      JSON.stringify({
        segs: segments.map((s) => s.map((p) => [+p.lat.toFixed(6), +p.lng.toFixed(6)])),
        cur: current ? [current.lat, current.lng] : null,
        follow,
      }),
    [segments, current, follow],
  );
  const latest = useRef(payload);
  latest.current = payload;

  useEffect(() => {
    ref.current?.injectJavaScript(`window.update && window.update(${payload});true;`);
  }, [payload]);

  return (
    <View style={[styles.wrap, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost/' }}
        onLoadEnd={() => ref.current?.injectJavaScript(`window.update(${latest.current});true;`)}
        style={{ backgroundColor: C.bg }}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { overflow: 'hidden', backgroundColor: C.bg } });
