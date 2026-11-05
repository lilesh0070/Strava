// Interactive map rendered with Leaflet + OpenStreetMap tiles inside a WebView.
// No API key needed. Route updates are pushed in via injectJavaScript.
import React, { useEffect, useMemo, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import type { Point } from '../lib/geo';
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
var lines=L.layerGroup().addTo(map), marks=L.layerGroup().addTo(map), me=null, fitted=false;
function dot(ll,c,r){return L.circleMarker(ll,{radius:r||6,color:'#fff',weight:2,fillColor:c,fillOpacity:1});}
window.update=function(d){
  lines.clearLayers();marks.clearLayers();
  var all=[];
  d.segs.forEach(function(s){ if(s.length>1){ L.polyline(s,{color:'${C.route}',weight:5,opacity:.95}).addTo(lines);} all=all.concat(s); });
  if(!d.follow && all.length){ dot(all[0],'${C.success}').addTo(marks); dot(all[all.length-1],'${C.danger}').addTo(marks); }
  if(d.cur){ if(!me){me=dot(d.cur,'${C.accent}',8);} me.setLatLng(d.cur).addTo(marks); }
  if(d.follow && d.cur){ map.setView(d.cur, fitted?map.getZoom():16); fitted=true; }
  else if(!d.follow && all.length>1 && !fitted){ map.fitBounds(L.latLngBounds(all),{padding:[30,30]}); fitted=true; }
  else if(!d.follow && all.length===1 && !fitted){ map.setView(all[0],15); fitted=true; }
};
</script></body></html>`;

export default function RouteMap({ segments, current, follow = false, style, interactive = true }: Props) {
  const { C } = useTheme();
  const ref = useRef<WebViewHandle>(null);
  const html = useMemo(() => buildHtml(C), [C]);
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

  useEffect(() => {
    latest.current = payload;
    ref.current?.injectJavaScript(`window.update && window.update(${payload});true;`);
  }, [payload]);

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: C.bg }, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        key={C.scheme}
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
