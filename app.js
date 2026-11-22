// ==========================================================================
// APLICACIÓN CLIENTE PEDIDOS FLASH NIRGUA (APP.JS)
// ==========================================================================

// --- FUNCIONES GLOBALES DE SANITIZACIÓN Y ESCAPADO ---
function escaparHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escaparAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escaparJS(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function normalizarTexto(txt) {
  return (txt || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizarTelefono(tel) {
  if (!tel) return '';
  let clean = tel.toString().replace(/\D/g, '');
  if (clean.startsWith('58')) return clean;
  if (clean.startsWith('0')) return '58' + clean.substring(1);
  return '58' + clean;
}
window.normalizarTelefono = normalizarTelefono;

function limpiarTelefonoId(tel) {
  if (!tel) return '';
  let d = tel.toString().replace(/\D/g, '');
  if (d.startsWith('58') && d.length === 12) d = '0' + d.substring(2);
  if (!d.startsWith('0') && d.length === 10) d = '0' + d;
  return d;
}
window.limpiarTelefonoId = limpiarTelefonoId;

// ================= CONFIGURACIÓN DE FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyB19B9jLHPpgKxVvMH97D5VafgTp0CfnOc",
  authDomain: "pedidosflash-c7bb7.firebaseapp.com",
  databaseURL: "https://pedidosflash-c7bb7-default-rtdb.firebaseio.com",
  projectId: "pedidosflash-c7bb7",
  storageBucket: "pedidosflash-c7bb7.firebasestorage.app",
  messagingSenderId: "191012880689",
  appId: "1:191012880689:web:a31697074c619b96a83010",
  measurementId: "G-YHQCDZ6470"
};

let firebaseActivo = false;
let db = null;
try {
  if (window.firebase && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  if (window.firebase) {
    db = firebase.database();
    firebaseActivo = true;
  }
} catch(e) {
  console.warn("Firebase no activo:", e);
}

const NUMERO_WHATSAPP = "584262566854";
let carrito = {};
let esPagoTransporteDirecto = false;
let usuarioActivo = null;
let tasaBCVActual = parseFloat(localStorage.getItem('pedidosflash_tasa_bcv')) || 0;

// COMERCIOS BASE
let infoLocales = {
  moravos: { id: 'moravos', nombre: 'Moravos Café', sub: 'Café, Postres & Especialidades', logo: 'img/moravos.jpg', porcentajeComision: 8 },
  fran_chero: { id: 'fran_chero', nombre: 'El Sabor de Fran & Chero', sub: 'Hamburguesas, Pepitos y Perros', logo: 'img/fran y chero.jpg', porcentajeComision: 10 },
  antons: { id: 'antons', nombre: "Anton's Burgers", sub: 'Burgers Gourmet y Empanadas', logo: 'img/anto bruger nirgua.jpg', porcentajeComision: 10 },
  zirus: { id: 'zirus', nombre: 'Zirus Pizza', sub: 'Pizzas Artesanales', logo: 'img/ziruspizza.webp', porcentajeComision: 10 }
};
let productosDinamicosTiendas = {};

// MAPA DE PRODUCTOS Y RECONSTRUCCIÓN
let mapaProductos = {};
function reconstruirMapaProductos() {
  mapaProductos = {};
  if (window.productos && typeof window.productos === 'object') {
    Object.keys(window.productos).forEach(cat => {
      if (Array.isArray(window.productos[cat])) {
        window.productos[cat].forEach(item => {
          if (item && item.id) {
            item.categoria = cat;
            mapaProductos[item.id] = item;
          }
        });
      }
    });
  }
  Object.keys(productosDinamicosTiendas).forEach(tId => {
    const prods = productosDinamicosTiendas[tId];
    if (prods && typeof prods === 'object') {
      Object.keys(prods).forEach(pKey => {
        const p = prods[pKey];
        if (p) {
          p.id = pKey;
          p.tiendaId = tId;
          mapaProductos[pKey] = p;
        }
      });
    }
  });
}

// ESTADO TRANSPORTE Y RUTAS
let mapaRuta = null;
let puntoOrigen = [10.1500, -68.5667];
let textoOrigenStr = "Mi Ubicación (GPS)";
let puntoDestino = null;
let textoDestinoStr = "No seleccionado";
let lineaTrayecto = null;
let tipoTransporteSeleccionado = 'moto';
let precioTransporte = 1.00;
let metodoPagoActual = 'Pago Móvil';
let clienteLatActual = null;
let clienteLngActual = null;
let itemsDetectadosActuales = [];

let tarifasTransporte = {
  moto_corta: 1.00,
  moto_media: 3.50,
  moto_salon: 4.00,
  carro_corto: 4.00,
  carro_salon: 8.00
};
let claveTarifaSeleccionada = 'moto_corta';
let claseCarreraSeleccionada = 'Moto Corta / Urbana';

// ================= TOAST PROFESIONAL =================
let toastTimeout = null;
function mostrarToast(mensaje, titulo = "Pedidos Flash", tipo = "info") {
  const toast = document.getElementById('toast-notificacion');
  const toastTit = document.getElementById('toast-titulo');
  const toastMsj = document.getElementById('toast-mensaje');
  const toastBg = document.getElementById('toast-icono-bg');
  const toastIcon = document.getElementById('toast-icono');
  if (!toast || !toastTit || !toastMsj) return;

  toastTit.innerText = titulo;
  toastMsj.innerText = mensaje;

  if (toastBg && toastIcon) {
    if (tipo === 'success') {
      toastBg.className = "w-8 h-8 rounded-xl bg-accent-emerald/20 text-accent-emerald flex items-center justify-center shrink-0";
      toastIcon.setAttribute('data-lucide', 'check');
    } else if (tipo === 'error') {
      toastBg.className = "w-8 h-8 rounded-xl bg-accent-magenta/20 text-accent-magenta flex items-center justify-center shrink-0";
      toastIcon.setAttribute('data-lucide', 'alert-circle');
    } else {
      toastBg.className = "w-8 h-8 rounded-xl bg-accent-cyan/20 text-accent-cyan flex items-center justify-center shrink-0";
      toastIcon.setAttribute('data-lucide', 'info');
    }
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  }

  toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (navigator.vibrate) try { navigator.vibrate(30); } catch(e){}

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-4');
  }, 3000);
}

// ================= RENDERIZADO DEL CATÁLOGO & TIENDAS =================
function renderizarCatalogo() {
  try {
    reconstruirMapaProductos();
    const categorias = ['viveres', 'charcuteria', 'carnes', 'verduras', 'bebidas', 'limpieza', 'farmacia', 'ferreteria'];
    categorias.forEach(cat => {
      const sec = document.getElementById(`grid-${cat}`);
      if (sec && window.productos && Array.isArray(window.productos[cat])) {
        const buffer = [];
        window.productos[cat].forEach(item => {
          try {
            if (item && item.id) buffer.push(crearTarjetaProductoHTML(item));
          } catch(e) {
            console.warn(`Error al renderizar item ${item ? item.id : ''}:`, e);
          }
        });
        sec.innerHTML = buffer.join('');
      }
    });

    if (window.productos && Array.isArray(window.productos.panaderia)) {
      const gridPanaderia = document.getElementById('grid-panaderia-panamericana');
      if (gridPanaderia) {
        const bufferPan = [];
        window.productos.panaderia.forEach(item => {
          try {
            if (item && item.id) bufferPan.push(crearTarjetaProductoHTML(item));
          } catch(e) {}
        });
        gridPanaderia.innerHTML = bufferPan.join('');
      }
    }

    renderizarLocalesComerciales();
  } catch(errGlobal) {
    console.error("Error global en renderizarCatalogo:", errGlobal);
  } finally {
    if (window.lucide && typeof lucide.createIcons === 'function') {
      try { lucide.createIcons(); } catch(e){}
    }
  }
}

function renderizarLocalesComerciales() {
  const grid = document.getElementById('grid-locales-comerciales');
  if (!grid) return;
  grid.innerHTML = "";

  Object.keys(infoLocales).forEach(tid => {
    const loc = infoLocales[tid];
    if (!loc) return;
    grid.innerHTML += `
      <button onclick="abrirModalLocal('${escaparJS(loc.id)}')" class="btn-tactil group bg-slate-900/90 border border-slate-800 hover:border-accent-yellow p-3 rounded-[24px] flex flex-col items-center text-center gap-2 shadow-lg backdrop-blur-md transition-all">
        <div class="w-16 h-16 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 p-1 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <img src="${escaparAttr(loc.logo)}" alt="${escaparAttr(loc.nombre)}" class="w-full h-full object-cover rounded-xl" onerror="this.src='img/logo.jfif';">
        </div>
        <div>
          <h4 class="text-xs font-black text-white leading-tight line-clamp-1">${escaparHTML(loc.nombre)}</h4>
          <p class="text-[10px] text-accent-yellow font-bold leading-tight mt-0.5 line-clamp-1">${escaparHTML(loc.sub || 'Comercio Asociado')}</p>
        </div>
        <span class="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Ver Menú ↗</span>
      </button>
    `;
  });
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function abrirModalLocal(localId) {
  const loc = infoLocales[localId];
  if (!loc) return;

  const titEl = document.getElementById('titulo-modal-local');
  const subEl = document.getElementById('sub-modal-local');
  const imgEl = document.getElementById('img-modal-local');
  if (titEl) titEl.innerText = loc.nombre;
  if (subEl) subEl.innerText = loc.sub || 'Menú Especial';
  if (imgEl) imgEl.src = loc.logo || 'img/logo.jfif';

  const contenedor = document.getElementById('grid-modal-productos-local');
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (window.productos && Array.isArray(window.productos.comida)) {
    const itemsComida = window.productos.comida.filter(p => p.local === localId || p.tiendaId === localId);
    itemsComida.forEach(item => {
      contenedor.innerHTML += crearTarjetaProductoHTML(item);
    });
  }

  if (productosDinamicosTiendas[localId]) {
    Object.keys(productosDinamicosTiendas[localId]).forEach(pid => {
      const itemD = productosDinamicosTiendas[localId][pid];
      if (itemD) {
        itemD.id = pid;
        itemD.tiendaId = localId;
        contenedor.innerHTML += crearTarjetaProductoHTML(itemD);
      }
    });
  }

  const modLocal = document.getElementById('modal-productos-local');
  if (modLocal) modLocal.classList.remove('hidden');
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function cerrarModalLocal() {
  const modLocal = document.getElementById('modal-productos-local');
  if (modLocal) modLocal.classList.add('hidden');
}

// ================= CREAR TARJETA PRODUCTO HTML (BLINDADA) =================
function crearTarjetaProductoHTML(item) {
  if (!item || typeof item !== 'object') return '';

  const idSeguro = escaparAttr(item.id || '');
  const idJs = escaparJS(item.id || '');
  const nombreSeguro = escaparHTML(item.nombre || 'Producto');
  const nombreAttr = escaparAttr(item.nombre || 'Producto');
  const nombreBusqueda = escaparAttr(normalizarTexto(item.nombre || ''));
  const subAttr = escaparAttr(item.sub || '');
  const imagenSegura = escaparAttr(item.imagen || 'img/logo.jfif');

  const precioNum = parseFloat(item.precioBase);
  const esConsultar = isNaN(precioNum) || precioNum <= 0;
  const precioMostrar = esConsultar
    ? '<span class="text-[10px] font-black text-accent-cyan bg-accent-cyan/15 px-2 py-0.5 rounded-md border border-accent-cyan/30">Consultar</span>'
    : `<span class="text-xs font-black text-accent-yellow">$${precioNum.toFixed(2)}</span>`;

  const badgeHTML = item.badge
    ? `<span class="absolute top-1.5 right-1.5 bg-accent-magenta text-white font-black text-[8px] px-1.5 py-0.5 rounded-md shadow-md z-10">${escaparHTML(item.badge)}</span>`
    : '';

  let bloqueControl = '';
  if (item.esGranel) {
    const minG = Number(item.minGranel) || 200;
    const maxG = Number(item.maxGranel) || 3000;
    const pasoG = Number(item.pasoGranel) || 100;
    const defG = Number(item.defGranel) || 500;
    const defTexto = defG >= 1000 ? (defG / 1000).toFixed(1) + 'kg' : defG + 'g';
    const subtotalInicial = esConsultar ? 'Consultar' : `$${((precioNum * defG) / 1000).toFixed(2)}`;

    bloqueControl = `
      <div class="w-full space-y-1.5 pt-1">
        <div class="flex justify-between items-center text-[10px] text-slate-300 font-bold px-0.5">
          <span>Peso: <b id="label-gramos-${idSeguro}" class="text-accent-cyan">${defTexto}</b></span>
          <span id="precio-granel-${idSeguro}" class="text-accent-yellow font-black">${subtotalInicial}</span>
        </div>
        <input type="range" id="slider-${idSeguro}" min="${minG}" max="${maxG}" step="${pasoG}" value="${defG}" oninput="actualizarSliderGranel('${idJs}')" onclick="event.stopPropagation()" class="w-full accent-accent-cyan h-1.5 bg-slate-800 rounded-lg cursor-pointer">
        <button onclick="agregarGranelAlCarrito('${idJs}'); event.stopPropagation();" class="btn-tactil w-full bg-gradient-to-r from-accent-cyan to-brand-600 text-slate-950 font-black py-1.5 rounded-xl text-[10px] flex items-center justify-center gap-1 shadow-md">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Agregar
        </button>
      </div>
    `;
  } else {
    bloqueControl = `
      <div class="flex items-center justify-between w-full pt-1 gap-1">
        ${precioMostrar}
        <button onclick="agregarAlCarritoPorId('${idJs}'); event.stopPropagation();" class="btn-tactil bg-accent-cyan hover:bg-cyan-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-1 shadow-md shrink-0">
          <i data-lucide="plus" class="w-3.5 h-3.5 stroke-[3]"></i> Pedir
        </button>
      </div>
    `;
  }

  return `
    <div class="item-producto cursor-pointer active:scale-95 hover:border-cyan-500/60 transition-all select-none bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-[22px] flex flex-col justify-between relative group backdrop-blur-sm shadow-md" data-nombre="${nombreBusqueda}" data-sub="${subAttr}" onclick="puyarProductoAgregar('${idJs}', event)">
      ${badgeHTML}
      <div class="w-full h-20 rounded-xl overflow-hidden bg-slate-900/60 flex items-center justify-center p-1 relative mb-1.5 pointer-events-none">
        <img src="${imagenSegura}" loading="lazy" alt="${nombreAttr}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" onerror="this.src='img/logo.jfif';">
      </div>
      <div class="flex-1 flex flex-col justify-between pointer-events-none">
        <h5 class="text-xs font-bold text-white leading-tight line-clamp-2 mb-1">${nombreSeguro}</h5>
        <div class="pointer-events-auto">
          ${bloqueControl}
        </div>
      </div>
    </div>
  `;
}

function puyarProductoAgregar(id, event) {
  if (event && event.target && event.target.tagName === 'INPUT' && event.target.type === 'range') {
    return;
  }
  const item = mapaProductos[id];
  if (!item) return;

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('ring-2', 'ring-cyan-400', 'scale-95');
    setTimeout(() => {
      if (event.currentTarget) event.currentTarget.classList.remove('ring-2', 'ring-cyan-400', 'scale-95');
    }, 160);
  }

  if (item.esGranel) {
    agregarGranelAlCarrito(id);
  } else {
    agregarAlCarritoPorId(id, 1);
  }
}

function actualizarSliderGranel(id) {
  const item = mapaProductos[id];
  if (!item) return;
  const slider = document.getElementById(`slider-${id}`);
  if (!slider) return;
  const gramos = parseInt(slider.value) || item.defGranel || 500;
  const precioBase = parseFloat(item.precioBase) || 0;
  const sub = (precioBase * gramos) / 1000;
  
  const lbl = document.getElementById(`label-gramos-${id}`);
  const precioEl = document.getElementById(`precio-granel-${id}`);
  if (lbl) lbl.innerText = gramos >= 1000 ? `${(gramos/1000).toFixed(1)}kg` : `${gramos}g`;
  if (precioEl) precioEl.innerText = precioBase <= 0 ? 'Consultar' : `$${sub.toFixed(2)}`;
}

function agregarGranelAlCarrito(id) {
  const item = mapaProductos[id];
  if (!item) return;
  const slider = document.getElementById(`slider-${id}`);
  const gramos = slider ? (parseInt(slider.value) || item.defGranel || 500) : (item.defGranel || 500);
  const precioBase = parseFloat(item.precioBase) || 0;
  const sub = (precioBase * gramos) / 1000;
  const etiqueta = gramos >= 1000 ? `${(gramos/1000).toFixed(1)}kg` : `${gramos}g`;
  const idUnico = `${id}_${gramos}`;
  
  if (!carrito[idUnico]) {
    carrito[idUnico] = { 
      nombre: `${item.nombre} (${etiqueta})`, 
      precio: sub, 
      cantidad: 1, 
      esPersonalizado: precioBase <= 0,
      tiendaId: item.tiendaId || item.local 
    };
  } else {
    carrito[idUnico].cantidad += 1;
  }
  actualizarTotales();
  notificarPromoDelivery(`${item.nombre} (${etiqueta})`);
}

function agregarAlCarritoPorId(id, cantidad = 1) {
  const item = mapaProductos[id];
  if (!item) return;
  agregarAlCarritoDirecto(item.id, item.nombre, item.precioBase, cantidad, item.tiendaId || item.local);
  notificarPromoDelivery(item.nombre);
}

function agregarAlCarritoDirecto(id, nombre, precio, cantidad = 1, tiendaId = null) {
  let tNom = null;
  if (tiendaId && infoLocales[tiendaId]) {
    tNom = infoLocales[tiendaId].nombre;
  }
  const precioNum = parseFloat(precio) || 0;
  const esConsultar = precioNum <= 0;

  if (!carrito[id]) {
    carrito[id] = {
      nombre: esConsultar ? `${nombre} (Precio en tienda)` : nombre,
      precio: precioNum,
      cantidad,
      esPersonalizado: esConsultar,
      tiendaId: tiendaId || null,
      tiendaNombre: tNom
    };
  } else {
    carrito[id].cantidad += cantidad;
  }
  actualizarTotales();
}

function notificarPromoDelivery(nombreProd) {
  const { cant } = calcularTotal();
  if (cant > 20) {
    mostrarToast(`¡${nombreProd} agregado! 🎉 ¡Llevas ${cant} productos y tu DELIVERY ES GRATIS ($0.00)!`, "¡Promo Flash Activa!", "success");
  } else if (cant === 20) {
    mostrarToast(`¡${nombreProd} agregado! ⚡ Llevas 20 productos: ¡Compra más de 20 y el delivery es gratis! (¡Falta 1!)`, "¡A 1 paso!", "warning");
  } else {
    const faltan = 21 - cant;
    mostrarToast(`¡${nombreProd} agregado! 🎁 Delivery gratis con más de 20 productos (Llevas ${cant}/20, faltan ${faltan})`, "¡Promo Delivery Gratis!", "info");
  }
}

function cambiarCantCarrito(id, delta) {
  if (carrito[id]) {
    carrito[id].cantidad += delta;
    if (carrito[id].cantidad <= 0) delete carrito[id];
  }
  actualizarTotales();
  renderizarModalCarrito();
}

function calcularTotal() {
  let total = 0, cant = 0;
  Object.keys(carrito).forEach(id => {
    if (!carrito[id].esPersonalizado) total += carrito[id].cantidad * (carrito[id].precio || 0);
    cant += carrito[id].cantidad;
  });
  return { total, cant };
}

function actualizarTotales() {
  guardarRespaldoCarrito();
  const { total, cant } = calcularTotal();
  
  const badgeCant = document.getElementById('badge-nav-cant');
  const badgeMonto = document.getElementById('badge-nav-monto');
  if (badgeCant) badgeCant.innerText = cant;
  if (badgeMonto) badgeMonto.innerText = `$${total.toFixed(2)}`;

  const widgetCant = document.getElementById('txt-widget-cant');
  const widgetMonto = document.getElementById('txt-widget-monto');
  const widgetFlotante = document.getElementById('widget-total-flotante');
  
  if (widgetCant) widgetCant.innerText = cant;
  if (widgetMonto) widgetMonto.innerText = `$${total.toFixed(2)}`;
  
  const barraPromo = document.getElementById('barra-progreso-promo-20');
  const badgePromo = document.getElementById('badge-contador-promo-20');
  const txtPromo = document.getElementById('txt-estado-promo-20');
  
  if (barraPromo && badgePromo && txtPromo) {
    const pct = Math.min(100, Math.round((cant / 20) * 100));
    barraPromo.style.width = `${pct}%`;
    if (cant > 20) {
      badgePromo.innerHTML = `✓ ¡GRATIS! (${cant})`;
      badgePromo.className = "text-[10px] font-black font-mono bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full block animate-pulse";
      txtPromo.innerText = "Delivery $0.00 (Gratis)";
      txtPromo.className = "text-[9px] text-emerald-400 font-bold block mt-0.5";
    } else if (cant === 20) {
      badgePromo.innerText = "20/20";
      badgePromo.className = "text-[10px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full block";
      txtPromo.innerText = "¡Falta 1 para gratis!";
      txtPromo.className = "text-[9px] text-accent-yellow font-bold block mt-0.5";
    } else {
      badgePromo.innerText = `${cant}/20`;
      badgePromo.className = "text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full block";
      txtPromo.innerText = `Faltan ${20 - cant} prods`;
      txtPromo.className = "text-[9px] text-slate-400 block mt-0.5";
    }
  }

  if (widgetFlotante) {
    if (cant > 0) {
      widgetFlotante.classList.remove('opacity-0', 'pointer-events-none');
      widgetFlotante.classList.add('opacity-100', 'pointer-events-auto');
    } else {
      widgetFlotante.classList.add('opacity-0', 'pointer-events-none');
      cerrarModalCarrito();
    }
  }
}

function abrirModalCarrito() {
  if (calcularTotal().cant === 0) {
    mostrarToast("Tu canasta está vacía. Selecciona un producto.", "Canasta Vacía", "info");
    return;
  }
  renderizarModalCarrito();
  const modC = document.getElementById('modal-carrito-detalle');
  if (modC) modC.classList.remove('hidden');
}

function cerrarModalCarrito() {
  const modC = document.getElementById('modal-carrito-detalle');
  if (modC) modC.classList.add('hidden');
}

function renderizarModalCarrito() {
  const contenedor = document.getElementById('lista-modal-carrito');
  if (!contenedor) return;
  const { total, cant } = calcularTotal();
  const esDeliveryGratis = cant > 20;
  const costoDelivery = esDeliveryGratis ? 0.00 : 1.00;
  const totalConDelivery = total + costoDelivery;

  const totalEl = document.getElementById('modal-carrito-monto-total');
  if (totalEl) totalEl.innerText = `$${totalConDelivery.toFixed(2)}`;

  const avisoPromoModal = document.getElementById('modal-carrito-promo-aviso');
  if (avisoPromoModal) {
    if (esDeliveryGratis) {
      avisoPromoModal.className = "bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-2 text-center text-[10px] text-emerald-300 font-bold";
      avisoPromoModal.innerHTML = `🎉 ¡Llevas ${cant} productos! ¡Tu delivery es GRATIS ($0.00)!`;
    } else if (cant === 20) {
      avisoPromoModal.className = "bg-amber-950/80 border border-amber-500/50 rounded-xl p-2 text-center text-[10px] text-amber-300 font-bold";
      avisoPromoModal.innerHTML = `⚡ ¡Llevas 20 productos! Compra más de 20 y el delivery es gratis (¡Falta 1!)`;
    } else {
      const faltan = 21 - cant;
      avisoPromoModal.className = "bg-slate-950/90 border border-emerald-500/30 rounded-xl p-2 text-center text-[10px] text-emerald-400 font-medium";
      avisoPromoModal.innerHTML = `🎁 Compra más de 20 productos y el delivery es gratis (Llevas ${cant}/20, faltan ${faltan})`;
    }
  }

  contenedor.innerHTML = "";
  Object.keys(carrito).forEach(id => {
    const item = carrito[id];
    if (!item) return;
    const idJs = escaparJS(id);
    const nomSeguro = escaparHTML(item.nombre || 'Producto');
    const precioTxt = item.esPersonalizado 
      ? `<span class="text-[10px] text-accent-cyan font-bold block">A Pedido (Precio Variable)</span>` 
      : `<span class="text-xs text-accent-yellow font-black">$${((item.cantidad || 1) * (item.precio || 0)).toFixed(2)}</span>`;
    
    const esRestaurante = item.tiendaId && (item.tiendaId === 'moravos' || item.tiendaId === 'fran_chero' || item.tiendaId === 'antons' || item.tiendaId === 'zirus');
    const tiendaLabel = esRestaurante && item.tiendaNombre 
      ? `<span class="text-[9px] text-amber-400 font-bold block">🏪 ${escaparHTML(item.tiendaNombre)}</span>` 
      : `<span class="text-[9px] text-cyan-400 font-semibold block">⚡ Supermercado Flash</span>`;

    contenedor.innerHTML += `
      <div class="flex items-center justify-between bg-slate-950/85 p-3 rounded-2xl border border-slate-800">
        <div class="flex-1 pr-2">
          <h5 class="text-xs font-bold text-white line-clamp-1">${nomSeguro}</h5>
          ${tiendaLabel}
          ${precioTxt}
        </div>
        <div class="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button onclick="cambiarCantCarrito('${idJs}', -1)" type="button" class="btn-tactil w-7 h-7 bg-slate-800 text-white font-black rounded-lg text-xs flex items-center justify-center">-</button>
          <span class="text-xs font-black text-white w-5 text-center">${item.cantidad}</span>
          <button onclick="cambiarCantCarrito('${idJs}', 1)" type="button" class="btn-tactil w-7 h-7 bg-accent-magenta text-white font-black rounded-lg text-xs flex items-center justify-center">+</button>
        </div>
      </div>
    `;
  });
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

// ================= SINCRONIZACIÓN FIREBASE BLINDADA =================
function sincronizarCatalogoFlashDesdeFirebase() {
  if (!firebaseActivo || !db) return;

  const sincronizarNodo = (nodo) => {
    db.ref(nodo).on('value', (snapshot) => {
      try {
        const val = snapshot.val();
        if (!val || typeof val !== 'object' || Object.keys(val).length === 0) return;

        let cambio = false;
        Object.keys(val).forEach(id => {
          const itemFB = val[id];
          if (!itemFB || typeof itemFB !== 'object') return;

          const nuevoPrecio = parseFloat(itemFB.precioBase);
          if (mapaProductos[id]) {
            if (!isNaN(nuevoPrecio) && nuevoPrecio >= 0 && mapaProductos[id].precioBase !== nuevoPrecio) {
              mapaProductos[id].precioBase = nuevoPrecio;
              cambio = true;
            }
            if (itemFB.nombre && mapaProductos[id].nombre !== itemFB.nombre) {
              mapaProductos[id].nombre = itemFB.nombre;
              cambio = true;
            }
          } else if (itemFB.nombre) {
            const cat = itemFB.categoria || 'viveres';
            if (!window.productos) window.productos = {};
            if (!window.productos[cat]) window.productos[cat] = [];
            itemFB.id = id;
            itemFB.precioBase = !isNaN(nuevoPrecio) ? nuevoPrecio : 0;
            window.productos[cat].push(itemFB);
            mapaProductos[id] = itemFB;
            cambio = true;
          }
        });

        if (cambio) renderizarCatalogo();
      } catch (err) {
        console.warn(`Error en ${nodo}:`, err);
      }
    });
  };

  sincronizarNodo('catalogo_flash');
  sincronizarNodo('catalogo_productos');
}

function sincronizarTiendasDesdeFirebase() {
  if (!firebaseActivo || !db) return;
  db.ref('tiendas').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      Object.keys(val).forEach(k => { infoLocales[k] = val[k]; });
      renderizarLocalesComerciales();
    }
  });

  db.ref('productos_tiendas').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      productosDinamicosTiendas = val;
      reconstruirMapaProductos();
    }
  });
}

function sincronizarTarifasTransporteDesdeFirebase() {
  if (!firebaseActivo || !db) return;
  db.ref('configuracion_tarifas_transporte').on('value', (snap) => {
    const t = snap.val();
    if (t) {
      if (t.moto_corta !== undefined) tarifasTransporte.moto_corta = parseFloat(t.moto_corta);
      if (t.moto_media !== undefined) tarifasTransporte.moto_media = parseFloat(t.moto_media);
      if (t.moto_salon !== undefined) tarifasTransporte.moto_salon = parseFloat(t.moto_salon);
      if (t.carro_corto !== undefined) tarifasTransporte.carro_corto = parseFloat(t.carro_corto);
      if (t.carro_salon !== undefined) tarifasTransporte.carro_salon = parseFloat(t.carro_salon);
      actualizarUIPreciosTransporte();
    }
  });
}

function formatearBs(montoUsd) {
  if (!tasaBCVActual || tasaBCVActual <= 0) return '';
  return `Bs. ${(montoUsd * tasaBCVActual).toFixed(2)}`;
}

function actualizarUIPreciosTransporte() {
  Object.keys(tarifasTransporte).forEach(clave => {
    const val = parseFloat(tarifasTransporte[clave]) || 0;
    const elUsd = document.getElementById(`val-${clave}`);
    const elBs = document.getElementById(`bs-${clave}`);
    if (elUsd) elUsd.innerText = `$${val.toFixed(2)}`;
    if (elBs) elBs.innerText = formatearBs(val);
  });

  const baseMoto = document.getElementById('lbl-precio-base-moto');
  const baseCarro = document.getElementById('lbl-precio-base-carro');
  if (baseMoto) baseMoto.innerText = `Desde $${tarifasTransporte.moto_corta.toFixed(2)}`;
  if (baseCarro) baseCarro.innerText = `Desde $${tarifasTransporte.carro_corto.toFixed(2)}`;

  const badgeTasa = document.getElementById('badge-tasa-bcv-transporte');
  if (badgeTasa && tasaBCVActual > 0) {
    badgeTasa.innerText = `BCV: Bs. ${tasaBCVActual.toFixed(2)}`;
  }

  precioTransporte = parseFloat(tarifasTransporte[claveTarifaSeleccionada]) || 1.00;
  const btnViaje = document.getElementById('txt-precio-btn-viaje');
  if (btnViaje) {
    const txtBs = tasaBCVActual > 0 ? ` • ${formatearBs(precioTransporte)}` : '';
    btnViaje.innerText = `$${precioTransporte.toFixed(2)}${txtBs}`;
  }
}

function seleccionarCategoriaVehiculo(categoria) {
  tipoTransporteSeleccionado = categoria;
  const btnMoto = document.getElementById('btn-cat-moto');
  const btnCarro = document.getElementById('btn-cat-carro');
  const boxMoto = document.getElementById('opciones-tarifa-moto');
  const boxCarro = document.getElementById('opciones-tarifa-carro');

  if (categoria === 'moto') {
    if (btnMoto) btnMoto.className = "btn-tactil p-2.5 rounded-2xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-cyan transition relative";
    if (btnCarro) btnCarro.className = "btn-tactil p-2.5 rounded-2xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition relative";
    if (boxMoto) boxMoto.classList.remove('hidden');
    if (boxCarro) boxCarro.classList.add('hidden');
    seleccionarTarifaEspecifica('moto', 'moto_corta', 'Moto Corta / Urbana');
  } else {
    if (btnCarro) btnCarro.className = "btn-tactil p-2.5 rounded-2xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-cyan transition relative";
    if (btnMoto) btnMoto.className = "btn-tactil p-2.5 rounded-2xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition relative";
    if (boxCarro) boxCarro.classList.remove('hidden');
    if (boxMoto) boxMoto.classList.add('hidden');
    seleccionarTarifaEspecifica('carro', 'carro_corto', 'Carro Corto / Estándar');
  }
}

function seleccionarTarifaEspecifica(vehiculo, clave, etiquetaClase) {
  tipoTransporteSeleccionado = vehiculo;
  claveTarifaSeleccionada = clave;
  claseCarreraSeleccionada = etiquetaClase;
  precioTransporte = parseFloat(tarifasTransporte[clave]) || 1.00;

  document.querySelectorAll('.btn-tarifa-unidad').forEach(btn => {
    btn.className = "btn-tarifa-unidad btn-tactil p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 text-center flex flex-col items-center justify-center gap-0.5";
  });

  const btnSel = document.getElementById(`btn-tarifa-${clave}`);
  if (btnSel) {
    btnSel.className = "btn-tarifa-unidad btn-tactil p-2 rounded-xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-center flex flex-col items-center justify-center gap-0.5 shadow-glow-cyan";
  }

  actualizarUIPreciosTransporte();
}

// INICIALIZACIÓN
function guardarRespaldoCarrito() {
  try { localStorage.setItem('pedidosflash_carrito_backup', JSON.stringify(carrito)); } catch(e){}
}
function restaurarRespaldoCarrito() {
  try {
    const s = localStorage.getItem('pedidosflash_carrito_backup');
    if (s) {
      const p = JSON.parse(s);
      if (p && typeof p === 'object' && Object.keys(p).length > 0) {
        carrito = p;
        actualizarTotales();
      }
    }
  } catch(e){}
}

window.addEventListener('DOMContentLoaded', () => {
  restaurarRespaldoCarrito();
  renderizarCatalogo();
  sincronizarTiendasDesdeFirebase();
  sincronizarCatalogoFlashDesdeFirebase();
  sincronizarTarifasTransporteDesdeFirebase();
  actualizarUIPreciosTransporte();
});

// ==========================================================================
// MÓDULOS DE AUTENTICACIÓN, PEDIDOS, MAPAS, OCR Y MODALES (APP.JS PARTE 2)
// ==========================================================================

// --- AUTENTICACIÓN Y SESIÓN ---
function iniciarFlujoAuth() {
  const authScreen = document.getElementById('pantalla-auth');
  if (authScreen) {
    authScreen.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    authScreen.classList.add('opacity-100', 'pointer-events-auto');
  }
  const vidAuth = document.getElementById('video-bg-auth');
  if (vidAuth) {
    vidAuth.muted = true;
    vidAuth.play().catch(() => {});
  }
}

function cambiarTabAuth(tab) {
  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-registro');
  const formLogin = document.getElementById('form-auth-login');
  const formReg = document.getElementById('form-auth-registro');

  if (tab === 'login') {
    if (tabLogin) tabLogin.className = "btn-tactil py-2 text-xs font-black rounded-xl bg-gradient-to-r from-accent-cyan to-brand-600 text-slate-950 shadow-md transition";
    if (tabReg) tabReg.className = "btn-tactil py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition";
    if (formLogin) formLogin.classList.remove('hidden');
    if (formReg) formReg.classList.add('hidden');
  } else {
    if (tabReg) tabReg.className = "btn-tactil py-2 text-xs font-black rounded-xl bg-gradient-to-r from-accent-magenta to-pink-600 text-white shadow-md transition";
    if (tabLogin) tabLogin.className = "btn-tactil py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition";
    if (formReg) formReg.classList.remove('hidden');
    if (formLogin) formLogin.classList.add('hidden');
  }
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function saltarAuthComoInvitado() {
  const authScreen = document.getElementById('pantalla-auth');
  if (authScreen) {
    authScreen.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => authScreen.classList.add('hidden'), 400);
  }
  mostrarToast("Navegando como Invitado", "Bienvenido", "info");
}

async function ejecutarLogin(e) {
  if (e) e.preventDefault();
  const telRaw = document.getElementById('auth-login-tel').value.trim();
  const pin = document.getElementById('auth-login-pin').value.trim();
  const telLimpio = limpiarTelefonoId(telRaw);

  if (!telLimpio || pin.length !== 4) {
    mostrarToast("Ingresa tu teléfono y PIN de 4 dígitos", "Datos incompletos", "error");
    return;
  }

  const btn = document.getElementById('btn-submit-login');
  const textoOrig = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Verificando...`;
  }

  try {
    if (firebaseActivo && db) {
      const snap = await db.ref(`usuarios_clientes/${telLimpio}`).once('value');
      const user = snap.val();
      if (!user) {
        mostrarToast("Usuario no encontrado. Crea tu cuenta", "No registrado", "error");
        cambiarTabAuth('registro');
        document.getElementById('auth-reg-tel').value = telRaw;
        return;
      }
      if (user.pin && user.pin !== pin) {
        mostrarToast("PIN incorrecto. Intenta nuevamente.", "Error de clave", "error");
        return;
      }
      guardarYAplicarSesion(user);
      mostrarToast(`¡Bienvenido de nuevo, ${user.nombre || 'Cliente'}!`, "Sesión Iniciada", "success");
    } else {
      const usuarioLocal = { telefono: telLimpio, telefonoOriginal: telRaw, nombre: "Cliente Flash", direccion: "Nirgua", pin };
      guardarYAplicarSesion(usuarioLocal);
    }
  } catch (err) {
    console.error("Error login:", err);
    const local = JSON.parse(localStorage.getItem('pedidosflash_usuario') || 'null');
    if (local && local.telefono === telLimpio && local.pin === pin) {
      guardarYAplicarSesion(local);
    } else {
      mostrarToast("Error de conexión al verificar usuario", "Error", "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = textoOrig;
    }
  }
}

async function ejecutarRegistro(e) {
  if (e) e.preventDefault();
  const nombre = document.getElementById('auth-reg-nombre').value.trim();
  const telRaw = document.getElementById('auth-reg-tel').value.trim();
  const direccion = document.getElementById('auth-reg-direccion').value.trim();
  const pin = document.getElementById('auth-reg-pin').value.trim();
  const telLimpio = limpiarTelefonoId(telRaw);

  if (!nombre || !telLimpio || pin.length !== 4) {
    mostrarToast("Completa tu nombre, teléfono y PIN de 4 dígitos", "Datos incompletos", "error");
    return;
  }

  const btn = document.getElementById('btn-submit-reg');
  const textoOrig = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Registrando...`;
  }

  const nuevoUsuario = {
    telefono: telLimpio,
    telefonoOriginal: telRaw,
    nombre,
    direccion: direccion || '',
    pin,
    fechaRegistro: new Date().toISOString()
  };

  try {
    if (firebaseActivo && db) {
      await db.ref(`usuarios_clientes/${telLimpio}`).set(nuevoUsuario);
    }
    guardarYAplicarSesion(nuevoUsuario);
    mostrarToast(`¡Bienvenido a Pedidos Flash, ${nombre}!`, "Cuenta Creada", "success");
  } catch (err) {
    guardarYAplicarSesion(nuevoUsuario);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = textoOrig;
    }
  }
}

function guardarYAplicarSesion(user) {
  localStorage.setItem('pedidosflash_usuario', JSON.stringify(user));
  aplicarSesionUsuario(user);
  const authScreen = document.getElementById('pantalla-auth');
  if (authScreen) {
    authScreen.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => authScreen.classList.add('hidden'), 400);
  }
}

function aplicarSesionUsuario(user) {
  if (!user) return;
  usuarioActivo = user;
  const txtNombre = document.getElementById('txt-header-nombre-usuario');
  if (txtNombre) txtNombre.innerText = user.nombre || user.telefono || 'Cliente';

  const inpNombre = document.getElementById('nombreCliente');
  const inpTel = document.getElementById('telefonoCliente');
  const inpDir = document.getElementById('direccion');
  if (inpNombre && !inpNombre.value) inpNombre.value = user.nombre || '';
  if (inpTel && !inpTel.value) inpTel.value = user.telefonoOriginal || user.telefono || '';
  if (inpDir && !inpDir.value) inpDir.value = user.direccion || '';

  const authScreen = document.getElementById('pantalla-auth');
  if (authScreen) authScreen.classList.add('hidden', 'opacity-0', 'pointer-events-none');
}

function cerrarSesionUsuario() {
  localStorage.removeItem('pedidosflash_usuario');
  usuarioActivo = null;
  const txtNombre = document.getElementById('txt-header-nombre-usuario');
  if (txtNombre) txtNombre.innerText = 'Invitado';
  ['nombreCliente', 'telefonoCliente', 'direccion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  iniciarFlujoAuth();
  mostrarToast("Has cerrado sesión", "Sesión Finalizada", "info");
}

function abrirModalPoliticasPrivacidad() {
  const modal = document.getElementById('modal-politicas-privacidad-cliente');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  }
}

function cerrarModalPoliticasPrivacidad() {
  const modal = document.getElementById('modal-politicas-privacidad-cliente');
  if (modal) modal.classList.add('hidden');
}

// --- NAVEGACIÓN Y VISTAS ---
function cambiarSeccion(seccion) {
  document.getElementById('menu-principal-servicios').classList.add('hidden');
  document.getElementById('contenedor-seccion-activa').classList.remove('hidden');
  document.querySelectorAll('.seccion-target').forEach(el => el.classList.add('hidden'));
  
  const secDestino = document.getElementById(`sec-${seccion}`);
  if (secDestino) secDestino.classList.remove('hidden');

  if (seccion === 'transporte') {
    setTimeout(() => {
      if (!mapaRuta) {
        if (!window.L) return;
        mapaRuta = L.map('mapa-interactivo-ruta', { zoomControl: true, attributionControl: false }).setView(puntoOrigen, 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapaRuta);

        mapaRuta.on('click', (e) => {
          puntoDestino = [e.latlng.lat, e.latlng.lng];
          textoDestinoStr = `Punto en Mapa (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`;
          const inpDest = document.getElementById('inputBuscadorDestino');
          if (inpDest) inpDest.value = textoDestinoStr;
          const instEl = document.getElementById('instruccion-mapa');
          if (instEl) instEl.innerText = "✨ ¡Destino marcado!";

          if (window.marcadorDestRef) mapaRuta.removeLayer(window.marcadorDestRef);
          window.marcadorDestRef = L.marker(puntoDestino, {
            icon: L.divIcon({ 
              className: 'custom-pin',
              html: '<div style="background:linear-gradient(135deg, #ff007a, #d946ef); width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 16px #ff007a;"><i data-lucide="flag" style="width:16px; height:16px; color:#ffffff;"></i></div>', 
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })
          }).addTo(mapaRuta).bindPopup(`🏁 ${textoDestinoStr}`).openPopup();
          if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
          trazarLineaRuta();
          mostrarToast("Destino fijado en el mapa", "Ruta Lista", "success");
        });

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            puntoOrigen = [pos.coords.latitude, pos.coords.longitude];
            mapaRuta.setView(puntoOrigen, 15);
            actualizarMarcadorOrigen();
          }, () => { actualizarMarcadorOrigen(); });
        } else {
          actualizarMarcadorOrigen();
        }
      } else {
        mapaRuta.invalidateSize();
      }
    }, 200);
  }
}

function actualizarMarcadorOrigen() {
  if (!mapaRuta || !window.L) return;
  if (window.marcadorOrigRef) mapaRuta.removeLayer(window.marcadorOrigRef);
  window.marcadorOrigRef = L.marker(puntoOrigen, {
    icon: L.divIcon({ 
      className: 'custom-pin',
      html: `<div class="pin-persona-cliente">
               <div class="pin-persona-onda" style="border-color:#00e676; background:rgba(0,230,118,0.25);"></div>
               <div class="pin-persona-cuerpo" style="background: linear-gradient(135deg, #00e676, #059669);">
                 <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
               </div>
               <span class="pin-persona-badge-tu" style="border-color:#00e676; color:#00e676;">TÚ</span>
             </div>`, 
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    })
  }).addTo(mapaRuta).bindPopup('👤 Tu Ubicación (Origen)').openPopup();
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function usarGpsActualComoOrigen() {
  if (!navigator.geolocation) {
    mostrarToast("Geolocalización no soportada", "Aviso", "error");
    return;
  }
  const lblBtn = document.getElementById('lbl-transporte-gps-rapido');
  if (lblBtn) lblBtn.innerText = "Conectando al GPS...";
  
  navigator.geolocation.getCurrentPosition((pos) => {
    puntoOrigen = [pos.coords.latitude, pos.coords.longitude];
    textoOrigenStr = "📍 Mi Ubicación Actual (GPS)";
    const inpOrig = document.getElementById('inputBuscadorOrigen');
    if (inpOrig) inpOrig.value = "📍 Mi Ubicación Actual";
    if (lblBtn) lblBtn.innerText = "✓ GPS Actual";
    actualizarMarcadorOrigen();
    if (mapaRuta) mapaRuta.setView(puntoOrigen, 16);
    if (puntoDestino) trazarLineaRuta();
    const instEl = document.getElementById('instruccion-mapa');
    if (instEl) instEl.innerText = "🏁 Destino o toca en el mapa";
    mostrarToast("📍 Origen fijado por GPS con éxito", "Ubicación Lista", "success");
  }, () => {
    if (lblBtn) lblBtn.innerText = "Mi GPS";
    mostrarToast("No se pudo obtener el GPS", "Error", "error");
  });
}

function fijarDestinoRapido(nombre) {
  const inp = document.getElementById('inputBuscadorDestino');
  if (inp) inp.value = nombre;
  buscarPuntoDestinoPorTexto();
}

function buscarPuntoOrigenPorTexto() {
  const inp = document.getElementById('inputBuscadorOrigen');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto) return;
  textoOrigenStr = texto;
  buscarUbicacionNirguaPrecisa(texto, (lat, lon) => {
    puntoOrigen = [lat, lon];
    actualizarMarcadorOrigen();
    if (mapaRuta) mapaRuta.setView(puntoOrigen, 16);
    if (puntoDestino) trazarLineaRuta();
  });
}

function buscarPuntoDestinoPorTexto() {
  const inp = document.getElementById('inputBuscadorDestino');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto) return;
  textoDestinoStr = texto;
  const instEl = document.getElementById('instruccion-mapa');
  if (instEl) instEl.innerText = "✨ ¡Destino fijado con éxito!";
  buscarUbicacionNirguaPrecisa(texto, (lat, lon) => {
    puntoDestino = [lat, lon];
    if (window.marcadorDestRef && mapaRuta) mapaRuta.removeLayer(window.marcadorDestRef);
    if (mapaRuta && window.L) {
      window.marcadorDestRef = L.marker(puntoDestino, {
        icon: L.divIcon({ 
          className: 'custom-pin',
          html: '<div style="background:linear-gradient(135deg, #ff007a, #d946ef); width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 16px #ff007a;"><i data-lucide="flag" style="width:16px; height:16px; color:#ffffff;"></i></div>', 
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(mapaRuta).bindPopup(`🏁 ${texto}`).openPopup();
      if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
      mapaRuta.setView(puntoDestino, 16);
    }
    trazarLineaRuta();
  });
}

function buscarUbicacionNirguaPrecisa(textoBusqueda, callbackExito) {
  const query = `${textoBusqueda}, Nirgua, Yaracuy, Venezuela`;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        callbackExito(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        callbackExito(10.1500, -68.5667);
      }
    })
    .catch(() => callbackExito(10.1500, -68.5667));
}

function trazarLineaRuta() {
  if (!puntoDestino || !puntoOrigen || !mapaRuta || !window.L) return;
  if (lineaTrayecto) mapaRuta.removeLayer(lineaTrayecto);
  fetch(`https://router.project-osrm.org/route/v1/driving/${puntoOrigen[1]},${puntoOrigen[0]};${puntoDestino[1]},${puntoDestino[0]}?overview=full&geometries=geojson`)
    .then(res => res.json())
    .then(data => {
      if (data.routes && data.routes.length > 0) {
        const latLngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        lineaTrayecto = L.polyline(latLngs, { color: '#00f2fe', weight: 5, opacity: 0.9 }).addTo(mapaRuta);
        mapaRuta.fitBounds(lineaTrayecto.getBounds(), { padding: [30, 30] });

        const distKm = (data.routes[0].distance / 1000).toFixed(1);
        const durMin = Math.max(1, Math.round(data.routes[0].duration / 60));
        const distEl = document.getElementById('lbl-hud-distancia');
        const durEl = document.getElementById('lbl-hud-tiempo');
        if (distEl) distEl.innerText = `${distKm} km • Ruta trazada`;
        if (durEl) durEl.innerText = `~${durMin} min aprox`;
      } else {
        trazarLineaDirecta();
      }
    }).catch(() => trazarLineaDirecta());
}

function trazarLineaDirecta() {
  if (!mapaRuta || !window.L) return;
  if (lineaTrayecto) mapaRuta.removeLayer(lineaTrayecto);
  lineaTrayecto = L.polyline([puntoOrigen, puntoDestino], { color: '#00f2fe', weight: 4, dashArray: '6, 8', opacity: 0.85 }).addTo(mapaRuta);
  mapaRuta.fitBounds(lineaTrayecto.getBounds(), { padding: [30, 30] });
}

function reiniciarPuntosRuta() {
  puntoDestino = null;
  textoDestinoStr = "No seleccionado";
  const inpO = document.getElementById('inputBuscadorOrigen');
  const inpD = document.getElementById('inputBuscadorDestino');
  const inst = document.getElementById('instruccion-mapa');
  if (inpO) inpO.value = "";
  if (inpD) inpD.value = "";
  if (inst) inst.innerText = "📍 Toca mapa o escribe";
  const distEl = document.getElementById('lbl-hud-distancia');
  const durEl = document.getElementById('lbl-hud-tiempo');
  if (distEl) distEl.innerText = "Toca mapa para fijar ruta";
  if (durEl) durEl.innerText = "~3 min";
  if (window.marcadorDestRef && mapaRuta) mapaRuta.removeLayer(window.marcadorDestRef);
  if (lineaTrayecto && mapaRuta) mapaRuta.removeLayer(lineaTrayecto);
  mostrarToast("Puntos de ruta reiniciados", "Mapa", "info");
}

function volverAlMenuPrincipal() {
  const inpB = document.getElementById('inputBusqueda');
  if (inpB) inpB.value = "";
  const secAct = document.getElementById('contenedor-seccion-activa');
  const menuPrin = document.getElementById('menu-principal-servicios');
  if (secAct) secAct.classList.add('hidden');
  if (menuPrin) menuPrin.classList.remove('hidden');
  document.querySelectorAll('.item-producto').forEach(card => card.style.display = "flex");
}

function filtrarProductos() {
  const inpB = document.getElementById('inputBusqueda');
  if (!inpB) return;
  const q = inpB.value.toLowerCase().trim();
  if (q === "") {
    volverAlMenuPrincipal();
    return;
  }
  document.getElementById('menu-principal-servicios').classList.add('hidden');
  document.getElementById('contenedor-seccion-activa').classList.remove('hidden');
  document.querySelectorAll('.seccion-target').forEach(el => {
    if (el.id !== 'sec-transporte') el.classList.remove('hidden');
  });
  document.querySelectorAll('.item-producto').forEach(card => {
    const nom = card.getAttribute('data-nombre') || '';
    card.style.display = nom.includes(q) ? "flex" : "none";
  });
}

function filtrarSubViveres(subTipo) {
  document.querySelectorAll('.btn-sub-viveres').forEach(btn => {
    btn.classList.remove('bg-accent-magenta', 'text-white', 'border-accent-magenta/50', 'font-black');
    btn.classList.add('bg-slate-950/80', 'text-slate-300', 'border-slate-800', 'font-bold');
  });
  const btnSel = document.getElementById(`sub-viveres-${subTipo}`);
  if (btnSel) {
    btnSel.classList.remove('bg-slate-950/80', 'text-slate-300', 'border-slate-800', 'font-bold');
    btnSel.classList.add('bg-accent-magenta', 'text-white', 'border-accent-magenta/50', 'font-black');
  }
  document.querySelectorAll('#grid-viveres .item-producto').forEach(item => {
    const subItem = item.getAttribute('data-sub');
    item.style.display = (subTipo === 'todos' || subItem === subTipo) ? "flex" : "none";
  });
}

// --- CHECKOUT Y PASO 2 ---
function irAPaso2() {
  if (calcularTotal().cant === 0) {
    mostrarToast("Agrega al menos un artículo para continuar.", "Canasta Vacía", "info");
    return;
  }
  esPagoTransporteDirecto = false;
  document.getElementById('titulo-paso-2').innerText = "Finalizar Pedido";
  document.getElementById('titulo-resumen-paso2').innerText = "Artículos en Canasta";
  prepararPaso2Datos();
  if (!clienteLatActual) {
    obtenerUbicacionGPS(true);
  }
}

function irAPagarTransporteDirecto() {
  if (!puntoDestino) {
    mostrarToast("Toca el mapa o escribe a dónde vas.", "Destino Requerido", "info");
    return;
  }
  esPagoTransporteDirecto = true;
  clienteLatActual = puntoDestino[0];
  clienteLngActual = puntoDestino[1];
  document.getElementById('titulo-paso-2').innerText = "Solicitud de Transporte";
  document.getElementById('titulo-resumen-paso2').innerText = "Detalle del Viaje";
  if (textoDestinoStr && textoDestinoStr !== "No seleccionado") {
    document.getElementById('direccion').value = textoDestinoStr;
  }
  prepararPaso2Datos();
}

function prepararPaso2Datos() {
  const listaResumen = document.getElementById('resumen-lista-paso2');
  if (!listaResumen) return;
  listaResumen.innerHTML = "";

  if (esPagoTransporteDirecto) {
    const nombreServicio = `Transporte: ${claseCarreraSeleccionada}`;
    const txtBsResumen = tasaBCVActual > 0 ? ` (${formatearBs(precioTransporte)})` : '';
    listaResumen.innerHTML += `<div class="flex justify-between items-center"><span class="text-slate-200">1x ${escaparHTML(nombreServicio)}</span><span class="text-accent-yellow font-black">$${precioTransporte.toFixed(2)}${txtBsResumen}</span></div>`;
    document.getElementById('total-precio-resumen').innerText = `$${precioTransporte.toFixed(2)}${txtBsResumen}`;
  } else {
    const { total, cant } = calcularTotal();
    const esDeliveryGratis = cant > 20;
    const costoDelivery = esDeliveryGratis ? 0.00 : 1.00;
    const totalFinal = total + costoDelivery;

    Object.keys(carrito).forEach(id => {
      const item = carrito[id];
      if (!item) return;
      const precioTxt = item.esPersonalizado ? `<span class="text-accent-cyan font-bold">Variable</span>` : `<span class="text-accent-yellow font-black">$${((item.cantidad || 1) * (item.precio || 0)).toFixed(2)}</span>`;
      listaResumen.innerHTML += `<div class="flex justify-between items-center"><span class="text-slate-200">${item.cantidad}x ${escaparHTML(item.nombre)}</span>${precioTxt}</div>`;
    });

    listaResumen.innerHTML += `
      <div class="pt-2 border-t border-slate-800/80 flex justify-between items-center">
        <span class="text-slate-300 text-xs font-semibold">🛵 Tarifa de Delivery Nirgua:</span>
        <span class="${esDeliveryGratis ? 'text-emerald-400 font-black' : 'text-slate-300 font-bold'} text-xs">
          ${esDeliveryGratis ? '¡GRATIS! ($0.00)' : '$1.00'}
        </span>
      </div>
    `;

    document.getElementById('total-precio-resumen').innerText = `$${totalFinal.toFixed(2)}`;
  }

  if (usuarioActivo) {
    if (usuarioActivo.nombre && !document.getElementById('nombreCliente').value) {
      document.getElementById('nombreCliente').value = usuarioActivo.nombre;
    }
    if (usuarioActivo.telefono && !document.getElementById('telefonoCliente').value) {
      document.getElementById('telefonoCliente').value = usuarioActivo.telefono;
    }
    if (usuarioActivo.direccion && !document.getElementById('direccion').value) {
      document.getElementById('direccion').value = usuarioActivo.direccion;
    }
  }

  document.getElementById('paso-catalogo').classList.add('hidden');
  document.getElementById('paso-datos').classList.remove('hidden');
}

function volverAPaso1() {
  document.getElementById('paso-datos').classList.add('hidden');
  document.getElementById('paso-catalogo').classList.remove('hidden');
}

function seleccionarMetodoPago(metodo) {
  const btnMovil = document.getElementById('btn-pago-movil');
  const btnEfec = document.getElementById('btn-pago-efectivo');
  const btnDiv = document.getElementById('btn-pago-divisas');

  const cajaMovil = document.getElementById('caja-pago-movil');
  const cajaEfec = document.getElementById('caja-pago-efectivo');
  const cajaDiv = document.getElementById('caja-pago-divisas');

  [btnMovil, btnEfec, btnDiv].forEach(b => {
    if (b) b.className = "btn-tactil p-2.5 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold flex flex-col items-center justify-center gap-1";
  });
  [cajaMovil, cajaEfec, cajaDiv].forEach(c => { if (c) c.classList.add('hidden'); });

  if (metodo === 'pago_movil') {
    if (btnMovil) btnMovil.className = "btn-tactil p-2.5 rounded-xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-cyan";
    if (cajaMovil) cajaMovil.classList.remove('hidden');
    metodoPagoActual = 'Pago Móvil';
  } else if (metodo === 'efectivo') {
    if (btnEfec) btnEfec.className = "btn-tactil p-2.5 rounded-xl border-2 border-accent-yellow bg-accent-yellow/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-yellow";
    if (cajaEfec) cajaEfec.classList.remove('hidden');
    metodoPagoActual = 'Efectivo';
  } else {
    if (btnDiv) btnDiv.className = "btn-tactil p-2.5 rounded-xl border-2 border-accent-emerald bg-accent-emerald/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-emerald";
    if (cajaDiv) cajaDiv.classList.remove('hidden');
    metodoPagoActual = 'Zelle / Divisas';
  }
  const inpMet = document.getElementById('metodoPagoElegido');
  if (inpMet) inpMet.value = `${metodoPagoActual} (Al Recibir)`;
}

function fijarMontoPaga(monto) {
  const el = document.getElementById('montoPagaCliente');
  if (el) el.value = monto;
  mostrarToast(`Pagas con: ${monto}`, "Vuelto", "info");
}

function copiarDatosPagoMovil() {
  const datos = "Banesco (0134) - 04262566854 - V-28123456";
  navigator.clipboard.writeText(datos).then(() => {
    mostrarToast("Datos de Pago Móvil copiados", "Copiado", "success");
  });
}

function seleccionarBeneficiario(tipo) {
  const btnMio = document.getElementById('btn-beneficiario-mio');
  const btnTercero = document.getElementById('btn-beneficiario-tercero');
  const contenedorTercero = document.getElementById('contenedor-tercero');
  const inputTipo = document.getElementById('tipoBeneficiario');

  if (tipo === 'mio') {
    if (btnMio) btnMio.className = "btn-tactil p-2 rounded-xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black";
    if (btnTercero) btnTercero.className = "btn-tactil p-2 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold";
    if (contenedorTercero) contenedorTercero.classList.add('hidden');
    if (inputTipo) inputTipo.value = "Es para mí";
  } else {
    if (btnTercero) btnTercero.className = "btn-tactil p-2 rounded-xl border-2 border-accent-magenta bg-accent-magenta/20 text-white text-xs font-black";
    if (btnMio) btnMio.className = "btn-tactil p-2 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold";
    if (contenedorTercero) contenedorTercero.classList.remove('hidden');
    if (inputTipo) inputTipo.value = "Es para otra persona";
  }
}

function obtenerUbicacionGPS(silencioso = false) {
  const btnGps = document.getElementById('btn-gps');
  const lblGps = document.getElementById('lbl-gps');
  if (!navigator.geolocation) {
    if (!silencioso) mostrarToast("Navegador sin geolocalización", "Error", "error");
    return;
  }
  if (lblGps) lblGps.innerText = "Conectando al satélite GPS...";
  if (btnGps) btnGps.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      clienteLatActual = pos.coords.latitude;
      clienteLngActual = pos.coords.longitude;
      const urlMaps = `https://maps.google.com/?q=${clienteLatActual},${clienteLngActual}`;
      
      const inputGps = document.getElementById('ubicacionGPS');
      if (inputGps) inputGps.value = urlMaps;
      const latInput = document.getElementById('latGPS');
      if (latInput) latInput.value = clienteLatActual;
      const lngInput = document.getElementById('lngGPS');
      if (lngInput) lngInput.value = clienteLngActual;

      if (lblGps) lblGps.innerHTML = `📍 Ubicación GPS detectada con éxito`;
      if (btnGps) {
        btnGps.disabled = false;
        btnGps.className = "btn-tactil w-full bg-emerald-950/80 text-accent-emerald border-2 border-emerald-500/60 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-glow-emerald";
      }
      if (!silencioso) mostrarToast("📍 Ubicación GPS detectada con éxito", "GPS Listo", "success");
    },
    (err) => {
      if (lblGps) lblGps.innerText = "Tocar para adjuntar GPS en vivo";
      if (btnGps) btnGps.disabled = false;
      if (!silencioso) mostrarToast("Activa los permisos GPS de tu teléfono", "Aviso GPS", "info");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function enviarPedidoAConductor() {
  const nombre = document.getElementById('nombreCliente').value.trim();
  const telefono = document.getElementById('telefonoCliente').value.trim();
  const direccion = document.getElementById('direccion').value.trim();
  const tipoBeneficiario = document.getElementById('tipoBeneficiario').value;
  const nombreTercero = document.getElementById('nombreTercero').value.trim();
  const ubicacionGPS = document.getElementById('ubicacionGPS').value;
  const montoPaga = document.getElementById('montoPagaCliente').value.trim();

  if (!nombre || !telefono) {
    mostrarToast("Por favor completa tu Nombre y Teléfono.", "Campos Requeridos", "error");
    return;
  }
  if (!esPagoTransporteDirecto && !direccion) {
    mostrarToast("Por favor ingresa la dirección de entrega.", "Dirección Requerida", "error");
    return;
  }

  const numOrden = `FLASH-${Math.floor(1000 + Math.random() * 9000)}`;
  const { total: totalProductos, cant: cantProductos } = calcularTotal();
  const esDeliveryGratis = !esPagoTransporteDirecto && (cantProductos > 20);
  const costoDelivery = esPagoTransporteDirecto ? 0.00 : (esDeliveryGratis ? 0.00 : 1.00);
  const montoTotalCalculado = esPagoTransporteDirecto ? precioTransporte : (totalProductos + costoDelivery);

  const listaItemsArray = [];
  let tiendaDetectadaId = null;
  let tiendaDetectadaNombre = null;

  if (!esPagoTransporteDirecto) {
    Object.keys(carrito).forEach(id => {
      const it = carrito[id];
      listaItemsArray.push({
        id: id,
        nombre: it.nombre,
        precio: it.precio || 0,
        cantidad: it.cantidad,
        esPersonalizado: it.esPersonalizado || false,
        tiendaId: it.tiendaId || null,
        tiendaNombre: it.tiendaNombre || null
      });

      if (it.tiendaId && !tiendaDetectadaId) {
        tiendaDetectadaId = it.tiendaId;
        tiendaDetectadaNombre = it.tiendaNombre;
      }
    });
  } else {
    listaItemsArray.push({
      nombre: `Servicio de Transporte: ${claseCarreraSeleccionada}`,
      precio: precioTransporte,
      cantidad: 1
    });
  }

  const nuevoPedidoId = `ped_${Date.now()}`;
  if (firebaseActivo && db) {
    try {
      db.ref(`pedidos/${nuevoPedidoId}`).set({
        orden: numOrden,
        cliente: nombre,
        telefono: telefono,
        direccion: direccion || textoDestinoStr,
        ubicacionGPS: ubicacionGPS,
        total: montoTotalCalculado,
        metodoPago: metodoPagoActual,
        estado: 'pendiente',
        items: listaItemsArray,
        fecha: new Date().toISOString()
      });
    } catch(e) {}
  }

  carrito = {};
  actualizarTotales();
  volverAPaso1();
  mostrarToast(`¡Pedido ${numOrden} enviado con éxito!`, "Registrado", "success");
}
