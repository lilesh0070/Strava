// Interactive map rendered with Leaflet + OpenStreetMap tiles inside a WebView.
// No API key needed. Route updates are pushed in via injectJavaScript.
//
// Battery: during a recording only the *new* points and the current position cross the bridge
// (window.append), instead of re-sending and redrawing the whole route every second. A full
// redraw (window.reset) happens only when the data set itself changes or the page (re)loads.
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import type { Point } from '../lib/geo';
import { LEAFLET_CSS, LEAFLET_JS } from '../lib/leafletSrc';
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
  /** Street tiles could not be loaded (no internet) / are loading again. The route still draws. */
  onTiles?: (state: 'offline' | 'online') => void;
};

/** Links (e.g. the OSM attribution) open in the browser instead of replacing the map. */
const onNavigate = (req: { url: string }) => {
  if (req.url.startsWith('https://localhost') || req.url.startsWith('about:') || req.url.startsWith('data:')) return true;
  Linking.openURL(req.url).catch(() => undefined);
  return false;
};

// Leaflet is inlined (src/lib/leafletSrc.ts), so the route and the position dot draw with no internet; only
// the street tiles need data. Missing tiles show the page background and the app is told once ('tiles-offline').
const buildHtml = (C: Palette) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>${LEAFLET_CSS}</style>
<style>html,body,#m{margin:0;height:100%;background:${C.bg}}
#m{opacity:0;transition:opacity .5s}
.leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.6)!important}
.leaflet-tile-pane{filter:${C.scheme === 'dark' ? 'invert(.92) hue-rotate(180deg) saturate(.4) brightness(.9)' : 'saturate(.35) brightness(1.04)'}}</style>
</head><body><div id="m"></div><script>${LEAFLET_JS}</script><script>
var post=function(m){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); };
var map=L.map('m',{zoomControl:false,attributionControl:true});
var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap',
  errorTileUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}).addTo(map);
var offline=false;
tiles.on('tileerror',function(){ if(!offline){ offline=true; post('tiles-offline'); } });
tiles.on('tileload',function(){ if(offline){ offline=false; post('tiles-online'); } });
map.attributionControl.setPrefix(false);
var lines=L.layerGroup().addTo(map), marks=L.layerGroup().addTo(map), me=null, fitted=false, polys=[], fitKey=null, shown=false, anim=null;
var style={color:'${C.route}',weight:5,opacity:.95};
function show(){ if(!shown){ shown=true; document.getElementById('m').style.opacity=1; } }
function dot(ll,c,r){return L.circleMarker(ll,{radius:r||6,color:'#fff',weight:2,fillColor:c,fillOpacity:1});}
function setCur(cur,follow){
  if(!cur) return;
  if(!me){me=dot(cur,'${C.accent}',8).addTo(map);} else me.setLatLng(cur);
  // the first fix: straight to the street (no map of the country first), later ones just pan
  if(follow){ if(fitted) map.panTo(cur); else { map.setView(cur,16,{animate:false}); fitted=true; show(); } }
}
// a finished route draws itself over ~1.2 s like a replay (skipped for very long routes / many routes)
function reveal(segs){
  if(anim) cancelAnimationFrame(anim);
  var total=0; segs.forEach(function(s){ total+=s.length; });
  if(total>6000){ segs.forEach(function(s,i){ polys[i].setLatLngs(s); }); return; }
  var t0=null;
  function frame(ts){
    if(t0==null) t0=ts;
    var k=Math.min(1,(ts-t0)/1200); k=1-Math.pow(1-k,3);
    segs.forEach(function(s,i){ polys[i].setLatLngs(s.slice(0,Math.max(1,Math.ceil(k*s.length)))); });
    if(k<1) anim=requestAnimationFrame(frame); else anim=null;
  }
  anim=requestAnimationFrame(frame);
}
window.reset=function(d){
  var refit=d.fitKey!=null && d.fitKey!==fitKey;
  if(refit){ fitKey=d.fitKey; fitted=false; }
  lines.clearLayers();marks.clearLayers();polys=[];
  var all=[];
  d.segs.forEach(function(s,i){ polys[i]=L.polyline(d.follow?s:[],style).addTo(lines); all=all.concat(s); });
  setCur(d.cur,d.follow);
  if(d.follow && !d.cur && all.length>1 && !shown){ map.fitBounds(L.latLngBounds(all),{padding:[30,30],animate:false}); show(); } // restored recording, no fix yet: show the route
  if(!d.follow && all.length>1 && !fitted){ map.fitBounds(L.latLngBounds(all),{padding:[30,30],animate:false}); fitted=true; show(); }
  else if(!d.follow && all.length===1 && !fitted){ map.setView(all[0],15,{animate:false}); fitted=true; show(); }
  if(!d.follow){ if(all.length>1 && shown) reveal(d.segs); else d.segs.forEach(function(s,i){ polys[i].setLatLngs(s); }); }
};
window.append=function(d){
  d.segs.forEach(function(x){
    var i=x[0]; if(!polys[i]) polys[i]=L.polyline([],style).addTo(lines);
    x[1].forEach(function(p){ polys[i].addLatLng(p); });
  });
  setCur(d.cur,d.follow);
};
window.update=window.reset;
post('ready');
</script></body></html>`;

function RouteMap({ segments, current, follow = false, style, interactive = true, paused = false, fitKey, onTiles }: Props) {
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
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; });
  const tilesRef = useRef(onTiles);
  useEffect(() => { tilesRef.current = onTiles; });
  // a (re)loaded page starts "online" and only reports going offline, so clear a stale offline state here
  const onLoadEnd = useCallback(() => { ready.current = true; tilesRef.current?.('online'); syncRef.current(true); }, []);
  const onMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    const m = e.nativeEvent.data;
    if (m === 'tiles-offline') tilesRef.current?.('offline');
    else if (m === 'tiles-online') tilesRef.current?.('online');
  }, []);
  const webStyle = useMemo(() => ({ backgroundColor: C.bg }), [C.bg]);

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: C.bg }, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        key={C.scheme}
        ref={ref}
        originWhitelist={['*']}
        source={source}
        // links (e.g. the OSM attribution) open in the browser instead of replacing the map
        onShouldStartLoadWithRequest={onNavigate}
        onLoadEnd={onLoadEnd}
        onMessage={onMessage}
        style={webStyle}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const sameLatLng = (a?: Point | null, b?: Point | null) => (!a && !b) || (!!a && !!b && a.lat === b.lat && a.lng === b.lng);
/** The Record screen re-renders every second; the map only needs to know when its inputs really change. */
export default memo(RouteMap, (p, n) =>
  p.segments === n.segments && p.follow === n.follow && p.paused === n.paused && p.fitKey === n.fitKey
  && p.style === n.style && p.interactive === n.interactive && sameLatLng(p.current, n.current));
