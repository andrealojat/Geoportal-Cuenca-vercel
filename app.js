(function () {
  "use strict";
  var PS = 1000;
  var LY = [
    { id: "v_limite_cuenca_geojson", nombre: "Limite Cuenca", vista: "v_limite_cuenca_geojson", gf: "geometry", tipo: "polygon",
      auto: true, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["parroquia", "Parroquia"]], sty: { color: "#eab308", weight: 3, fillOpacity: 0 },
      svg: '<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="none" stroke="#eab308" stroke-width="2" stroke-dasharray="5,3"/></svg>' },
    { id: "v_rios_urbanos_cuenca_geojson", nombre: "Rios Urbanos", vista: "v_rios_urbanos_cuenca_geojson", gf: "geometry", tipo: "line",
      auto: true, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["nombre", "Nombre"], ["tipo", "Tipo"], ["long_km", "Longitud (km)"]], sty: { color: "#3b82f6", weight: 3, fillOpacity: 0 },
      svg: '<svg width="20" height="14"><line x1="1" y1="7" x2="19" y2="7" stroke="#3b82f6" stroke-width="3"/></svg>' },
    { id: "v_vias_urbanas_cuenca_geojson", nombre: "Vias Urbanas", vista: "v_vias_urbanas_cuenca_geojson", gf: "geometry", tipo: "line",
      auto: false, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["nombre", "Nombre"], ["tipo", "Via"], ["codvia", "Codigo"]], sty: { color: "#c97b3a", weight: 2 },
      svg: '<svg width="20" height="14"><line x1="1" y1="7" x2="19" y2="7" stroke="#c97b3a" stroke-width="2"/></svg>' },
    { id: "v_predios_cuenca_geojson", nombre: "Predios", vista: "v_predios_cuenca_geojson", gf: "geometry", tipo: "polygon",
      auto: false, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["clave", "Clave Catastral"], ["area", "Area (m\u00B2)"]], sty: { color: "#a1a1aa", weight: 0.8, fillOpacity: 0.1, fillColor: "#a1a1aa" },
      svg: '<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="#a1a1aa" fill-opacity="0.15" stroke="#a1a1aa"/></svg>' },
    { id: "v_construcciones_cuenca_geojson", nombre: "Construcciones", vista: "v_construcciones_cuenca_geojson", gf: "geometry", tipo: "polygon",
      auto: true, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["gid", "ID"], ["clave", "Clave"], ["bloque", "Bloque"]], sty: { color: "#ef4444", weight: 1, fillOpacity: 0.25, fillColor: "#ef4444" },
      svg: '<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="#ef4444" fill-opacity="0.2" stroke="#ef4444"/></svg>' },
    { id: "reportes_ciudadanos", nombre: "Reportes Ciudadanos", vista: "reportes_ciudadanos", gf: "geom", tipo: "point",
      auto: true, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["tipo", "Tipo"], ["descripcion", "Comentario"], ["nombre", "Reportado por"], ["fecha", "Fecha"], ["estado", "Estado"]],
      sty: null, svg: '<svg width="20" height="14"><circle cx="10" cy="7" r="5" fill="#f59e0b" stroke="white" stroke-width="1.5"/></svg>' },
    { id: "v_reportes_construcciones_geojson", nombre: "Reportes Construcciones", vista: "v_reportes_construcciones_geojson", gf: "geometry", tipo: "point",
      auto: false, activo: false, data: null, lyr: null, cnt: 0,
      pop: [["id_construccion", "ID Construccion"], ["clave_construccion", "Clave"], ["bloque", "Bloque"], ["estado_observado", "Estado"], ["prioridad", "Prioridad"], ["comentario", "Comentario"], ["fecha_reporte", "Fecha"]],
      sty: null, svg: '<svg width="20" height="14"><circle cx="10" cy="7" r="5" fill="#f97316" stroke="white" stroke-width="1.5"/></svg>' }
  ];
  var map, baseDark, baseSat, baseOsm, curBase = "dark";
  var rioTips = [], rptMarker = null, rptMap = null;
  var reportedGids = {}, construccionHighlightLayer = null;
  var PRIO_COLORS = { "Baja": "#22c55e", "Media": "#f97316", "Alta": "#ef4444" };
  function $(id) { return document.getElementById(id); }
  function toast(msg, type) {
    var t = $("toast"); if (!t) return;
    t.textContent = msg; t.className = "toast show " + (type || "info");
    setTimeout(function () { t.className = "toast"; }, 3000);
  }
  function showLoad(txt) {
    var lt = $("loading-text"), o = $("loading-overlay");
    if (lt) lt.textContent = txt || "Cargando...";
    if (o) o.classList.add("show");
  }
  function hideLoad() { var o = $("loading-overlay"); if (o) o.classList.remove("show"); }
  var cancelFn = null;
  window.cancelLoad = function () { if (cancelFn) cancelFn(); hideLoad(); };
  function fmtNum(v) { return v == null ? "\u2014" : Number(v).toLocaleString("es-EC"); }
  function fmtDate(v) {
    if (!v) return "\u2014";
    var d = new Date(v); if (isNaN(d.getTime())) return "\u2014";
    var m = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return m[m[d.getMonth()]] + " " + d.getDate() + ", " + d.getFullYear() + " " +
      ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  function find(id) { var r = null; LY.forEach(function (l) { if (l.id === id) r = l; }); return r; }
  function featureCentroid(geometry) {
    var coords = geometry.coordinates, cx = 0, cy = 0, n = 0;
    if (geometry.type === "Polygon") {
      coords[0].forEach(function (c) { cx += c[0]; cy += c[1]; n++; });
    } else if (geometry.type === "MultiPolygon") {
      coords.forEach(function (p) { p[0].forEach(function (c) { cx += c[0]; cy += c[1]; n++; }); });
    }
    if (n > 0) { cx /= n; cy /= n; }
    return { lat: cy, lng: cx };
  }
  map = L.map("map", { preferCanvas: true, center: [-2.9001, -79.0059], zoom: 13 });
  baseDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "\u00A9 CARTO \u00A9 OSM", maxZoom: 19 });
  baseSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "\u00A9 Esri", maxZoom: 18 });
  baseOsm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "\u00A9 OSM", maxZoom: 19 });
  baseDark.addTo(map);
  var bases = { dark: baseDark, satellite: baseSat, osm: baseOsm };
  map.on("mousemove", function (e) {
    $("coords-info").innerHTML = "Lat: " + e.latlng.lat.toFixed(5) + " | Lon: " + e.latlng.lng.toFixed(5) + " | Zoom: " + map.getZoom();
  });
  map.on("zoomend", function () {
    var z = map.getZoom(), rios = find("v_rios_urbanos_cuenca_geojson");
    rioTips.forEach(function (t) {
      if (z >= 15 && rios && rios.activo) { if (!map.hasLayer(t)) t.addTo(map); }
      else { if (map.hasLayer(t)) map.removeLayer(t); }
    });
  });
  window.switchBasemap = function (name, btn) {
    map.removeLayer(bases[curBase]); bases[name].addTo(map); curBase = name;
    document.querySelectorAll(".basemap-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
  };
  function mkPopup(def, p, extra) {
    var h = '<div class="popup-header"><span class="popup-icon">' + def.svg + '</span><span class="popup-layer">' + def.nombre + '</span></div><div class="popup-body">';
    def.pop.forEach(function (f) {
      var k = f[0], lb = f[1], v = p[k];
      if (v == null || v === "") v = "\u2014";
      else if (k === "area") v = fmtNum(v) + " m\u00B2";
      else if (k === "long_km") v = fmtNum(v) + " km";
      else if (k === "fecha" || k === "fecha_reporte") v = fmtDate(v);
      else if (k === "estado" || k === "estado_observado") v = String(v).charAt(0).toUpperCase() + String(v).slice(1);
      else if (typeof v === "number") v = fmtNum(v);
      h += "<div class='popup-field'><div class='popup-label'>" + lb + "</div><div class='popup-value'>" + v + "</div></div>";
    });
    return h + (extra || "") + "</div>";
  }
  var PT_STYLE = { radius: 8, fillColor: "#f59e0b", color: "white", weight: 2.5, fillOpacity: 0.9 };
  function mkStyle(def) {
    return function (f) {
      if (f && f.geometry && f.geometry.type === "Point") return {};
      return def.sty || {};
    };
  }
  function cargar(def, onBatch) {
    showLoad("Cargando " + def.nombre + "...");
    var aborted = false;
    cancelFn = function () { aborted = true; };
    var all = [], off = 0;
    function pg() {
      if (aborted) return Promise.resolve();
      var page = Math.floor(off / PS) + 1;
      var lt = $("loading-text");
      if (lt) lt.textContent = def.nombre + ": pagina " + page + " (" + all.length.toLocaleString("es-EC") + " registros)..."
      var u = "/api/layer?v=" + encodeURIComponent(def.vista) + "&limit=" + PS + "&offset=" + off;
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " en " + def.vista);
        return r.json();
      }).then(function (rows) {
        if (!rows || !rows.length) return;
        rows.forEach(function (row) {
          var g = row[def.gf]; if (!g) return;
          if (typeof g === "string") { try { g = JSON.parse(g); } catch (e) { return; } }
          var props = {}; for (var k in row) { if (k !== def.gf) props[k] = row[k]; }
          all.push({ type: "Feature", properties: props, geometry: g });
        });
        if (rows.length === PS) { off += PS; return pg(); }
      });
    }
    return pg().then(function () {
      def.data = { type: "FeatureCollection", features: all }; def.cnt = all.length;
      if (onBatch) onBatch(def);
    }).catch(function (e) {
      if (aborted) { toast("Carga cancelada", "error"); }
      else { toast("Error cargando " + def.nombre + ": " + e.message, "error"); }
      def.data = { type: "FeatureCollection", features: [] }; def.cnt = 0;
    });
  }
  function mkRioLabels(feats) {
    var seen = {};
    feats.forEach(function (f) {
      var n = f.properties.nombre; if (!n || seen[n]) return; seen[n] = true;
      var g = f.geometry; if (!g) return;
      var coords = [];
      if (g.type === "LineString") coords = g.coordinates;
      else if (g.type === "MultiLineString") {
        var mx = 0; g.coordinates.forEach(function (s) { if (s.length > mx) { mx = s.length; coords = s; } });
      }
      if (coords.length < 2) return;
      var mid = coords[Math.floor(coords.length / 2)];
      var tip = L.tooltip({ permanent: false, direction: "center", className: "rio-label" })
        .setLatLng([mid[1], mid[0]]).setContent(n);
      rioTips.push(tip);
    });
  }
  function clearRioLabels() {
    rioTips.forEach(function (t) { if (map.hasLayer(t)) map.removeLayer(t); }); rioTips = [];
  }
  var RPT_COLORS = {
    "Bache en via": "#ef4444", "Alumbrado danado": "#eab308", "Basura acumulada": "#22c55e",
    "Inundacion": "#3b82f6", "Deslizamiento": "#a855f7", "Vandalismo": "#ec4899",
    "Arbol caido": "#10b981", "Tapa alcantarilla": "#6b7280", "Fuga de agua": "#06b6d4",
    "Parque deteriorado": "#14b8a6", "Senalizacion": "#f97316", "Otro": "#94a3b8"
  };
  function rptColor(tipo) { return RPT_COLORS[tipo] || "#f59e0b"; }

  function addToMap(def) {
    if (def.tipo === "point") {
      if (def.id === "reportes_ciudadanos") {
        def.lyr = L.geoJSON(def.data, {
          pointToLayer: function (f, ll) {
            var c = rptColor(f.properties && f.properties.tipo);
            return L.circleMarker(ll, { radius: 8, fillColor: c, color: "#fff", weight: 2, fillOpacity: 0.9 });
          },
          onEachFeature: function (f, l) {
            var p = f.properties || {};
            var extra = '<div class="popup-status-wrap"><label class="popup-label">Estado:</label><select class="popup-status-select" onchange="cambiarEstadoReporte(' + (p.id || "null") + ',this.value,this)">';
            var estados = ["pendiente","en_revision","resuelto","rechazado"];
            var labels = {"pendiente":"Pendiente","en_revision":"En Revision","resuelto":"Resuelto","rechazado":"Rechazado"};
            var cur = p.estado || "pendiente";
            estados.forEach(function(e){
              extra += '<option value="' + e + '"' + (e === cur ? " selected" : "") + '>' + labels[e] + '</option>';
            });
            extra += '</select><span class="popup-status-msg"></span></div>';
            l.bindPopup(mkPopup(def, p, extra), { maxWidth: 300, className: "info-popup" });
          }
        }).addTo(map);
      } else if (def.id === "v_reportes_construcciones_geojson") {
        def.lyr = L.geoJSON(def.data, {
          pointToLayer: function (f, ll) {
            var c = PRIO_COLORS[f.properties && f.properties.prioridad] || "#f97316";
            return L.circleMarker(ll, { radius: 8, fillColor: c, color: "#fff", weight: 2, fillOpacity: 0.9 });
          },
          onEachFeature: function (f, l) { l.bindPopup(mkPopup(def, f.properties), { maxWidth: 300, className: "info-popup" }); }
        }).addTo(map);
        buildReportedGids();
      } else {
        def.lyr = L.geoJSON(def.data, {
          pointToLayer: function (f, ll) { return L.circleMarker(ll, PT_STYLE); },
          style: function () { return {}; },
          onEachFeature: function (f, l) { l.bindPopup(mkPopup(def, f.properties), { maxWidth: 300, className: "info-popup" }); }
        }).addTo(map);
      }
    } else if (def.id === "v_construcciones_cuenca_geojson") {
      def.lyr = L.geoJSON(def.data, {
        style: mkStyle(def),
        onEachFeature: function (f, l) {
          var center = featureCentroid(f.geometry);
          var gid = f.properties.gid != null ? f.properties.gid : "";
          var clave = f.properties.clave || "";
          var bloque = f.properties.bloque || "";
          var extra = '<div class="popup-actions"><button class="popup-report-btn" onclick="reportarConstruccion(\'' + gid + '\',\'' + clave + '\',\'' + bloque + '\',' + center.lat + ',' + center.lng + ')">Reportar esta construcci\u00f3n</button></div>';
          l.bindPopup(mkPopup(def, f.properties, extra), { maxWidth: 300, className: "info-popup" });
        }
      }).addTo(map);
      updateConstruccionHighlight();
    } else {
      def.lyr = L.geoJSON(def.data, {
        style: mkStyle(def),
        onEachFeature: function (f, l) { l.bindPopup(mkPopup(def, f.properties), { maxWidth: 300, className: "info-popup" }); }
      }).addTo(map);
    }
    def.activo = true;
    if (def.id === "v_rios_urbanos_cuenca_geojson") mkRioLabels(def.data.features);
  }

  function buildReportedGids() {
    reportedGids = {};
    var rc = find("v_reportes_construcciones_geojson");
    if (rc && rc.data && rc.data.features) {
      rc.data.features.forEach(function (f) {
        var gid = f.properties && f.properties.id_construccion;
        if (gid != null) reportedGids[String(gid)] = true;
      });
    }
  }

  function updateConstruccionHighlight() {
    if (construccionHighlightLayer) {
      map.removeLayer(construccionHighlightLayer);
      construccionHighlightLayer = null;
    }
    var cDef = find("v_construcciones_cuenca_geojson");
    if (!cDef || !cDef.activo || !cDef.data) return;
    buildReportedGids();
    var gids = Object.keys(reportedGids);
    if (gids.length === 0) return;
    var highlightFeatures = cDef.data.features.filter(function (f) {
      return f.properties && f.properties.gid != null && reportedGids[String(f.properties.gid)];
    });
    if (highlightFeatures.length === 0) return;
    construccionHighlightLayer = L.geoJSON(
      { type: "FeatureCollection", features: highlightFeatures },
      { style: { color: "#f59e0b", weight: 3, fillOpacity: 0, dashArray: "6,4" }, interactive: false }
    ).addTo(map);
  }

  function refreshUI() { updateStats(); updateLegend(); updateAttrSel(); }
  window.toggleLayer = function (el) {
    var def = find(el.getAttribute("data-layer")); if (!def) return;
    var tog = $("tog-" + def.id);
    if (def.activo) {
      if (def.lyr) { map.removeLayer(def.lyr); def.lyr = null; }
      def.activo = false; el.classList.remove("active");
      if (tog) tog.classList.remove("active");
      if (def.id === "v_rios_urbanos_cuenca_geojson") clearRioLabels();
      if (def.id === "v_construcciones_cuenca_geojson" || def.id === "v_reportes_construcciones_geojson") {
        updateConstruccionHighlight();
      }
    } else {
      if (!def.data) {
        cargar(def).then(function () {
          try { addToMap(def); } catch(e) {}
          el.classList.add("active"); if (tog) tog.classList.add("active");
          refreshUI();
        }).finally(function(){ hideLoad(); });
        return;
      }
      addToMap(def); el.classList.add("active");
      if (tog) tog.classList.add("active");
    }
    refreshUI();
  };
  function updateStats() {
    var act = LY.filter(function (l) { return l.activo; });
    $("stat-layers").textContent = act.length;
    var tot = 0; act.forEach(function (l) { tot += l.cnt; });
    $("stat-features").textContent = tot.toLocaleString("es-EC");
    LY.forEach(function (l) { var e = $("count-" + l.id); if (e) e.textContent = l.cnt.toLocaleString("es-EC"); });
  }
  function updateLegend() {
    var h = "", seenReports = false, seenRC = false;
    LY.forEach(function (l) {
      if (!l.activo) return;
      if (l.id === "reportes_ciudadanos") {
        h += '<div class="legend-section">Reportes Ciudadanos</div>';
        var used = {};
        if (l.data && l.data.features) l.data.features.forEach(function (f) {
          var t = f.properties && f.properties.tipo; if (!t || used[t]) return; used[t] = true;
          h += '<div class="legend-item"><span class="legend-symbol point" style="background:' + rptColor(t) + ';border:2px solid white;"></span> ' + t + "</div>";
        });
        if (Object.keys(used).length === 0) h += '<div class="legend-item"><span class="legend-symbol point" style="background:#f59e0b;border:2px solid white;"></span> Sin datos</div>';
        seenReports = true;
      } else if (l.id === "v_reportes_construcciones_geojson") {
        h += '<div class="legend-section">Reportes Construcciones</div>';
        var pUsed = {};
        if (l.data && l.data.features) l.data.features.forEach(function (f) {
          var p = f.properties && f.properties.prioridad; if (!p || pUsed[p]) return; pUsed[p] = true;
          h += '<div class="legend-item"><span class="legend-symbol point" style="background:' + (PRIO_COLORS[p] || "#f97316") + ';border:2px solid white;"></span> ' + p + "</div>";
        });
        if (Object.keys(pUsed).length === 0) h += '<div class="legend-item"><span class="legend-symbol point" style="background:#f97316;border:2px solid white;"></span> Sin datos</div>';
        seenRC = true;
      } else if (l.tipo === "point")
        h += '<div class="legend-item"><span class="legend-symbol point" style="background:#f59e0b;border:2px solid white;"></span> ' + l.nombre + "</div>";
      else if (l.tipo === "line")
        h += '<div class="legend-item"><span class="legend-symbol" style="background:' + l.sty.color + ';"></span> ' + l.nombre + "</div>";
      else
        h += '<div class="legend-item"><span class="legend-symbol polygon" style="background:' + l.sty.color + ';"></span> ' + l.nombre + "</div>";
    });
    $("legend-items").innerHTML = h;
    var lg = $("legend"); if (lg) { lg.className = h ? "legend show" : "legend"; }
  }
  function updateAttrSel() {
    var s = $("attr-layer-select"), cv = s.value; s.innerHTML = "";
    LY.forEach(function (l) {
      if (!l.activo) return;
      var o = document.createElement("option"); o.value = l.id; o.textContent = l.nombre; s.appendChild(o);
    });
    if (cv) s.value = cv;
  }
  window.loadAttrTable = function () {
    var s = $("attr-layer-select"), def = find(s.value);
    if (!def || !def.data) return;
    var feats = def.data.features.slice(0, 50);
    var keys = feats.length > 0 ? Object.keys(feats[0].properties) : [];
    var h = "<table class='attr-table'><thead><tr>";
    keys.forEach(function (k) { h += "<th>" + k + "</th>"; });
    h += "<th>Ver</th></tr></thead><tbody>";
    feats.forEach(function (f, i) {
      h += "<tr data-idx='" + i + "'>";
      keys.forEach(function (k) { h += "<td>" + (f.properties[k] != null ? f.properties[k] : "\u2014") + "</td>"; });
      h += "<td><button class='btn-sm' onclick='zoomToFeature(\"" + def.id + "\"," + i + ")'>Ver</button></td></tr>";
    });
    h += "</tbody></table>";
    if (def.data.features.length > 50) h += "<div class='attr-note'>Mostrando 50 de " + def.data.features.length + " registros</div>";
    $("attr-table-container").innerHTML = h;
  };
  window.zoomToFeature = function (lid, idx) {
    var def = find(lid); if (!def || !def.data) return;
    var f = def.data.features[idx]; if (!f) return;
    var tmp = L.geoJSON(f); map.fitBounds(tmp.getBounds().pad(0.2)); tmp.remove();
    if (def.lyr) def.lyr.eachLayer(function (l) { if (l.feature === f) l.openPopup(); });
  };
  window.filterAttrTable = function () {
    var q = $("attr-search").value.toLowerCase();
    $("attr-table-container").querySelectorAll("tbody tr").forEach(function (r) {
      r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none";
    });
  };

  function initRptMap() {
    rptMap = L.map("report-form-map", { preferCanvas: true, center: [-2.9001, -79.0059], zoom: 14 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(rptMap);
    rptMap.on("click", function (e) {
      if (rptMarker) rptMap.removeLayer(rptMarker);
      rptMarker = L.circleMarker(e.latlng, { radius: 8, fillColor: "#ef4444", color: "white", weight: 2, fillOpacity: 0.9 }).addTo(rptMap);
      $("rpt-lat").value = e.latlng.lat.toFixed(6);
      $("rpt-lon").value = e.latlng.lng.toFixed(6);
      var st = $("report-location-status"), tx = $("report-location-text");
      if (st) st.className = "report-status set";
      if (tx) tx.textContent = "Ubicacion: " + e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5);
      validateRptForm();
    });
  }
  window.toggleReportPanel = function () {
    var p = $("report-panel"); if (!p) return;
    p.classList.toggle("open");
    if (p.classList.contains("open")) {
      setTimeout(function () { rptMap && rptMap.invalidateSize(); }, 400);
    }
  };
  window.enviarReporte = function () {
    var tipo = $("rpt-tipo").value, desc = $("rpt-comentario").value.trim();
    var lat = parseFloat($("rpt-lat").value), lon = parseFloat($("rpt-lon").value);
    if (!tipo) { toast("Seleccione un tipo de reporte", "error"); return; }
    if (isNaN(lat) || isNaN(lon)) { toast("Seleccione una ubicacion en el mapa", "error"); return; }
    if (desc.length < 10) { toast("El comentario debe tener al menos 10 caracteres", "error"); return; }
    fetch("/api/report-ciudadano", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: tipo, descripcion: desc, lat: lat, lon: lon })
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); })
      .then(function () {
        toast("Reporte enviado exitosamente", "success");
        var rm = $("report-message");
        if (rm) { rm.innerHTML = "Reporte enviado correctamente"; rm.className = "report-message success"; }
        limpiarReporte();
        var def = find("reportes_ciudadanos");
        if (def && def.activo) {
          map.removeLayer(def.lyr); def.lyr = null; def.activo = false; def.data = null;
          cargar(def).then(function () {
            try { addToMap(def); } catch(e) {}
            var el = $("tog-reportes_ciudadanos");
            if (el) el.classList.add("active"); refreshUI();
          }).finally(function(){ hideLoad(); });
        }
      }).catch(function (e) {
        toast("Error al enviar: " + e.message, "error");
        var rm = $("report-message");
        if (rm) { rm.innerHTML = "Error al enviar el reporte"; rm.className = "report-message error"; }
      });
  };
  window.limpiarReporte = function () {
    if ($("rpt-tipo")) $("rpt-tipo").value = "";
    if ($("rpt-comentario")) $("rpt-comentario").value = "";
    if ($("rpt-lat")) $("rpt-lat").value = "";
    if ($("rpt-lon")) $("rpt-lon").value = "";
    var cc = $("rpt-charcount"); if (cc) { cc.textContent = "0"; cc.className = "char-count"; }
    var st = $("report-location-status"), tx = $("report-location-text");
    if (st) st.className = "report-status";
    if (tx) tx.textContent = "Haz clic en el mapa para ubicar el reporte";
    var rm = $("report-message"); if (rm) { rm.innerHTML = ""; rm.className = "report-message"; }
    if (rptMarker && rptMap) { rptMap.removeLayer(rptMarker); rptMarker = null; }
    var btn = $("btn-rpt-submit"); if (btn) btn.disabled = true;
  };
  function validateRptForm() {
    var tipo = $("rpt-tipo").value;
    var desc = $("rpt-comentario").value.trim();
    var lat = $("rpt-lat").value;
    var valid = tipo && lat && desc.length >= 10;
    var btn = $("btn-rpt-submit"); if (btn) btn.disabled = !valid;
  }
  if ($("rpt-tipo")) $("rpt-tipo").addEventListener("change", validateRptForm);
  if ($("rpt-comentario")) {
    $("rpt-comentario").addEventListener("input", function () {
      var n = this.value.length, cc = $("rpt-charcount");
      if (cc) { cc.textContent = n; cc.className = n >= 10 ? "char-count valid" : "char-count invalid"; }
      validateRptForm();
    });
  }

  /* ═══ REPORTE CONSTRUCCIONES ═══════════════════════════════ */
  window.reportarConstruccion = function (gid, clave, bloque, lat, lon) {
    map.closePopup();
    if ($("rc-id")) $("rc-id").value = gid || "";
    if ($("rc-clave")) $("rc-clave").value = clave || "";
    if ($("rc-bloque")) $("rc-bloque").value = bloque || "";
    if ($("rc-lat")) $("rc-lat").value = lat != null ? Number(lat).toFixed(6) : "";
    if ($("rc-lon")) $("rc-lon").value = lon != null ? Number(lon).toFixed(6) : "";
    var st = $("rc-location-status"), tx = $("rc-location-text");
    if (st) st.className = "report-status set";
    if (tx) tx.textContent = "Construccion: " + (clave || gid) + (bloque ? " / " + bloque : "");
    var p = $("construccion-report-panel");
    if (p) p.classList.add("open");
    validateConstruccionForm();
  };
  window.toggleConstruccionReportPanel = function () {
    var p = $("construccion-report-panel"); if (!p) return;
    p.classList.toggle("open");
  };
  function validateConstruccionForm() {
    var estado = $("rc-estado").value;
    var prioridad = $("rc-prioridad").value;
    var desc = $("rc-comentario").value.trim();
    var lat = $("rc-lat").value;
    var valid = estado && prioridad && lat && desc.length >= 10;
    var btn = $("btn-rc-submit"); if (btn) btn.disabled = !valid;
  }
  window.enviarReporteConstruccion = function () {
    var idCons = $("rc-id").value;
    var clave = $("rc-clave").value;
    var bloque = $("rc-bloque").value;
    var estado = $("rc-estado").value;
    var prioridad = $("rc-prioridad").value;
    var comentario = $("rc-comentario").value.trim();
    var lat = parseFloat($("rc-lat").value);
    var lon = parseFloat($("rc-lon").value);
    if (!estado) { toast("Seleccione el estado observado", "error"); return; }
    if (!prioridad) { toast("Seleccione la prioridad", "error"); return; }
    if (comentario.length < 10) { toast("El comentario debe tener al menos 10 caracteres", "error"); return; }
    if (isNaN(lat) || isNaN(lon)) { toast("Ubicacion no disponible", "error"); return; }
    var payload = { id_construccion: idCons || null, clave_construccion: clave || null, bloque: bloque || null, estado_observado: estado, prioridad: prioridad, comentario: comentario, lat: lat, lon: lon };
    showLoad("Enviando reporte...");
    fetch("/api/report-construccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + ": " + t); });
        return r.json();
      })
      .then(function (data) {
        hideLoad();
        toast("Reporte de construccion enviado", "success");
        var rm = $("rc-message");
        if (rm) { rm.innerHTML = "Reporte enviado correctamente"; rm.className = "report-message success"; }
        limpiarReporteConstruccion();
        var def = find("v_reportes_construcciones_geojson");
        if (def) {
          if (def.activo && def.lyr) { map.removeLayer(def.lyr); }
          def.lyr = null; def.activo = false; def.data = null;
          cargar(def).then(function () {
            addToMap(def);
            var el = $("tog-v_reportes_construcciones_geojson");
            if (el) el.classList.add("active");
            var card = document.querySelector('[data-layer="v_reportes_construcciones_geojson"]');
            if (card) card.classList.add("active");
            updateConstruccionHighlight();
            refreshUI();
          }).catch(function(e){ console.error("RC reload error:", e); }).finally(function(){ hideLoad(); });
        }
      }).catch(function (e) {
        hideLoad();
        console.error("RC insert error:", e);
        toast("Error al enviar: " + e.message, "error");
        var rm = $("rc-message");
        if (rm) { rm.innerHTML = "Error al enviar el reporte: " + e.message; rm.className = "report-message error"; }
      });
  };
  window.limpiarReporteConstruccion = function () {
    if ($("rc-id")) $("rc-id").value = "";
    if ($("rc-clave")) $("rc-clave").value = "";
    if ($("rc-bloque")) $("rc-bloque").value = "";
    if ($("rc-lat")) $("rc-lat").value = "";
    if ($("rc-lon")) $("rc-lon").value = "";
    if ($("rc-estado")) $("rc-estado").value = "";
    if ($("rc-prioridad")) $("rc-prioridad").value = "";
    if ($("rc-comentario")) $("rc-comentario").value = "";
    var cc = $("rc-charcount"); if (cc) { cc.textContent = "0"; cc.className = "char-count"; }
    var st = $("rc-location-status"), tx = $("rc-location-text");
    if (st) st.className = "report-status";
    if (tx) tx.textContent = "Seleccion\u00f3 una construcci\u00f3n en el mapa";
    var rm = $("rc-message"); if (rm) { rm.innerHTML = ""; rm.className = "report-message"; }
    var btn = $("btn-rc-submit"); if (btn) btn.disabled = true;
  };
  if ($("rc-estado")) $("rc-estado").addEventListener("change", validateConstruccionForm);
  if ($("rc-prioridad")) $("rc-prioridad").addEventListener("change", validateConstruccionForm);
  if ($("rc-comentario")) {
    $("rc-comentario").addEventListener("input", function () {
      var n = this.value.length, cc = $("rc-charcount");
      if (cc) { cc.textContent = n; cc.className = n >= 10 ? "char-count valid" : "char-count invalid"; }
      validateConstruccionForm();
    });
  }

  /* ═══ CHARTS ═════════════════════════════════════════════════ */
  var chartInstance = null;
  var currentChartTab = "predios";

  function polygonAreaM2(geometry) {
    if (!geometry || !geometry.coordinates) return 0;
    var coords;
    if (geometry.type === "Polygon") coords = geometry.coordinates[0];
    else if (geometry.type === "MultiPolygon") {
      var total = 0;
      geometry.coordinates.forEach(function (p) { total += polygonAreaM2({ type: "Polygon", coordinates: p }); });
      return total;
    } else return 0;
    var n = coords.length;
    if (n < 3) return 0;
    var area = 0;
    for (var i = 0; i < n - 1; i++) {
      area += (coords[i + 1][0] - coords[i][0]) * (coords[i][1] + coords[i + 1][1]);
    }
    area += (coords[0][0] - coords[n - 1][0]) * (coords[0][1] + coords[n - 1][1]);
    return Math.abs(area / 2) * 111319.49 * 111319.49 * Math.cos(-2.9 * Math.PI / 180);
  }

  function detectAreaKey(features) {
    var candidates = ["area", "area_m2", "sup", "superficie", "hectareas", "st_area"];
    var sample = Math.min(features.length, 50);
    for (var c = 0; c < candidates.length; c++) {
      var k = candidates[c], hits = 0;
      for (var i = 0; i < sample; i++) {
        var v = features[i].properties && features[i].properties[k];
        if (v != null && !isNaN(v) && Number(v) > 0) hits++;
      }
      if (hits >= sample * 0.3) return k;
    }
    return null;
  }

  function getAreas(features) {
    var areas = [];
    var areaKey = detectAreaKey(features);
    features.forEach(function (f) {
      var a = 0;
      if (areaKey && f.properties) {
        a = Number(f.properties[areaKey]);
        if (isNaN(a) || a <= 0) a = 0;
      }
      if (a === 0 && f.geometry) a = polygonAreaM2(f.geometry);
      if (a > 0) areas.push(a);
    });
    return areas;
  }

  function buildBins(areas) {
    if (areas.length === 0) return { labels: [], counts: [], total: 0, avg: 0, min: 0, max: 0, sum: 0 };
    areas.sort(function (a, b) { return a - b; });
    var maxVal = areas[areas.length - 1];
    var minVal = areas[0];
    var targetBins = 7;
    var rawBin = (maxVal - minVal) / targetBins;
    if (rawBin <= 0) rawBin = maxVal / targetBins || 1;
    var mag = Math.pow(10, Math.floor(Math.log10(rawBin)));
    var res = rawBin / mag;
    var nice;
    if (res <= 1.5) nice = mag;
    else if (res <= 3) nice = 2 * mag;
    else if (res <= 7) nice = 5 * mag;
    else nice = 10 * mag;
    if (nice < 1) nice = 1;
    var start = Math.floor(minVal / nice) * nice;
    var bins = {};
    areas.forEach(function (a) {
      var b = Math.floor((a - start) / nice) * nice + start;
      var key = b + "-" + (b + nice);
      bins[key] = (bins[key] || 0) + 1;
    });
    var labels = Object.keys(bins).sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
    var counts = labels.map(function (l) { return bins[l]; });
    var sum = areas.reduce(function (s, v) { return s + v; }, 0);
    return { labels: labels, counts: counts, total: areas.length, avg: Math.round(sum / areas.length), min: Math.round(minVal), max: Math.round(maxVal), sum: Math.round(sum) };
  }

  function ensureLayerAndThen(type, cb) {
    var id = type === "predios" ? "v_predios_cuenca_geojson" : "v_construcciones_cuenca_geojson";
    var def = find(id);
    if (!def) { toast("Capa no encontrada", "error"); return; }
    if (def.data && def.data.features && def.data.features.length > 0) { cb(def); return; }
    showLoad("Cargando " + def.nombre + " para graficos...");
    cargar(def).then(function () {
      addToMap(def);
      var el = $("tog-" + def.id); if (el) el.classList.add("active");
      var card = document.querySelector('[data-layer="' + def.id + '"]');
      if (card) card.classList.add("active");
      refreshUI();
      cb(def);
    }).catch(function (e) {
      toast("Error cargando " + def.nombre + ": " + e.message, "error");
    }).finally(function () { hideLoad(); });
  }

  function renderChart(type) {
    ensureLayerAndThen(type, function (def) {
      var areas = getAreas(def.data.features);
      if (areas.length === 0) {
        toast("No se pudo calcular area para " + def.nombre + ". Verifique que la capa este cargada.", "error");
        return;
      }
      var range = buildBins(areas);
      if (chartInstance) chartInstance.destroy();
      var ctx = document.getElementById("area-chart");
      var baseH = type === "predios" ? [99, 102, 241] : [239, 68, 68];
      var colors = range.labels.map(function (_, i) {
        var t = i / Math.max(range.labels.length - 1, 1);
        return "rgba(" + Math.round(baseH[0] - t * 30) + "," + Math.round(baseH[1] + t * 60) + "," + Math.round(baseH[2] - t * 40) + ",0.8)";
      });
      chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: range.labels.map(function (l) { return l + " m\u00B2"; }),
          datasets: [{ label: "Cantidad", data: range.counts, backgroundColor: colors, borderColor: colors.map(function (c) { return c.replace("0.8", "1"); }), borderWidth: 1, borderRadius: 4 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: "Distribucion de Areas - " + def.nombre, color: "#e4e4e7", font: { size: 14, weight: "600", family: "Inter" } },
            tooltip: { backgroundColor: "rgba(15,15,35,0.95)", titleFont: { family: "Inter" }, bodyFont: { family: "Inter" } }
          },
          scales: {
            x: { title: { display: true, text: "Rango de Area (m\u00B2)", color: "#a1a1aa", font: { family: "Inter", size: 11 } }, ticks: { color: "#a1a1aa", font: { family: "Inter", size: 9 }, maxRotation: 45 }, grid: { color: "rgba(255,255,255,0.04)" } },
            y: { title: { display: true, text: "Cantidad", color: "#a1a1aa", font: { family: "Inter", size: 11 } }, ticks: { color: "#a1a1aa", font: { family: "Inter", size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" }, beginAtZero: true }
          }
        }
      });
      $("chart-summary").innerHTML =
        '<span class="chart-stat"><strong>' + range.total.toLocaleString("es-EC") + '</strong> features con area</span>' +
        '<span class="chart-stat">Promedio: <strong>' + range.avg.toLocaleString("es-EC") + ' m\u00B2</strong></span>' +
        '<span class="chart-stat">Min: <strong>' + range.min.toLocaleString("es-EC") + ' m\u00B2</strong></span>' +
        '<span class="chart-stat">Max: <strong>' + range.max.toLocaleString("es-EC") + ' m\u00B2</strong></span>' +
        '<span class="chart-stat">Area total: <strong>' + range.sum.toLocaleString("es-EC") + ' m\u00B2</strong></span>';
    });
  }

  window.abrirGraficos = function () {
    var m = $("chart-modal"); if (m) m.classList.add("open");
    renderChart(currentChartTab);
  };
  window.cerrarGraficos = function () {
    var m = $("chart-modal"); if (m) m.classList.remove("open");
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  };
  window.switchChartTab = function (tab, btn) {
    currentChartTab = tab;
    document.querySelectorAll(".chart-tab").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    renderChart(tab);
  };

  /* ═══ RIVER PROTECTION MARGIN 50M ════════════════════════════ */
  var riverMarginLayer = null;
  var riverAffectedLayer = null;

  function toRad(deg) { return deg * Math.PI / 180; }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  function bufferLineMeters(coords, meters) {
    var leftCoords = [], rightCoords = [];
    for (var i = 0; i < coords.length - 1; i++) {
      var lon1 = coords[i][0], lat1 = coords[i][1];
      var lon2 = coords[i + 1][0], lat2 = coords[i + 1][1];
      var dLon = toRad(lon2 - lon1), dLat = toRad(lat2 - lat1);
      var brng = Math.atan2(Math.sin(dLon) * Math.cos(toRad(lat2)), Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon));
      var leftBrng = brng - Math.PI / 2;
      var rightBrng = brng + Math.PI / 2;
      var dLatLeft = (meters / 6371000) * Math.cos(leftBrng);
      var dLonLeft = (meters / 6371000) * Math.sin(leftBrng) / Math.cos(toRad(lat1));
      var dLatRight = (meters / 6371000) * Math.cos(rightBrng);
      var dLonRight = (meters / 6371000) * Math.sin(rightBrng) / Math.cos(toRad(lat1));
      leftCoords.push([lon1 + dLonLeft, lat1 + dLatLeft]);
      rightCoords.push([lon1 + dLonRight, lat1 + dLatRight]);
      if (i === coords.length - 2) {
        leftCoords.push([lon2 + dLonLeft, lat2 + dLatLeft]);
        rightCoords.push([lon2 + dLonRight, lat2 + dLatRight]);
      }
    }
    rightCoords.reverse();
    return leftCoords.concat(rightCoords);
  }

  function polygonContainsPoint(ring, point) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1];
      var xj = ring[j][0], yj = ring[j][1];
      var intersect = ((yi > point[1]) !== (yj > point[1])) && (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(point, polygon) {
    if (polygon.type === "Polygon") return polygonContainsPoint(polygon.coordinates[0], point);
    if (polygon.type === "MultiPolygon") {
      for (var i = 0; i < polygon.coordinates.length; i++) {
        if (polygonContainsPoint(polygon.coordinates[i][0], point)) return true;
      }
    }
    return false;
  }

  function polygonIntersectsPolygon(geomA, geomB) {
    var coordsA = geomA.type === "Polygon" ? [geomA.coordinates[0]] : geomA.coordinates;
    var coordsB = geomB.type === "Polygon" ? [geomB.coordinates[0]] : geomB.coordinates;
    for (var i = 0; i < coordsA.length; i++) {
      for (var j = 0; j < coordsA[i].length; j++) {
        if (polygonContainsPoint(coordsB[0], coordsA[i][j])) return true;
      }
    }
    for (var i = 0; i < coordsB.length; i++) {
      for (var j = 0; j < coordsB[i].length; j++) {
        if (polygonContainsPoint(coordsA[0], coordsB[i][j])) return true;
      }
    }
    return false;
  }

  window.calcularMargenes = function () {
    var riosDef = find("v_rios_urbanos_cuenca_geojson");
    var consDef = find("v_construcciones_cuenca_geojson");
    if (!riosDef) { toast("Capa de rios no encontrada", "error"); return; }
    if (!consDef) { toast("Capa de construcciones no encontrada", "error"); return; }

    showLoad("Calculando margenes de proteccion (50m)...");

    function doCalc() {
      if (riverMarginLayer) { map.removeLayer(riverMarginLayer); riverMarginLayer = null; }
      if (riverAffectedLayer) { map.removeLayer(riverAffectedLayer); riverAffectedLayer = null; }

      var marginFeatures = [];
      var affectedConstructions = [];
      var totalRios = 0;

      if (riosDef.data && riosDef.data.features) {
        riosDef.data.features.forEach(function (f) {
          if (!f.geometry) return;
          totalRios++;
          var coords = [];
          if (f.geometry.type === "LineString") coords = f.geometry.coordinates;
          else if (f.geometry.type === "MultiLineString") {
            var longest = [];
            f.geometry.coordinates.forEach(function (s) { if (s.length > longest.length) longest = s; });
            coords = longest;
          }
          if (coords.length < 2) return;
          var ring = bufferLineMeters(coords, 50);
          if (ring.length >= 4) {
            ring.push(ring[0]);
            marginFeatures.push({ type: "Feature", properties: { nombre: f.properties.nombre || "Rio", tipo: "Margen 50m" }, geometry: { type: "Polygon", coordinates: [ring] } });
          }
        });
      }

      if (consDef.data && consDef.data.features) {
        consDef.data.features.forEach(function (f) {
          if (!f.geometry) return;
          var centroid = featureCentroid(f.geometry);
          var pt = [centroid.lng, centroid.lat];
          for (var i = 0; i < marginFeatures.length; i++) {
            if (pointInPolygon(pt, marginFeatures[i].geometry)) {
              affectedConstructions.push(f);
              break;
            }
          }
        });
      }

      if (marginFeatures.length === 0) {
        hideLoad();
        toast("No se pudieron calcular margenes", "error");
        return;
      }

      riverMarginLayer = L.geoJSON(
        { type: "FeatureCollection", features: marginFeatures },
        { style: { color: "#3b82f6", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.15, dashArray: "5,5" }, interactive: false }
      ).addTo(map);

      if (affectedConstructions.length > 0) {
        var affGeo = affectedConstructions.map(function (f) { return f.properties; });
        riverAffectedLayer = L.geoJSON(
          { type: "FeatureCollection", features: affectedConstructions },
          {
            style: { color: "#f59e0b", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.4 },
            onEachFeature: function (f, l) {
              var p = f.properties || {};
              var extra = '<div class="popup-actions"><div style="color:#f59e0b;font-size:0.75rem;font-weight:600">Dentro del margen de proteccion de 50m</div></div>';
              l.bindPopup(mkPopup(consDef, p, extra), { maxWidth: 300, className: "info-popup" });
            }
          }
        ).addTo(map);
      }

      hideLoad();
      toast(affectedConstructions.length + " construcciones afectadas por margenes de 50m (" + totalRios + " rios analizados)", "success");

      var panel = $("river-margin-info");
      if (panel) {
        panel.innerHTML = '<div class="river-margin-result">' +
          '<div class="rm-stat"><strong>' + marginFeatures.length + '</strong> poligonos de margen</div>' +
          '<div class="rm-stat"><strong>' + affectedConstructions.length + '</strong> construcciones afectadas</div>' +
          '<div class="rm-stat"><strong>' + totalRios + '</strong> rios analizados</div>' +
          '<button class="btn-rm-clear" onclick="limpiarMargenes()">Limpiar margenes</button>' +
          '</div>';
        panel.style.display = "block";
      }
    }

    if (!riosDef.data) {
      cargar(riosDef).then(function () {
        addToMap(riosDef);
        var el = $("tog-" + riosDef.id); if (el) el.classList.add("active");
        if (!consDef.data) {
          return cargar(consDef).then(function () {
            addToMap(consDef);
            var el2 = $("tog-" + consDef.id); if (el2) el2.classList.add("active");
            refreshUI();
          });
        }
      }).then(doCalc).catch(function (e) {
        hideLoad();
        toast("Error cargando capas: " + e.message, "error");
      });
    } else if (!consDef.data) {
      cargar(consDef).then(function () {
        addToMap(consDef);
        var el = $("tog-" + consDef.id); if (el) el.classList.add("active");
        refreshUI();
      }).then(doCalc).catch(function (e) {
        hideLoad();
        toast("Error cargando construcciones: " + e.message, "error");
      });
    } else {
      doCalc();
    }
  };

  window.limpiarMargenes = function () {
    if (riverMarginLayer) { map.removeLayer(riverMarginLayer); riverMarginLayer = null; }
    if (riverAffectedLayer) { map.removeLayer(riverAffectedLayer); riverAffectedLayer = null; }
    var panel = $("river-margin-info");
    if (panel) { panel.innerHTML = ""; panel.style.display = "none"; }
    toast("Margenes limpiados", "info");
  };

  /* ═══ STATUS CHANGE ═══════════════════════════════════════════ */
  window.cambiarEstadoReporte = function (id, nuevoEstado, selectEl) {
    if (!id) { toast("ID del reporte no disponible", "error"); return; }
    var msg = selectEl.parentElement.querySelector(".popup-status-msg");
    if (msg) { msg.textContent = "Guardando..."; msg.className = "popup-status-msg saving"; }
    fetch("/api/update-estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, estado: nuevoEstado })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || "HTTP " + r.status); });
      return r.json();
    }).then(function () {
      if (msg) { msg.textContent = "Guardado"; msg.className = "popup-status-msg ok"; }
      toast("Estado actualizado a: " + nuevoEstado, "success");
      var def = find("reportes_ciudadanos");
      if (def && def.activo && def.lyr) {
        def.lyr.eachLayer(function (layer) {
          if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
            layer.feature.properties.estado = nuevoEstado;
          }
        });
      }
      setTimeout(function () { if (msg) msg.className = "popup-status-msg"; }, 2000);
    }).catch(function (e) {
      if (msg) { msg.textContent = "Error"; msg.className = "popup-status-msg error"; }
      toast("Error al actualizar: " + e.message, "error");
    });
  };

  /* ═══ PDF GENERATION ═══════════════════════════════════════════ */
  window.generarPDF = function () {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    var pageW = doc.internal.pageSize.getWidth();
    var y = 15;
    var RPT_COLORS_HEX = {
      "Bache en via": [239,68,68], "Alumbrado danado": [234,179,8], "Basura acumulada": [34,197,94],
      "Inundacion": [59,130,246], "Deslizamiento": [168,85,247], "Vandalismo": [236,72,153],
      "Arbol caido": [16,185,129], "Tapa alcantarilla": [107,114,128], "Fuga de agua": [6,182,212],
      "Parque deteriorado": [20,184,166], "Senalizacion": [249,115,22], "Otro": [148,163,184]
    };
    var PRIO_HEX = { "Baja": [34,197,94], "Media": [249,115,22], "Alta": [239,68,68] };

    doc.setFillColor(15, 15, 35);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Geoportal Cuenca - Reportes", 15, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Generado: " + new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }), 15, 19);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 200);
    doc.text("UTPL - Especializacion en Gestion de la Geoinformacion, 2026", 15, 25);
    y = 36;

    function sectionTitle(title, r, g, b) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFillColor(r, g, b);
      doc.roundedRect(15, y - 4, pageW - 30, 9, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title, 20, y + 1.5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    function drawTable(headers, rows, colors) {
      if (rows.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("Sin reportes registrados.", 20, y);
        y += 6;
        return;
      }
      doc.autoTable({
        startY: y,
        head: [headers],
        body: rows,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 30, 30], lineColor: [60, 60, 80], lineWidth: 0.2 },
        headStyles: { fillColor: [30, 30, 50], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: colors || {},
        margin: { left: 15, right: 15 },
        didDrawPage: function (data) { y = data.cursor.y + 5; }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    var rcDef = find("reportes_ciudadanos");
    var rcData = (rcDef && rcDef.data) ? rcDef.data.features : [];
    var rcRows = [];
    rcData.forEach(function (f) {
      var p = f.properties || {};
      rcRows.push([
        p.tipo || "-",
        p.descripcion || "-",
        p.nombre || "-",
        p.estado || "-",
        p.fecha ? fmtDate(p.fecha) : "-"
      ]);
    });
    sectionTitle("Reportes Ciudadanos (" + rcRows.length + ")", 245, 158, 11);
    drawTable(
      ["Tipo", "Descripcion", "Reportado por", "Estado", "Fecha"],
      rcRows,
      { 0: { cellWidth: 30 }, 4: { cellWidth: 28 } }
    );

    var rrDef = find("v_reportes_construcciones_geojson");
    var rrData = (rrDef && rrDef.data) ? rrDef.data.features : [];
    var rrRows = [];
    rrData.forEach(function (f) {
      var p = f.properties || {};
      rrRows.push([
        p.clave_construccion || p.id_construccion || "-",
        p.bloque || "-",
        p.estado_observado || "-",
        p.prioridad || "-",
        p.comentario || "-",
        p.fecha_reporte ? fmtDate(p.fecha_reporte) : "-"
      ]);
    });
    sectionTitle("Reportes de Construcciones (" + rrRows.length + ")", 249, 115, 22);
    drawTable(
      ["Construccion", "Bloque", "Estado", "Prioridad", "Comentario", "Fecha"],
      rrRows,
      { 4: { cellWidth: 45 }, 5: { cellWidth: 28 } }
    );

    var totalReportes = rcRows.length + rrRows.length;
    if (y > 240) { doc.addPage(); y = 15; }
    y += 4;
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(15, y - 4, pageW - 30, 9, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Total de reportes: " + totalReportes + "  |  Ciudadanos: " + rcRows.length + "  |  Construcciones: " + rrRows.length, 20, y + 1.5);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    var footerY = doc.internal.pageSize.getHeight() - 8;
    doc.text("Geoportal Cuenca - UTPL Especializacion en Gestion de la Geoinformacion", 15, footerY);

    doc.save("Reportes_Geoportal_Cuenca_" + new Date().toISOString().slice(0, 10) + ".pdf");
    toast("PDF generado correctamente", "success");
  };

  /* ═══ INIT ═════════════════════════════════════════════════ */
  showLoad("Inicializando geoportal...");
  var autoLayers = LY.filter(function (l) { return l.auto; });
  var loaded = 0;
  var initPromises = autoLayers.map(function (l) {
    return cargar(l, function (def) {
      if (def.data && def.data.features.length > 0) {
        addToMap(def);
        var el = $("tog-" + def.id); if (el) el.classList.add("active");
      }
      loaded++;
      showLoad("Capas: " + loaded + "/" + autoLayers.length + " listas");
      refreshUI();
    });
  });
  Promise.all(initPromises).then(function () {
    refreshUI(); hideLoad();
    if ($("report-form-map")) initRptMap();
  }).catch(function (e) { hideLoad(); toast("Error: " + e.message, "error"); });
})();
