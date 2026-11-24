// ================= LÓGICA PRINCIPAL - PEDIDOS FLASH NIRGUA =================

// ================= POLÍTICAS DE PRIVACIDAD MODAL =================
function abrirModalPoliticasPrivacidad() {
  const modal = document.getElementById('modal-politicas-privacidad-cliente');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}
window.abrirModalPoliticasPrivacidad = abrirModalPoliticasPrivacidad;

function cerrarModalPoliticasPrivacidad() {
  const modal = document.getElementById('modal-politicas-privacidad-cliente');
  if (modal) modal.classList.add('hidden');
}
window.cerrarModalPoliticasPrivacidad = cerrarModalPoliticasPrivacidad;

// ================= FUNCIONES GLOBALES DE TELÉFONO =================
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
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    firebaseActivo = true;
  }
} catch (e) {
  console.warn("Firebase no activo:", e);
}

const NUMERO_WHATSAPP = "584262566854";
let carrito = {};
let esPagoTransporteDirecto = false;
let usuarioActivo = null;

// ================= AUTENTICACIÓN Y GESTIÓN DE SESIÓN CLIENTE =================
let tasaBCVActual = parseFloat(localStorage.getItem('pedidosflash_tasa_bcv')) || 0;

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
    tabLogin.className = "btn-tactil py-2 text-xs font-black rounded-xl bg-gradient-to-r from-accent-cyan to-brand-600 text-slate-950 shadow-md transition";
    tabReg.className = "btn-tactil py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition";
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  } else {
    tabReg.className = "btn-tactil py-2 text-xs font-black rounded-xl bg-gradient-to-r from-accent-magenta to-pink-600 text-white shadow-md transition";
    tabLogin.className = "btn-tactil py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition";
    formReg.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

function saltarAuthComoInvitado() {
  const authScreen = document.getElementById('pantalla-auth');
  if (authScreen) {
    authScreen.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => authScreen.classList.add('hidden'), 400);
  }
  mostrarToast("Navegando como Invitado", "Bienvenido", "info");
}

function consultarFirebaseConTimeout(refPath, ms = 4000) {
  return Promise.race([
    db.ref(refPath).once('value'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_FIREBASE')), ms))
  ]);
}

async function ejecutarLogin(e) {
  e.preventDefault();
  const telRaw = document.getElementById('auth-login-tel').value.trim();
  const pin = document.getElementById('auth-login-pin').value.trim();
  const telLimpio = limpiarTelefonoId(telRaw);

  if (!telLimpio || pin.length !== 4) {
    mostrarToast("Ingresa tu teléfono y PIN de 4 dígitos", "Datos incompletos", "error");
    return;
  }

  // Acceso instantáneo desde caché local del teléfono (0 ms)
  try {
    const cacheUsuarios = JSON.parse(localStorage.getItem('pedidosflash_usuarios_cache') || '{}');
    const localGuardado = JSON.parse(localStorage.getItem('pedidosflash_usuario') || 'null');
    const usuarioCache = cacheUsuarios[telLimpio] || (localGuardado && localGuardado.telefono === telLimpio ? localGuardado : null);

    if (usuarioCache && usuarioCache.pin === pin) {
      guardarYAplicarSesion(usuarioCache);
      mostrarToast(`¡Bienvenido de nuevo, ${usuarioCache.nombre || 'Cliente'}!`, "Acceso Instantáneo ⚡", "success");
      if (firebaseActivo && db) {
        db.ref(`usuarios_clientes/${telLimpio}`).once('value').then(snap => {
          if (snap.val()) guardarYAplicarSesion(snap.val(), true);
        }).catch(() => {});
      }
      return;
    }
  } catch (errCache) {}

  const btn = document.getElementById('btn-submit-login');
  const textoOrig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Verificando...`;

  try {
    if (firebaseActivo && db) {
      const snap = await consultarFirebaseConTimeout(`usuarios_clientes/${telLimpio}`, 4500);
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
    console.warn("Login lento o sin red, entrando en modo rápido:", err);
    const local = JSON.parse(localStorage.getItem('pedidosflash_usuario') || 'null');
    if (local && local.telefono === telLimpio && local.pin === pin) {
      guardarYAplicarSesion(local);
    } else {
      const usuarioFallback = { telefono: telLimpio, telefonoOriginal: telRaw, nombre: "Cliente Flash", direccion: "Nirgua", pin };
      guardarYAplicarSesion(usuarioFallback);
      mostrarToast("Ingresaste en modo rápido", "Bienvenido", "info");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOrig;
  }
}

async function ejecutarRegistro(e) {
  e.preventDefault();
  const nombre = document.getElementById('auth-reg-nombre').value.trim();
  const telRaw = document.getElementById('auth-reg-tel').value.trim();
  const direccion = document.getElementById('auth-reg-direccion').value.trim();
  const pin = document.getElementById('auth-reg-pin').value.trim();
  const telLimpio = limpiarTelefonoId(telRaw);

  if (!nombre || !telLimpio || pin.length !== 4) {
    mostrarToast("Completa tu nombre, teléfono y PIN de 4 dígitos", "Datos incompletos", "error");
    return;
  }

  const nuevoUsuario = {
    telefono: telLimpio,
    telefonoOriginal: telRaw,
    nombre,
    direccion: direccion || '',
    pin,
    fechaRegistro: new Date().toISOString()
  };

  guardarYAplicarSesion(nuevoUsuario);
  mostrarToast(`¡Bienvenido a Pedidos Flash, ${nombre}!`, "Cuenta Creada", "success");

  if (firebaseActivo && db) {
    db.ref(`usuarios_clientes/${telLimpio}`).set(nuevoUsuario).catch(err => {
      console.warn("Sincronización diferida de registro:", err);
    });
  }
}

function guardarYAplicarSesion(user, silencioso = false) {
  localStorage.setItem('pedidosflash_usuario', JSON.stringify(user));
  try {
    const cache = JSON.parse(localStorage.getItem('pedidosflash_usuarios_cache') || '{}');
    if (user.telefono) {
      cache[user.telefono] = user;
      localStorage.setItem('pedidosflash_usuarios_cache', JSON.stringify(cache));
    }
  } catch (e) {}

  aplicarSesionUsuario(user);
  if (!silencioso) {
    const authScreen = document.getElementById('pantalla-auth');
    if (authScreen) {
      authScreen.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => authScreen.classList.add('hidden'), 300);
    }
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

// ESTADO PARA TRANSPORTE
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

// ================= TOAST PROFESIONAL =================
let toastTimeout = null;
function mostrarToast(mensaje, titulo = "Pedidos Flash", tipo = "info") {
  const toast = document.getElementById('toast-notificacion');
  const toastTit = document.getElementById('toast-titulo');
  const toastMsj = document.getElementById('toast-mensaje');
  const toastBg = document.getElementById('toast-icono-bg');
  const toastIcon = document.getElementById('toast-icono');

  toastTit.innerText = titulo;
  toastMsj.innerText = mensaje;

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
  if (window.lucide) lucide.createIcons();

  toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (navigator.vibrate) navigator.vibrate(30);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-4');
  }, 3000);
}

// ================= RENDERIZADO DEL CATÁLOGO & TIENDAS (BAJO DEMANDA ULTRARRÁPIDO) =================
const categoriasRenderizadas = {};
const CATEGORIAS_CATALOGO = ['viveres', 'charcuteria', 'carnes', 'verduras', 'bebidas', 'limpieza', 'farmacia', 'ferreteria', 'panaderia'];

function renderizarCategoriaIndividual(cat) {
  if (cat === 'panaderia') {
    const gridPanaderia = document.getElementById('grid-panaderia-panamericana');
    if (gridPanaderia && productos.panaderia) {
      gridPanaderia.innerHTML = productos.panaderia.map(crearTarjetaProductoHTML).join('');
      categoriasRenderizadas[cat] = true;
      if (window.lucide) lucide.createIcons({ root: gridPanaderia });
    }
    return;
  }
  const sec = document.getElementById(`grid-${cat}`);
  if (sec && productos[cat]) {
    sec.innerHTML = productos[cat].map(crearTarjetaProductoHTML).join('');
    categoriasRenderizadas[cat] = true;
    if (window.lucide) lucide.createIcons({ root: sec });
  }
}

function renderizarCatalogo(forzarTodas = false) {
  if (forzarTodas) {
    CATEGORIAS_CATALOGO.forEach(cat => {
      if (!categoriasRenderizadas[cat] || forzarTodas === 'reconstruir') {
        renderizarCategoriaIndividual(cat);
      }
    });
  } else {
    Object.keys(categoriasRenderizadas).forEach(cat => {
      if (categoriasRenderizadas[cat]) renderizarCategoriaIndividual(cat);
    });
  }
  renderizarLocalesComerciales();
}

let tiendaAbiertaActualId = null;

function renderizarLocalesComerciales() {
  const grid = document.getElementById('grid-locales-comerciales');
  if (!grid) return;
  grid.innerHTML = "";

  Object.keys(infoLocales).forEach(tid => {
    const loc = infoLocales[tid];
    if (loc.eliminado) return;
    const idLocal = loc.id || tid;
    grid.innerHTML += `
      <button onclick="abrirModalLocal('${idLocal}')" class="btn-tactil group bg-slate-900/90 border border-slate-800 hover:border-accent-yellow p-3 rounded-[24px] flex flex-col items-center text-center gap-2 shadow-lg backdrop-blur-md transition-all">
        <div class="w-16 h-16 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 p-1 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <img src="${loc.logo || 'img/logo.jfif'}" loading="lazy" decoding="async" alt="${loc.nombre}" class="w-full h-full object-cover rounded-xl" onerror="this.onerror=null; this.src='img/logo.jfif';">
        </div>
        <div>
          <h4 class="text-xs font-black text-white leading-tight line-clamp-1">${loc.nombre}</h4>
          <p class="text-[10px] text-accent-yellow font-bold leading-tight mt-0.5 line-clamp-1">${loc.sub || 'Comercio Asociado'}</p>
        </div>
        <span class="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Ver Menú ↗</span>
      </button>
    `;
  });
  if (window.lucide) lucide.createIcons();
}

function abrirModalLocal(localId) {
  tiendaAbiertaActualId = localId;
  const loc = infoLocales[localId];
  if (!loc || loc.eliminado) return;

  const titEl = document.getElementById('titulo-modal-local');
  const subEl = document.getElementById('sub-modal-local');
  const imgEl = document.getElementById('img-modal-local');
  if (titEl) titEl.innerText = loc.nombre;
  if (subEl) subEl.innerText = loc.sub || 'Menú Especial';
  if (imgEl) imgEl.src = loc.logo || 'img/logo.jfif';

  const contenedor = document.getElementById('grid-modal-productos-local');
  if (!contenedor) return;
  contenedor.innerHTML = "";

  const mapaPlatosTienda = {};

  (productos.comida || []).filter(p => (p.local === localId || p.tiendaId === localId)).forEach(p => {
    mapaPlatosTienda[p.id] = { ...p, tiendaId: localId };
  });

  if (productosDinamicosTiendas && productosDinamicosTiendas[localId]) {
    Object.keys(productosDinamicosTiendas[localId]).forEach(pid => {
      const pFB = productosDinamicosTiendas[localId][pid];
      if (pFB.eliminado === true) {
        delete mapaPlatosTienda[pid];
      } else {
        mapaPlatosTienda[pid] = {
          ...(mapaPlatosTienda[pid] || {}),
          ...pFB,
          id: pid,
          tiendaId: localId
        };
      }
    });
  }

  const listaPlatos = Object.values(mapaPlatosTienda);
  if (listaPlatos.length === 0) {
    contenedor.innerHTML = `
      <div class="col-span-2 text-center py-8 text-slate-400">
        <i data-lucide="utensils" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <p class="text-xs font-semibold">No hay platos disponibles por el momento.</p>
      </div>
    `;
  } else {
    contenedor.innerHTML = listaPlatos.map(crearTarjetaProductoHTML).join('');
  }

  document.getElementById('modal-productos-local').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function cerrarModalLocal() {
  tiendaAbiertaActualId = null;
  document.getElementById('modal-productos-local').classList.add('hidden');
}

function crearTarjetaProductoHTML(item) {
  const estaAgotado = item.disponible === false;
  const esConsultar = !item.precioBase || parseFloat(item.precioBase) <= 0;
  const precioMostrar = estaAgotado
    ? `<span class="text-xs font-bold text-slate-500 line-through">$${parseFloat(item.precioBase || 0).toFixed(2)}</span>`
    : esConsultar
      ? '<span class="text-[10px] font-black text-accent-cyan bg-accent-cyan/15 px-2 py-0.5 rounded-md border border-accent-cyan/30">Consultar</span>'
      : `<span class="text-xs font-black text-accent-yellow">$${parseFloat(item.precioBase).toFixed(2)}</span>`;

  const badgeHTML = estaAgotado
    ? `<span class="absolute top-1.5 right-1.5 bg-rose-600/90 text-white font-black text-[8px] px-1.5 py-0.5 rounded-md shadow-md z-10 border border-rose-400/50">AGOTADO</span>`
    : item.badge
      ? `<span class="absolute top-1.5 right-1.5 bg-accent-magenta text-white font-black text-[8px] px-1.5 py-0.5 rounded-md shadow-md z-10">${item.badge}</span>`
      : '';

  let bloqueControl = '';
  if (estaAgotado) {
    bloqueControl = `
      <div class="flex items-center justify-between w-full pt-1 gap-1">
        ${precioMostrar}
        <span class="bg-slate-800/80 text-rose-400 font-bold px-2 py-1 rounded-xl text-[9px] border border-rose-500/20">No disponible</span>
      </div>
    `;
  } else if (item.esGranel) {
    const defGranel = item.defGranel || 500;
    const minGranel = item.minGranel || 200;
    const maxGranel = item.maxGranel || 3000;
    const pasoGranel = item.pasoGranel || 100;
    const labelPeso = defGranel >= 1000 ? `${(defGranel / 1000).toFixed(1)}kg` : `${defGranel}g`;
    const precioInicialGranel = ((parseFloat(item.precioBase) || 0) * defGranel) / 1000;

    bloqueControl = `
      <div class="w-full space-y-1.5 pt-1">
        <div class="flex justify-between items-center text-[10px] text-slate-300 font-bold px-0.5">
          <span>Peso: <b id="label-gramos-${item.id}" class="text-accent-cyan">${labelPeso}</b></span>
          <span id="precio-granel-${item.id}" class="text-accent-yellow font-black">$${precioInicialGranel.toFixed(2)}</span>
        </div>
        <input type="range" id="slider-${item.id}" min="${minGranel}" max="${maxGranel}" step="${pasoGranel}" value="${defGranel}" oninput="actualizarSliderGranel('${item.id}')" onclick="event.stopPropagation()" class="w-full accent-accent-cyan h-1.5 bg-slate-800 rounded-lg cursor-pointer">
        <button onclick="agregarGranelAlCarrito('${item.id}'); event.stopPropagation();" class="btn-tactil w-full bg-gradient-to-r from-accent-cyan to-brand-600 text-slate-950 font-black py-1.5 rounded-xl text-[10px] flex items-center justify-center gap-1 shadow-md">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Agregar
        </button>
      </div>
    `;
  } else {
    bloqueControl = `
      <div class="flex items-center justify-between w-full pt-1 gap-1">
        ${precioMostrar}
        <button onclick="agregarAlCarritoPorId('${item.id}'); event.stopPropagation();" class="btn-tactil bg-accent-cyan hover:bg-cyan-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-1 shadow-md shrink-0">
          <i data-lucide="plus" class="w-3.5 h-3.5 stroke-[3]"></i> Pedir
        </button>
      </div>
    `;
  }

  const cardClases = estaAgotado ? 'opacity-75 grayscale-[25%]' : '';

  return `
    <div class="item-producto cursor-pointer active:scale-95 hover:border-cyan-500/60 transition-all select-none bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-[22px] flex flex-col justify-between relative group backdrop-blur-sm shadow-md ${cardClases}" data-nombre="${normalizarTexto(item.nombre)}" data-sub="${item.sub || ''}" onclick="puyarProductoAgregar('${item.id}', event)">
      ${badgeHTML}
      <div class="w-full h-20 rounded-xl overflow-hidden bg-slate-900/60 flex items-center justify-center p-1 relative mb-1.5 pointer-events-none">
        <img src="${item.imagen || 'img/logo.jfif'}" loading="lazy" decoding="async" alt="${item.nombre}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null; this.src='img/logo.jfif';">
      </div>
      <div class="flex-1 flex flex-col justify-between pointer-events-none">
        <h5 class="text-xs font-bold text-white leading-tight line-clamp-2 mb-1">${item.nombre}</h5>
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

  if (item.disponible === false) {
    mostrarToast("Este plato o producto está temporalmente agotado", "Agotado", "error");
    return;
  }

  const card = event && event.currentTarget ? event.currentTarget : null;
  if (card) {
    card.classList.add('ring-2', 'ring-cyan-400', 'scale-95');
    setTimeout(() => {
      card.classList.remove('ring-2', 'ring-cyan-400', 'scale-95');
    }, 160);
  }

  if (item.esGranel) {
    agregarGranelAlCarrito(id);
  } else {
    agregarAlCarritoPorId(id, 1);
  }
}

function cambiarSeccion(seccion) {
  document.getElementById('menu-principal-servicios').classList.add('hidden');
  document.getElementById('contenedor-seccion-activa').classList.remove('hidden');
  document.querySelectorAll('.seccion-target').forEach(el => el.classList.add('hidden'));

  if (!categoriasRenderizadas[seccion] && seccion !== 'comida' && seccion !== 'transporte') {
    renderizarCategoriaIndividual(seccion);
  }

  const secDestino = document.getElementById(`sec-${seccion}`);
  if (secDestino) secDestino.classList.remove('hidden');

  if (seccion === 'transporte') {
    setTimeout(() => {
      if (typeof L === 'undefined') return;
      if (!mapaRuta) {
        mapaRuta = L.map('mapa-interactivo-ruta', { zoomControl: true, attributionControl: false }).setView(puntoOrigen, 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapaRuta);

        mapaRuta.on('click', (e) => {
          puntoDestino = [e.latlng.lat, e.latlng.lng];
          textoDestinoStr = `Punto en Mapa (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`;
          document.getElementById('inputBuscadorDestino').value = textoDestinoStr;
          document.getElementById('instruccion-mapa').innerText = "✨ ¡Destino marcado!";

          if (window.marcadorDestRef) mapaRuta.removeLayer(window.marcadorDestRef);
          window.marcadorDestRef = L.marker(puntoDestino, {
            icon: L.divIcon({
              className: 'custom-pin',
              html: '<div style="background:linear-gradient(135deg, #ff007a, #d946ef); width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 16px #ff007a;"><i data-lucide="flag" style="width:16px; height:16px; color:#ffffff;"></i></div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })
          }).addTo(mapaRuta).bindPopup(`🏁 ${textoDestinoStr}`).openPopup();
          if (window.lucide) lucide.createIcons();
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
  if (!mapaRuta || typeof L === 'undefined') return;
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
  if (window.lucide) lucide.createIcons();
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
    document.getElementById('inputBuscadorOrigen').value = "📍 Mi Ubicación Actual";
    if (lblBtn) lblBtn.innerText = "✓ GPS Actual";
    actualizarMarcadorOrigen();
    if (mapaRuta) mapaRuta.setView(puntoOrigen, 16);
    if (puntoDestino) trazarLineaRuta();
    document.getElementById('instruccion-mapa').innerText = "🏁 Destino o toca en el mapa";
    mostrarToast("📍 Origen fijado por GPS con éxito", "Ubicación Lista", "success");
  }, () => {
    if (lblBtn) lblBtn.innerText = "Mi GPS";
    mostrarToast("No se pudo obtener el GPS", "Error", "error");
  });
}

function fijarDestinoRapido(nombre) {
  document.getElementById('inputBuscadorDestino').value = nombre;
  buscarPuntoDestinoPorTexto();
}

function buscarPuntoOrigenPorTexto() {
  const texto = document.getElementById('inputBuscadorOrigen').value.trim();
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
  const texto = document.getElementById('inputBuscadorDestino').value.trim();
  if (!texto) return;
  textoDestinoStr = texto;
  document.getElementById('instruccion-mapa').innerText = "✨ ¡Destino fijado con éxito!";
  buscarUbicacionNirguaPrecisa(texto, (lat, lon) => {
    puntoDestino = [lat, lon];
    if (mapaRuta && typeof L !== 'undefined') {
      if (window.marcadorDestRef) mapaRuta.removeLayer(window.marcadorDestRef);
      window.marcadorDestRef = L.marker(puntoDestino, {
        icon: L.divIcon({
          className: 'custom-pin',
          html: '<div style="background:linear-gradient(135deg, #ff007a, #d946ef); width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 16px #ff007a;"><i data-lucide="flag" style="width:16px; height:16px; color:#ffffff;"></i></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(mapaRuta).bindPopup(`🏁 ${texto}`).openPopup();
      if (window.lucide) lucide.createIcons();
      mapaRuta.setView(puntoDestino, 16);
      trazarLineaRuta();
    }
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
  if (!puntoDestino || !puntoOrigen || !mapaRuta || typeof L === 'undefined') return;
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
  if (!mapaRuta || typeof L === 'undefined') return;
  if (lineaTrayecto) mapaRuta.removeLayer(lineaTrayecto);
  lineaTrayecto = L.polyline([puntoOrigen, puntoDestino], { color: '#00f2fe', weight: 4, dashArray: '6, 8', opacity: 0.85 }).addTo(mapaRuta);
  mapaRuta.fitBounds(lineaTrayecto.getBounds(), { padding: [30, 30] });
}

function volverAlMenuPrincipal() {
  document.getElementById('inputBusqueda').value = "";
  document.getElementById('contenedor-seccion-activa').classList.add('hidden');
  document.getElementById('menu-principal-servicios').classList.remove('hidden');
  document.querySelectorAll('.item-producto').forEach(card => card.style.display = "flex");
}

// ================= MOTOR INTELIGENTE DE BÚSQUEDA Y RECONOCIMIENTO =================
function resolverProductoInteligente(terminoBruto) {
  const limpio = normalizarTexto(terminoBruto);
  if (!limpio) return null;

  let cantidad = 1;
  let gramosEspecificos = null;

  if (limpio.includes('medio kilo') || limpio.includes('1/2 kilo') || limpio.includes('500g')) {
    gramosEspecificos = 500;
  } else if (limpio.includes('1 kilo') || limpio.includes('1kg')) {
    gramosEspecificos = 1000;
  }

  let palabras = limpio.split(/[\s,.-]+/).filter(Boolean);
  const numerosTexto = { 'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5 };
  if (palabras.length > 0) {
    if (/^\d+$/.test(palabras[0])) {
      cantidad = parseInt(palabras[0], 10) || 1;
      palabras.shift();
    } else if (numerosTexto[palabras[0]]) {
      cantidad = numerosTexto[palabras[0]];
      palabras.shift();
    }
  }

  const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'paquete', 'bolsa', 'kilo', 'quiero', 'dame', 'traeme', 'por', 'favor']);
  const tokens = palabras.filter(p => !stopWords.has(p) && p.length > 1);

  if (limpio.includes('moravo') || limpio.includes('morau')) {
    const prodMoravos = productos.comida.find(p => p.local === 'moravos' && (limpio.includes('cafe') || limpio.includes('capuchino')));
    if (prodMoravos) {
      return { tipo: 'producto', producto: prodMoravos, cantidad, nota: 'Detectado en Moravos' };
    }
  }

  if (tokens.length === 0) {
    return { tipo: 'personalizado', nombre: terminoBruto.trim(), cantidad, precioBase: 0 };
  }

  for (const id in mapaProductos) {
    const prod = mapaProductos[id];
    const nom = normalizarTexto(prod.nombre);
    let match = 0;
    tokens.forEach(t => { if (nom.includes(t)) match++; });
    if (match >= Math.min(tokens.length, 2)) {
      return {
        tipo: 'producto',
        producto: prod,
        cantidad,
        gramos: gramosEspecificos || (prod.esGranel ? (prod.defGranel || 500) : null),
        nota: 'En catálogo'
      };
    }
  }

  return { tipo: 'personalizado', nombre: terminoBruto.trim(), cantidad, precioBase: 0, nota: 'Bajo Pedido' };
}

// ================= OCR, CÁMARA INTEGRADA (ANTI-REINICIO APK) Y VOZ =================
let streamCamaraInterna = null;
let facingModeActual = 'environment';

function guardarRespaldoCarrito() {
  try {
    localStorage.setItem('pedidosflash_carrito_backup', JSON.stringify(carrito));
  } catch (e) {}
}

function restaurarRespaldoCarrito() {
  try {
    const saved = localStorage.getItem('pedidosflash_carrito_backup');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        carrito = parsed;
        actualizarTotales();
      }
    }
  } catch (e) {}
}

function abrirSelectorCapturaLista() {
  guardarRespaldoCarrito();
  document.getElementById('modal-opciones-captura').classList.remove('hidden');
}
function cerrarSelectorCapturaLista() { document.getElementById('modal-opciones-captura').classList.add('hidden'); }

async function dispararCamara() {
  cerrarSelectorCapturaLista();
  guardarRespaldoCarrito();

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      await iniciarCamaraInterna(facingModeActual);
      return;
    } catch (err) {
      console.warn("Fallback a input file por permiso o dispositivo:", err);
    }
  }
  const inp = document.getElementById('input-camara-directa');
  inp.value = "";
  inp.click();
}

async function iniciarCamaraInterna(facingMode = 'environment') {
  detenerStreamCamara();
  const modalCam = document.getElementById('modal-camara-interna');
  const videoEl = document.getElementById('video-camara-interna');

  const constraints = {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };

  streamCamaraInterna = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = streamCamaraInterna;
  await videoEl.play();
  modalCam.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function detenerStreamCamara() {
  if (streamCamaraInterna) {
    try {
      streamCamaraInterna.getTracks().forEach(track => track.stop());
    } catch (e) {}
    streamCamaraInterna = null;
  }
  const videoEl = document.getElementById('video-camara-interna');
  if (videoEl) videoEl.srcObject = null;
}

function cerrarCamaraInterna() {
  detenerStreamCamara();
  document.getElementById('modal-camara-interna').classList.add('hidden');
}

async function alternarCamaraInterna() {
  facingModeActual = (facingModeActual === 'environment') ? 'user' : 'environment';
  try {
    await iniciarCamaraInterna(facingModeActual);
  } catch (e) {
    mostrarToast("No se pudo cambiar de cámara", "Aviso", "info");
  }
}

function capturarFotoCamaraInterna() {
  const videoEl = document.getElementById('video-camara-interna');
  const canvas = document.getElementById('canvas-captura-interna');
  if (!videoEl || !videoEl.videoWidth) {
    mostrarToast("Espera a que enfoque la cámara", "Cámara", "info");
    return;
  }

  const maxDim = 1280;
  let w = videoEl.videoWidth;
  let h = videoEl.videoHeight;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  cerrarCamaraInterna();
  ejecutarOCRConImagenOptimizada(dataUrl);
}

function dispararGaleria() {
  cerrarSelectorCapturaLista();
  guardarRespaldoCarrito();
  const inp = document.getElementById('input-galeria-foto');
  inp.value = "";
  inp.click();
}

function abrirModalPegarLista() { document.getElementById('modal-pegar-lista').classList.remove('hidden'); document.getElementById('textarea-lista-manual').focus(); }
function cerrarModalPegarLista() { document.getElementById('modal-pegar-lista').classList.add('hidden'); document.getElementById('textarea-lista-manual').value = ""; }

function procesarTextoPegadoManual() {
  const texto = document.getElementById('textarea-lista-manual').value.trim();
  if (!texto) return;
  cerrarModalPegarLista();

  const modalFoto = document.getElementById('modal-foto-resultado');
  document.getElementById('img-preview-foto').src = "img/logo.jfif";
  document.getElementById('laser-scan-anim').style.display = 'none';
  document.getElementById('loader-foto-ia').classList.add('hidden');
  modalFoto.classList.remove('hidden');

  analizarTextoYMostrarListaCompleta(texto);
}

function comprimirImagenArchivo(archivo, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const urlObj = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

        canvas.width = 0;
        canvas.height = 0;
        URL.revokeObjectURL(urlObj);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(urlObj);
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(urlObj);
      reject(err);
    };
    img.src = urlObj;
  });
}

async function procesarFotoIA(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  const modalFoto = document.getElementById('modal-foto-resultado');
  const loaderFoto = document.getElementById('loader-foto-ia');
  const txtLoader = document.getElementById('txt-loader-foto');
  const txtModalSub = document.getElementById('txt-modal-foto-sub');
  const laserScan = document.getElementById('laser-scan-anim');

  modalFoto.classList.remove('hidden');
  loaderFoto.classList.remove('hidden');
  laserScan.style.display = 'block';
  txtLoader.innerText = "Optimizando imagen para lectura rápida...";
  txtModalSub.innerText = "Preparando foto...";

  try {
    const imagenOptimizada = await comprimirImagenArchivo(archivo, 1280);
    ejecutarOCRConImagenOptimizada(imagenOptimizada);
  } catch (err) {
    const urlObj = URL.createObjectURL(archivo);
    ejecutarOCRConImagenOptimizada(urlObj);
  } finally {
    event.target.value = "";
  }
}

function ejecutarOCRConImagenOptimizada(fuenteImagen) {
  const modalFoto = document.getElementById('modal-foto-resultado');
  const imgPreview = document.getElementById('img-preview-foto');
  const loaderFoto = document.getElementById('loader-foto-ia');
  const txtLoader = document.getElementById('txt-loader-foto');
  const txtModalSub = document.getElementById('txt-modal-foto-sub');
  const laserScan = document.getElementById('laser-scan-anim');

  imgPreview.src = fuenteImagen;
  modalFoto.classList.remove('hidden');
  loaderFoto.classList.remove('hidden');
  laserScan.style.display = 'block';
  txtLoader.innerText = "Leyendo renglones de tu foto...";
  txtModalSub.innerText = "Iniciando motor de IA...";

  if (typeof Tesseract === 'undefined') {
    loaderFoto.classList.add('hidden');
    laserScan.style.display = 'none';
    txtModalSub.innerText = "OCR aún cargando";
    mostrarToast("Espera un segundo mientras carga el lector de texto", "OCR", "info");
    return;
  }

  Tesseract.recognize(fuenteImagen, 'spa', {
    logger: m => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 100);
        txtLoader.innerText = `Escaneando texto: ${pct}%`;
      }
    }
  }).then(({ data: { text } }) => {
    loaderFoto.classList.add('hidden');
    laserScan.style.display = 'none';
    txtModalSub.innerText = "Texto identificado con éxito";
    analizarTextoYMostrarListaCompleta(text);
  }).catch(() => {
    loaderFoto.classList.add('hidden');
    laserScan.style.display = 'none';
    txtModalSub.innerText = "No se pudo leer la foto";
    mostrarToast("No se pudo leer el texto de la foto", "Error", "error");
  });
}

function analizarTextoYMostrarListaCompleta(textoBruto) {
  const lineas = textoBruto.split(/[\r\n,]+/).map(l => l.trim()).filter(l => l.length > 2);
  const itemsProcesados = [];
  const cajaResultado = document.getElementById('caja-resultado-lista');
  const pieAcciones = document.getElementById('pie-acciones-lista-ia');

  lineas.forEach(linea => {
    const res = resolverProductoInteligente(linea);
    if (res) {
      itemsProcesados.push({
        resultado: res,
        cantidad: res.cantidad || 1,
        seleccionado: true
      });
    }
  });

  itemsDetectadosActuales = itemsProcesados;
  cajaResultado.classList.remove('hidden');
  pieAcciones.classList.remove('hidden');
  renderizarListaDetectadaModal();
}

function renderizarListaDetectadaModal() {
  const contenedor = document.getElementById('lista-articulos-detectados');
  contenedor.innerHTML = "";
  let totalCalculado = 0, cantSeleccionada = 0;

  itemsDetectadosActuales.forEach((it, idx) => {
    const esProd = it.resultado.tipo === 'producto';
    const prod = esProd ? it.resultado.producto : null;
    const nombre = esProd ? prod.nombre : it.resultado.nombre;
    const subtotal = esProd ? (prod.precioBase * it.cantidad) : 0;

    if (it.seleccionado) {
      cantSeleccionada++;
      totalCalculado += subtotal;
    }

    contenedor.innerHTML += `
      <div class="flex items-center gap-2 bg-slate-950/85 p-2.5 rounded-2xl border ${it.seleccionado ? 'border-indigo-500/50' : 'border-slate-800 opacity-60'}">
        <button onclick="toggleSeleccionarItemScan(${idx})" class="w-6 h-6 rounded-lg border ${it.seleccionado ? 'bg-accent-cyan text-slate-950' : 'bg-slate-900 text-transparent'} flex items-center justify-center font-black">✓</button>
        <div class="flex-1 min-w-0">
          <h5 class="text-xs font-bold text-white truncate">${nombre}</h5>
          <span class="text-[10px] text-accent-yellow font-black">${esProd ? '$' + subtotal.toFixed(2) : 'Variable'}</span>
        </div>
        <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-xl">
          <button onclick="ajustarCantItemScan(${idx}, -1)" class="w-5 h-5 bg-slate-800 text-white rounded text-xs">-</button>
          <span class="text-xs font-bold text-white px-1">${it.cantidad}</span>
          <button onclick="ajustarCantItemScan(${idx}, 1)" class="w-5 h-5 bg-accent-magenta text-white rounded text-xs">+</button>
        </div>
      </div>
    `;
  });

  document.getElementById('contador-items-detectados').innerText = itemsDetectadosActuales.length;
  document.getElementById('txt-cant-seleccionada-ia').innerText = cantSeleccionada;
  document.getElementById('txt-monto-total-ia').innerText = `$${totalCalculado.toFixed(2)}`;
}

function toggleSeleccionarItemScan(idx) {
  if (itemsDetectadosActuales[idx]) {
    itemsDetectadosActuales[idx].seleccionado = !itemsDetectadosActuales[idx].seleccionado;
    renderizarListaDetectadaModal();
  }
}

function toggleSeleccionarTodos() {
  const algunDesmarcado = itemsDetectadosActuales.some(i => !i.seleccionado);
  itemsDetectadosActuales.forEach(i => i.seleccionado = algunDesmarcado);
  renderizarListaDetectadaModal();
}

function ajustarCantItemScan(idx, delta) {
  if (itemsDetectadosActuales[idx]) {
    itemsDetectadosActuales[idx].cantidad += delta;
    if (itemsDetectadosActuales[idx].cantidad < 1) itemsDetectadosActuales[idx].cantidad = 1;
    renderizarListaDetectadaModal();
  }
}

function confirmarAgregarListaCompleta() {
  const items = itemsDetectadosActuales.filter(i => i.seleccionado);
  items.forEach(it => {
    if (it.resultado.tipo === 'producto') {
      const p = it.resultado.producto;
      agregarAlCarritoDirecto(p.id, p.nombre, p.precioBase, it.cantidad, p.tiendaId || p.local);
    } else {
      const idU = `pers_${Date.now()}_${Math.random()}`;
      carrito[idU] = { nombre: `${it.resultado.nombre} (A Pedido)`, precio: 0, esPersonalizado: true, cantidad: it.cantidad };
    }
  });
  actualizarTotales();
  cerrarModalFotoResultado();
  mostrarToast(`${items.length} productos agregados`, "Canasta", "success");
}

function cerrarModalFotoResultado() {
  document.getElementById('modal-foto-resultado').classList.add('hidden');
}

let reconocedorWeb = null;
function activarAsistenteVoz() {
  document.getElementById('modal-asistente-voz').classList.remove('hidden');
  document.getElementById('input-texto-dictado').value = "";
  iniciarReconocimientoVoz();
}

function iniciarReconocimientoVoz() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;
  try {
    if (reconocedorWeb) reconocedorWeb.abort();
    reconocedorWeb = new SpeechRecognition();
    reconocedorWeb.lang = 'es-VE';
    reconocedorWeb.onresult = (e) => {
      const dicho = Array.from(e.results).map(r => r[0].transcript).join(' ');
      document.getElementById('input-texto-dictado').value = dicho;
      if (e.results[0].isFinal) setTimeout(procesarTextoDesdeModalVoz, 500);
    };
    reconocedorWeb.start();
  } catch (e) {}
}

function procesarTextoDesdeModalVoz() {
  const txt = document.getElementById('input-texto-dictado').value.trim();
  if (!txt) return;
  cerrarModalVoz();
  analizarTextoYMostrarListaCompleta(txt);
  document.getElementById('modal-foto-resultado').classList.remove('hidden');
}

function cerrarModalVoz() {
  if (reconocedorWeb) try { reconocedorWeb.abort(); } catch (e) {}
  document.getElementById('modal-asistente-voz').classList.add('hidden');
}

// ================= FUNCIONES DE CARRITO =================
function actualizarSliderGranel(id) {
  const item = mapaProductos[id];
  if (!item) return;
  const gramos = parseInt(document.getElementById(`slider-${id}`).value, 10);
  const sub = (item.precioBase * gramos) / 1000;
  document.getElementById(`label-gramos-${id}`).innerText = gramos >= 1000 ? `${(gramos / 1000).toFixed(1)}kg` : `${gramos}g`;
  document.getElementById(`precio-granel-${id}`).innerText = `$${sub.toFixed(2)}`;
}

function notificarPromoDelivery(nombreProd) {
  const { cant } = calcularTotal();
  if (cant > 20) {
    mostrarToast(`¡${nombreProd} agregado! 🎉 ¡Llevas ${cant} productos y tu DELIVERY ES GRATIS ($0.00)!`, "¡Promo Flash Activa!", "success");
  } else if (cant === 20) {
    mostrarToast(`¡${nombreProd} agregado! ⚡ Llevas 20 productos: ¡Compra más de 20 productos y el delivery es gratis (¡Falta 1 solo!)`, "¡A 1 paso!", "warning");
  } else {
    const faltan = 21 - cant;
    mostrarToast(`¡${nombreProd} agregado! 🎁 Compra más de 20 productos y el delivery es gratis (Llevas ${cant}/20, faltan ${faltan})`, "¡Promo Delivery Gratis!", "info");
  }
}

function agregarGranelAlCarrito(id) {
  const item = mapaProductos[id];
  if (!item) return;
  if (item.disponible === false) {
    mostrarToast("Este producto está temporalmente agotado", "Agotado", "error");
    return;
  }
  const sliderEl = document.getElementById(`slider-${id}`);
  const gramos = sliderEl ? parseInt(sliderEl.value, 10) : (item.defGranel || 500);
  const sub = (item.precioBase * gramos) / 1000;
  const etiqueta = gramos >= 1000 ? `${(gramos / 1000).toFixed(1)}kg` : `${gramos}g`;
  const idUnico = `${id}_${gramos}`;

  if (!carrito[idUnico]) {
    carrito[idUnico] = { nombre: `${item.nombre} (${etiqueta})`, precio: sub, cantidad: 1, tiendaId: item.tiendaId || item.local };
  } else {
    carrito[idUnico].cantidad += 1;
  }
  actualizarTotales();
  notificarPromoDelivery(`${item.nombre} (${etiqueta})`);
}

function agregarAlCarritoPorId(id, cantidad = 1) {
  const item = mapaProductos[id];
  if (!item) return;
  if (item.disponible === false) {
    mostrarToast("Este plato o producto está temporalmente agotado", "Agotado", "error");
    return;
  }
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

function abrirModalPersonalizado() {
  document.getElementById('modal-personalizado').classList.remove('hidden');
  document.getElementById('input-nombre-personalizado').focus();
}

function cerrarModalPersonalizado() {
  document.getElementById('modal-personalizado').classList.add('hidden');
  document.getElementById('input-nombre-personalizado').value = "";
}

function guardarProductoPersonalizadoFlotante() {
  const txt = document.getElementById('input-nombre-personalizado').value.trim();
  if (!txt) return;
  const idU = `pers_${Date.now()}`;
  carrito[idU] = { nombre: `${txt} (A Pedido)`, precio: 0, esPersonalizado: true, cantidad: 1 };
  actualizarTotales();
  cerrarModalPersonalizado();
  mostrarToast("Producto agregado a tu lista", "Añadido", "success");
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
  document.getElementById('modal-carrito-detalle').classList.remove('hidden');
}

function cerrarModalCarrito() {
  document.getElementById('modal-carrito-detalle').classList.add('hidden');
}

function renderizarModalCarrito() {
  const contenedor = document.getElementById('lista-modal-carrito');
  const { total, cant } = calcularTotal();
  const esDeliveryGratis = cant > 20;
  const costoDelivery = esDeliveryGratis ? 0.00 : 1.00;
  const totalConDelivery = total + costoDelivery;

  document.getElementById('modal-carrito-monto-total').innerText = `$${totalConDelivery.toFixed(2)}`;

  const avisoPromoModal = document.getElementById('modal-carrito-promo-aviso');
  if (avisoPromoModal) {
    if (esDeliveryGratis) {
      avisoPromoModal.className = "bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-2 text-center text-[10px] text-emerald-300 font-bold";
      avisoPromoModal.innerHTML = `🎉 ¡Llevas ${cant} productos! ¡Tu delivery es GRATIS ($0.00)!`;
    } else if (cant === 20) {
      avisoPromoModal.className = "bg-amber-950/80 border border-amber-500/50 rounded-xl p-2 text-center text-[10px] text-amber-300 font-bold";
      avisoPromoModal.innerHTML = `⚡ ¡Llevas 20 productos! Compra más de 20 productos y el delivery es gratis (¡Falta 1 solo!)`;
    } else {
      const faltan = 21 - cant;
      avisoPromoModal.className = "bg-slate-950/90 border border-emerald-500/30 rounded-xl p-2 text-center text-[10px] text-emerald-400 font-medium";
      avisoPromoModal.innerHTML = `🎁 Compra más de 20 productos y el delivery es gratis (Llevas ${cant}/20, faltan ${faltan})`;
    }
  }

  contenedor.innerHTML = "";
  Object.keys(carrito).forEach(id => {
    const item = carrito[id];
    const precioTxt = item.esPersonalizado
      ? `<span class="text-[10px] text-accent-cyan font-bold block">A Pedido (Precio Variable)</span>`
      : `<span class="text-xs text-accent-yellow font-black">$${(item.cantidad * item.precio).toFixed(2)}</span>`;

    const esRestaurante = item.tiendaId && (infoLocales[item.tiendaId] || item.tiendaId === 'moravos' || item.tiendaId === 'fran_chero' || item.tiendaId === 'antons' || item.tiendaId === 'zirus');
    const nomT = (item.tiendaId && infoLocales[item.tiendaId]) ? infoLocales[item.tiendaId].nombre : item.tiendaNombre;
    const tiendaLabel = esRestaurante && nomT
      ? `<span class="text-[9px] text-amber-400 font-bold block">🏪 ${nomT}</span>`
      : `<span class="text-[9px] text-cyan-400 font-semibold block">⚡ Supermercado Flash</span>`;

    contenedor.innerHTML += `
      <div class="flex items-center justify-between bg-slate-950/85 p-3 rounded-2xl border border-slate-800">
        <div class="flex-1 pr-2">
          <h5 class="text-xs font-bold text-white line-clamp-1">${item.nombre}</h5>
          ${tiendaLabel}
          ${precioTxt}
        </div>
        <div class="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button onclick="cambiarCantCarrito('${id}', -1)" type="button" class="btn-tactil w-7 h-7 bg-slate-800 text-white font-black rounded-lg text-xs flex items-center justify-center">-</button>
          <span class="text-xs font-black text-white w-5 text-center">${item.cantidad}</span>
          <button onclick="cambiarCantCarrito('${id}', 1)" type="button" class="btn-tactil w-7 h-7 bg-accent-magenta text-white font-black rounded-lg text-xs flex items-center justify-center">+</button>
        </div>
      </div>
    `;
  });
  if (window.lucide) lucide.createIcons();
}

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
  listaResumen.innerHTML = "";

  if (esPagoTransporteDirecto) {
    const nombreServicio = `Transporte: ${claseCarreraSeleccionada}`;
    const txtBsResumen = tasaBCVActual > 0 ? ` (${formatearBs(precioTransporte)})` : '';
    listaResumen.innerHTML += `<div class="flex justify-between items-center"><span class="text-slate-200">1x ${nombreServicio}</span><span class="text-accent-yellow font-black">$${precioTransporte.toFixed(2)}${txtBsResumen}</span></div>`;
    document.getElementById('total-precio-resumen').innerText = `$${precioTransporte.toFixed(2)}${txtBsResumen}`;
  } else {
    const { total, cant } = calcularTotal();
    const esDeliveryGratis = cant > 20;
    const costoDelivery = esDeliveryGratis ? 0.00 : 1.00;
    const totalFinal = total + costoDelivery;

    Object.keys(carrito).forEach(id => {
      const item = carrito[id];
      const precioTxt = item.esPersonalizado ? `<span class="text-accent-cyan font-bold">Variable</span>` : `<span class="text-accent-yellow font-black">$${(item.cantidad * item.precio).toFixed(2)}</span>`;
      listaResumen.innerHTML += `<div class="flex justify-between items-center"><span class="text-slate-200">${item.cantidad}x ${item.nombre}</span>${precioTxt}</div>`;
    });

    listaResumen.innerHTML += `
      <div class="pt-2 border-t border-slate-800/80 flex justify-between items-center">
        <span class="text-slate-300 text-xs font-semibold flex items-center gap-1">
          🛵 Tarifa de Delivery Nirgua:
        </span>
        <span class="${esDeliveryGratis ? 'text-emerald-400 font-black' : 'text-slate-300 font-bold'} text-xs">
          ${esDeliveryGratis ? '¡GRATIS! ($0.00)' : '$1.00'}
        </span>
      </div>
    `;

    if (esDeliveryGratis) {
      listaResumen.innerHTML += `
        <div class="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-2 text-center text-[11px] text-emerald-300 font-bold">
          🎉 ¡Promo Flash! Llevas ${cant} productos (más de 20). ¡Tu delivery es 100% GRATIS!
        </div>
      `;
    } else {
      const faltan = 21 - cant;
      listaResumen.innerHTML += `
        <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-center text-[10px] text-slate-400">
          💡 ¡Compra más de 20 productos y el delivery es gratis! (Llevas ${cant}, faltan ${faltan})
        </div>
      `;
    }

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
    b.className = "btn-tactil p-2.5 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold flex flex-col items-center justify-center gap-1";
  });
  [cajaMovil, cajaEfec, cajaDiv].forEach(c => c.classList.add('hidden'));

  if (metodo === 'pago_movil') {
    btnMovil.className = "btn-tactil p-2.5 rounded-xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-cyan";
    cajaMovil.classList.remove('hidden');
    metodoPagoActual = 'Pago Móvil';
  } else if (metodo === 'efectivo') {
    btnEfec.className = "btn-tactil p-2.5 rounded-xl border-2 border-accent-yellow bg-accent-yellow/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-yellow";
    cajaEfec.classList.remove('hidden');
    metodoPagoActual = 'Efectivo';
  } else {
    btnDiv.className = "btn-tactil p-2.5 rounded-xl border-2 border-accent-emerald bg-accent-emerald/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-emerald";
    cajaDiv.classList.remove('hidden');
    metodoPagoActual = 'Zelle / Divisas';
  }
  document.getElementById('metodoPagoElegido').value = `${metodoPagoActual} (Al Recibir)`;
}

function fijarMontoPaga(monto) {
  document.getElementById('montoPagaCliente').value = monto;
  mostrarToast(`Pagas con: ${monto}`, "Vuelto", "info");
}

function copiarDatosPagoMovil(banco) {
  let datos = "";
  let nombreBanco = "";

  if (banco === 'provincial') {
    datos = "Banco Provincial (0108) - 04144205169 - V-31060250";
    nombreBanco = "Banco Provincial";
  } else {
    datos = "Banco de Venezuela (0102) - 04262566854 - V-12286636";
    nombreBanco = "Banco de Venezuela";
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(datos).then(() => {
      mostrarToast(`Datos de ${nombreBanco} copiados`, "Copiado", "success");
    }).catch(() => {
      mostrarToast(datos, nombreBanco, "info");
    });
  } else {
    mostrarToast(datos, nombreBanco, "info");
  }
}

function seleccionarBeneficiario(tipo) {
  const btnMio = document.getElementById('btn-beneficiario-mio');
  const btnTercero = document.getElementById('btn-beneficiario-tercero');
  const contenedorTercero = document.getElementById('contenedor-tercero');
  const inputTipo = document.getElementById('tipoBeneficiario');

  if (tipo === 'mio') {
    btnMio.className = "btn-tactil p-2 rounded-xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black";
    btnTercero.className = "btn-tactil p-2 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold";
    contenedorTercero.classList.add('hidden');
    inputTipo.value = "Es para mí";
  } else {
    btnTercero.className = "btn-tactil p-2 rounded-xl border-2 border-accent-magenta bg-accent-magenta/20 text-white text-xs font-black";
    btnMio.className = "btn-tactil p-2 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold";
    contenedorTercero.classList.remove('hidden');
    inputTipo.value = "Es para otra persona";
  }
}

// ================= TARIFAS DE TRANSPORTE SINCRONIZADAS CON ADMIN =================
let tarifasTransporte = {
  moto_corta: 1.00,
  moto_media: 3.50,
  moto_salon: 4.00,
  carro_corto: 4.00,
  carro_salon: 8.00
};
let claveTarifaSeleccionada = 'moto_corta';
let claseCarreraSeleccionada = 'Moto Corta / Urbana';

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
    btnMoto.className = "btn-tactil p-2.5 rounded-2xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-cyan transition relative";
    btnCarro.className = "btn-tactil p-2.5 rounded-2xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition relative";
    boxMoto.classList.remove('hidden');
    boxCarro.classList.add('hidden');
    seleccionarTarifaEspecifica('moto', 'moto_corta', 'Moto Corta / Urbana');
  } else {
    btnCarro.className = "btn-tactil p-2.5 rounded-2xl border-2 border-accent-cyan bg-accent-cyan/20 text-white text-xs font-black flex flex-col items-center justify-center gap-1 shadow-glow-cyan transition relative";
    btnMoto.className = "btn-tactil p-2.5 rounded-2xl border-2 border-slate-800 bg-slate-900 text-slate-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition relative";
    boxCarro.classList.remove('hidden');
    boxMoto.classList.add('hidden');
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

function seleccionarTransporte(tipo, costo) {
  if (tipo === 'carro') {
    seleccionarCategoriaVehiculo('carro');
  } else {
    seleccionarCategoriaVehiculo('moto');
  }
  if (typeof costo === 'number' && !isNaN(costo)) {
    precioTransporte = costo;
  }
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

function reiniciarPuntosRuta() {
  puntoDestino = null;
  textoDestinoStr = "No seleccionado";
  document.getElementById('inputBuscadorOrigen').value = "";
  document.getElementById('inputBuscadorDestino').value = "";
  document.getElementById('instruccion-mapa').innerText = "📍 Toca mapa o escribe";
  const distEl = document.getElementById('lbl-hud-distancia');
  const durEl = document.getElementById('lbl-hud-tiempo');
  if (distEl) distEl.innerText = "Toca mapa para fijar ruta";
  if (durEl) durEl.innerText = "~3 min";
  if (window.marcadorDestRef && mapaRuta) mapaRuta.removeLayer(window.marcadorDestRef);
  if (lineaTrayecto && mapaRuta) mapaRuta.removeLayer(lineaTrayecto);
  mostrarToast("Puntos de ruta reiniciados", "Mapa", "info");
}

function filtrarProductos() {
  const q = normalizarTexto(document.getElementById('inputBusqueda').value);
  if (q === "") {
    volverAlMenuPrincipal();
    return;
  }

  // Asegurar que todas las categorías del catálogo estén renderizadas antes de filtrar
  CATEGORIAS_CATALOGO.forEach(cat => {
    if (!categoriasRenderizadas[cat]) renderizarCategoriaIndividual(cat);
  });

  document.getElementById('menu-principal-servicios').classList.add('hidden');
  document.getElementById('contenedor-seccion-activa').classList.remove('hidden');

  document.querySelectorAll('.seccion-target').forEach(el => {
    if (el.id === 'sec-transporte' || el.id === 'sec-comida') {
      el.classList.add('hidden');
      return;
    }
    let tieneCoincidencia = false;
    el.querySelectorAll('.item-producto').forEach(card => {
      const nombreCard = card.getAttribute('data-nombre') || '';
      const coincide = nombreCard.includes(q);
      card.style.display = coincide ? "flex" : "none";
      if (coincide) tieneCoincidencia = true;
    });
    if (tieneCoincidencia) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// ================= OBTENER UBICACIÓN GPS LIMPIA =================
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
    () => {
      if (lblGps) lblGps.innerText = "Tocar para adjuntar GPS en vivo";
      if (btnGps) btnGps.disabled = false;
      if (!silencioso) mostrarToast("Activa los permisos GPS de tu teléfono", "Aviso GPS", "info");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ================= ENVIAR PEDIDO CON DISPARO DUAL =================
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
  let tiendaPctComision = 8;
  let totalVentaTienda = 0;

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

      if (it.tiendaId) {
        tiendaDetectadaId = it.tiendaId;
        tiendaDetectadaNombre = it.tiendaNombre || (infoLocales[it.tiendaId] ? infoLocales[it.tiendaId].nombre : 'Comercio');
        if (infoLocales[it.tiendaId] && infoLocales[it.tiendaId].porcentajeComision) {
          tiendaPctComision = parseFloat(infoLocales[it.tiendaId].porcentajeComision);
        }
        totalVentaTienda += (it.precio || 0) * it.cantidad;
      }
    });
  } else {
    listaItemsArray.push({
      nombre: `Servicio de Transporte: ${claseCarreraSeleccionada}`,
      precio: precioTransporte,
      cantidad: 1
    });
  }

  if (!tiendaDetectadaId) {
    const itemMoravos = listaItemsArray.find(i => i.nombre.toLowerCase().includes('moravo') || i.nombre.toLowerCase().includes('morau'));
    if (itemMoravos) {
      tiendaDetectadaId = 'moravos';
      tiendaDetectadaNombre = 'Moravos Café';
      tiendaPctComision = (infoLocales.moravos && infoLocales.moravos.porcentajeComision) ? parseFloat(infoLocales.moravos.porcentajeComision) : 8;
      totalVentaTienda = montoTotalCalculado;
    }
  }

  const comisionFlash = (totalVentaTienda * tiendaPctComision) / 100;
  const netoTienda = totalVentaTienda - comisionFlash;

  let latDestinoFinal = null;
  let lngDestinoFinal = null;
  let latOrigenFinal = 10.1506;
  let lngOrigenFinal = -68.5668;

  if (esPagoTransporteDirecto) {
    latOrigenFinal = puntoOrigen ? puntoOrigen[0] : 10.1506;
    lngOrigenFinal = puntoOrigen ? puntoOrigen[1] : -68.5668;
    latDestinoFinal = puntoDestino ? puntoDestino[0] : 10.1506;
    lngDestinoFinal = puntoDestino ? puntoDestino[1] : -68.5668;
  } else {
    if (clienteLatActual !== null && clienteLngActual !== null) {
      latDestinoFinal = clienteLatActual;
      lngDestinoFinal = clienteLngActual;
    } else if (ubicacionGPS) {
      const m = ubicacionGPS.match(/q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/) || ubicacionGPS.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (m) {
        latDestinoFinal = parseFloat(m[1]);
        lngDestinoFinal = parseFloat(m[2]);
      }
    }
    if (latDestinoFinal === null || isNaN(latDestinoFinal)) {
      latDestinoFinal = 10.1506;
      lngDestinoFinal = -68.5668;
    }
  }

  const ubicacionGPSFinal = ubicacionGPS || `https://maps.google.com/?q=${latDestinoFinal},${lngDestinoFinal}`;

  let esRestauranteComida = false;
  if (tiendaDetectadaId && (infoLocales[tiendaDetectadaId] || tiendaDetectadaId === 'moravos' || tiendaDetectadaId === 'fran_chero' || tiendaDetectadaId === 'antons' || tiendaDetectadaId === 'zirus')) {
    esRestauranteComida = true;
  }
  const nombreTiendaCliente = esRestauranteComida ? (tiendaDetectadaNombre || (infoLocales[tiendaDetectadaId] ? infoLocales[tiendaDetectadaId].nombre : 'Comercio Aliado')) : (esPagoTransporteDirecto ? 'Transporte Flash' : 'Supermercado Flash');

  if (firebaseActivo && db) {
    try {
      const nuevoPedidoRef = db.ref('pedidos').push({
        orden: numOrden,
        tipoServicio: esPagoTransporteDirecto ? 'transporte' : 'delivery',
        vehiculoRequerido: esPagoTransporteDirecto ? (tipoTransporteSeleccionado === 'carro' ? 'Carro' : 'Moto') : 'Cualquiera',
        claseCarrera: esPagoTransporteDirecto ? claseCarreraSeleccionada : null,
        cliente: nombre,
        telefono: telefono,
        direccion: direccion || textoDestinoStr || 'Ubicación especificada',
        ubicacionGPS: ubicacionGPSFinal,
        lat: latDestinoFinal,
        lng: lngDestinoFinal,
        destinoLat: latDestinoFinal,
        destinoLng: lngDestinoFinal,
        origenLat: latOrigenFinal,
        origenLng: lngOrigenFinal,
        metodoPago: `${metodoPagoActual} (Pago Contra Entrega)`,
        pagoContraEntrega: true,
        pagaCon: montoPaga || '',
        subtotal: totalProductos,
        costoDelivery: costoDelivery,
        deliveryGratis: esDeliveryGratis,
        cantProductos: cantProductos,
        total: montoTotalCalculado,
        estado: 'pendiente',
        chofer: 'Sin Asignar',
        choferTelefono: '',
        tiendaId: esRestauranteComida ? (tiendaDetectadaId || '') : 'supermercado_flash',
        tiendaNombre: esRestauranteComida ? (tiendaDetectadaNombre || '') : 'Supermercado Flash',
        tiendaPublicaCliente: nombreTiendaCliente,
        esSupermercadoFlash: !esRestauranteComida && !esPagoTransporteDirecto,
        porcentajeComision: tiendaDetectadaId ? tiendaPctComision : 0,
        comisionFlash: comisionFlash,
        netoTienda: netoTienda,
        anotadoEnCuenta: !!tiendaDetectadaId,
        items: listaItemsArray,
        fecha: new Date().toISOString()
      });

      if (telefono) {
        const telLimpio = limpiarTelefonoId(telefono);
        if (telLimpio) {
          db.ref(`usuarios_clientes/${telLimpio}`).once('value').then(snap => {
            if (!snap.exists()) {
              db.ref(`usuarios_clientes/${telLimpio}`).set({
                nombre: nombre,
                telefono: telLimpio,
                telefonoOriginal: telefono,
                direccion: direccion || '',
                fechaRegistro: new Date().toISOString(),
                origen: 'pedido_flash'
              });
            }
          }).catch(() => {});
        }
      }

      const nuevoPedidoId = nuevoPedidoRef ? nuevoPedidoRef.key : `ped_${Date.now()}`;

      const registroHistorial = {
        id: nuevoPedidoId,
        orden: numOrden,
        tipoServicio: esPagoTransporteDirecto ? 'transporte' : 'delivery',
        fecha: new Date().toISOString(),
        total: montoTotalCalculado,
        deliveryGratis: esDeliveryGratis,
        costoDelivery: costoDelivery,
        direccion: direccion || textoDestinoStr || 'Ubicación especificada',
        estado: 'pendiente',
        tiendaNombre: nombreTiendaCliente,
        items: listaItemsArray
      };
      guardarEnHistorialCliente(registroHistorial);

      if (nuevoPedidoId) {
        activarRastreoPedidoCliente(nuevoPedidoId);
      }

      if (tiendaDetectadaId && esRestauranteComida) {
        const descItems = listaItemsArray.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
        db.ref(`cuentas_tiendas/${tiendaDetectadaId}/movimientos`).push({
          orden: numOrden,
          concepto: descItems,
          montoVenta: totalVentaTienda,
          porcentajeComision: tiendaPctComision,
          comisionFlash: comisionFlash,
          netoTienda: netoTienda,
          cliente: nombre,
          fecha: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Error al registrar en Firebase:", e);
    }
  } else {
    const nuevoPedidoId = `offline_${Date.now()}`;
    const registroHistorial = {
      id: nuevoPedidoId,
      orden: numOrden,
      tipoServicio: esPagoTransporteDirecto ? 'transporte' : 'delivery',
      fecha: new Date().toISOString(),
      total: montoTotalCalculado,
      deliveryGratis: esDeliveryGratis,
      costoDelivery: costoDelivery,
      direccion: direccion || textoDestinoStr || 'Ubicación especificada',
      estado: 'pendiente',
      tiendaNombre: nombreTiendaCliente,
      items: listaItemsArray
    };
    guardarEnHistorialCliente(registroHistorial);
    activarRastreoPedidoCliente(nuevoPedidoId);
  }

  carrito = {};
  actualizarTotales();
  volverAPaso1();

  let msj = "";
  if (esPagoTransporteDirecto) {
    msj += `🚗 *SOLICITUD DE VIAJE: #${numOrden}* 🚗\n`;
    msj += `_Pedidos Flash Nirgua_\n\n`;
    msj += `👤 *Pasajero:* ${nombre}\n`;
    msj += `📱 *Teléfono:* ${telefono}\n`;
    msj += `👥 *Para:* ${tipoBeneficiario} ${tipoBeneficiario.includes('otra') ? '(' + nombreTercero + ')' : ''}\n\n`;
    msj += `📍 *Origen:* ${textoOrigenStr}\n`;
    msj += `🗺️ Link Salida: https://maps.google.com/?q=${latOrigenFinal},${lngOrigenFinal}\n\n`;
    if (puntoDestino) {
      msj += `🏁 *Destino:* ${textoDestinoStr}\n`;
      msj += `🗺️ Link Destino: https://maps.google.com/?q=${latDestinoFinal},${lngDestinoFinal}\n\n`;
    }
    msj += `🚘 *Unidad Solicitada:* ${tipoTransporteSeleccionado.toUpperCase()}\n`;
    msj += `💵 *Tarifa de Viaje:* $${precioTransporte.toFixed(2)}\n`;
    msj += `💳 *Método de Pago:* ${metodoPagoActual} (Al Recibir)\n`;
  } else {
    msj += `🛍️ *ORDEN DE COMPRA: #${numOrden}* 🛍️\n`;
    msj += `_Pedidos Flash Nirgua_\n\n`;
    msj += `👤 *Cliente:* ${nombre}\n`;
    msj += `📱 *Teléfono:* ${telefono}\n`;
    msj += `👥 *Entrega:* ${tipoBeneficiario} ${tipoBeneficiario.includes('otra') ? '(' + nombreTercero + ')' : ''}\n`;
    msj += `📍 *Dirección:* ${direccion}\n`;
    msj += `🗺️ *GPS Exacto en Vivo:* ${ubicacionGPSFinal}\n`;

    if (esRestauranteComida && tiendaDetectadaNombre) {
      msj += `\n🏪 *RESTAURANTE / COMIDA:* ${tiendaDetectadaNombre}\n`;
    } else if (!esPagoTransporteDirecto) {
      msj += `\n🛒 *COMPRA:* Supermercado Flash (Víveres & Bebidas)\n`;
    }

    msj += `\n🛒 *LISTA DE ARTÍCULOS:*\n`;
    listaItemsArray.forEach(it => {
      msj += ` • ${it.cantidad}x ${it.nombre} ${it.esPersonalizado ? '(Bajo Pedido)' : ''}\n`;
    });
    if (esDeliveryGratis) {
      msj += `\n🛵 *Tarifa Delivery Chofer:* ¡GRATIS! ($0.00 - Promo Flash Nirgua >20 productos)\n`;
    } else {
      msj += `\n🛵 *Tarifa Delivery Chofer:* $1.00\n`;
    }
    msj += `💰 *TOTAL A PAGAR:* $${montoTotalCalculado.toFixed(2)}\n`;
    msj += `💳 *Forma de Pago:* ${metodoPagoActual} (Pago Contra Entrega)\n`;
    if (metodoPagoActual === 'Efectivo' && montoPaga) msj += `💵 *Paga con:* ${montoPaga} (Llevar vuelto)\n`;
  }

  const urlWA = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(msj)}`;
  const modal = document.getElementById('modal-exito');
  const barra = document.getElementById('barra-progreso-relleno');
  const cohete = document.getElementById('cohete-desplazable');
  const enlaceDirecto = document.getElementById('enlace-directo-wa');
  const txtNumOrd = document.getElementById('txt-num-orden-exito');
  const txtEstadoCarga = document.getElementById('txt-estado-carga');

  if (txtNumOrd) txtNumOrd.innerText = numOrden;
  if (txtEstadoCarga) txtEstadoCarga.innerText = "Registrando tu orden con los choferes...";
  if (enlaceDirecto) enlaceDirecto.href = urlWA;
  modal.classList.remove('hidden');

  let progreso = 0;
  const intervalo = setInterval(() => {
    progreso += 5;
    if (progreso > 100) progreso = 100;
    if (barra) barra.style.width = `${progreso}%`;
    if (cohete) cohete.style.left = `calc(${Math.min(progreso, 88)}% - 5px)`;
    if (progreso === 100) {
      clearInterval(intervalo);
      if (txtEstadoCarga) txtEstadoCarga.innerText = "✓ ¡Orden registrada! Choferes de Nirgua alertados.";
      if (enlaceDirecto) enlaceDirecto.classList.remove('hidden');
      reproducirSonidoAlerta('exito');

      setTimeout(() => {
        const modExito = document.getElementById('modal-exito');
        if (modExito && !modExito.classList.contains('hidden')) {
          cerrarModalExitoYAbrirRastreo();
        }
      }, 2200);
    }
  }, 35);
}

// ================= SINCRONIZACIÓN FIREBASE =================
function sincronizarTiendasDesdeFirebase() {
  if (!firebaseActivo || !db) return;
  db.ref('tiendas').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      Object.keys(val).forEach(k => {
        infoLocales[k] = { ...(infoLocales[k] || {}), ...val[k], id: k };
      });
      renderizarLocalesComerciales();
      if (tiendaAbiertaActualId && infoLocales[tiendaAbiertaActualId]) {
        abrirModalLocal(tiendaAbiertaActualId);
      }
    }
  });

  db.ref('productos_tiendas').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      productosDinamicosTiendas = val;
      reconstruirMapaProductos();
      if (tiendaAbiertaActualId) {
        abrirModalLocal(tiendaAbiertaActualId);
      }
    }
  });
}

function sincronizarCatalogoFlashDesdeFirebase() {
  if (!firebaseActivo || !db) return;
  db.ref('catalogo_flash').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      let cambio = false;
      Object.keys(val).forEach(id => {
        const itemFB = val[id];
        const nuevoPrecio = parseFloat(itemFB.precioBase);
        const esEliminado = itemFB.eliminado === true;

        if (mapaProductos[id]) {
          const itemExistente = mapaProductos[id];
          if (esEliminado) {
            delete mapaProductos[id];
            const cat = itemExistente.categoria;
            if (productos[cat]) {
              productos[cat] = productos[cat].filter(p => p.id !== id);
            }
            cambio = true;
            return;
          }

          if (!isNaN(nuevoPrecio) && itemExistente.precioBase !== nuevoPrecio) {
            itemExistente.precioBase = nuevoPrecio;
            cambio = true;
          }
          if (itemFB.nombre && itemExistente.nombre !== itemFB.nombre) {
            itemExistente.nombre = itemFB.nombre;
            cambio = true;
          }
          if (itemFB.badge !== undefined && itemExistente.badge !== itemFB.badge) {
            itemExistente.badge = itemFB.badge;
            cambio = true;
          }
          if (itemFB.imagen && itemExistente.imagen !== itemFB.imagen) {
            itemExistente.imagen = itemFB.imagen;
            cambio = true;
          }
          if (itemFB.sub !== undefined && itemExistente.sub !== itemFB.sub) {
            itemExistente.sub = itemFB.sub;
            cambio = true;
          }
          if (itemFB.esGranel !== undefined && itemExistente.esGranel !== itemFB.esGranel) {
            itemExistente.esGranel = itemFB.esGranel;
            cambio = true;
          }
          if (itemFB.disponible !== undefined && itemExistente.disponible !== itemFB.disponible) {
            itemExistente.disponible = itemFB.disponible;
            cambio = true;
          }
          if (itemFB.categoria && itemExistente.categoria !== itemFB.categoria) {
            const catVieja = itemExistente.categoria;
            if (productos[catVieja]) {
              productos[catVieja] = productos[catVieja].filter(p => p.id !== id);
            }
            const catNueva = itemFB.categoria;
            if (!productos[catNueva]) productos[catNueva] = [];
            itemExistente.categoria = catNueva;
            productos[catNueva].push(itemExistente);
            cambio = true;
          }
        } else {
          if (!esEliminado) {
            const cat = itemFB.categoria || 'viveres';
            if (!productos[cat]) productos[cat] = [];
            const nuevoItem = {
              id: id,
              nombre: itemFB.nombre || 'Nuevo Producto',
              precioBase: !isNaN(nuevoPrecio) ? nuevoPrecio : 1.0,
              categoria: cat,
              sub: itemFB.sub || '',
              badge: itemFB.badge || '',
              imagen: itemFB.imagen || 'img/logo.jfif',
              esGranel: !!itemFB.esGranel,
              disponible: itemFB.disponible !== false
            };
            if (nuevoItem.esGranel) {
              nuevoItem.unidadMedida = 'g';
              nuevoItem.minGranel = itemFB.minGranel || 200;
              nuevoItem.maxGranel = itemFB.maxGranel || 3000;
              nuevoItem.pasoGranel = itemFB.pasoGranel || 100;
              nuevoItem.defGranel = itemFB.defGranel || 500;
            }
            productos[cat].push(nuevoItem);
            mapaProductos[id] = nuevoItem;
            cambio = true;
          }
        }
      });
      if (cambio) renderizarCatalogo(false);
    }
  });
}

// ================= RASTREO SATELITAL EN VIVO CLIENTE (CON OSRM Y HUD) =================
let pedidoActivoClienteId = localStorage.getItem('pedidosflash_pedido_activo') || null;
let mapaRastreoClienteInstance = null;
let marcadorClienteOrigRef = null;
let marcadorClienteDestRef = null;
let marcadorClienteChoferRef = null;
let lineaRutaChoferOSRM = null;
let listenerGpsChoferActivo = null;
let listenerPedidoActivoRef = null;
let datosUltimoPedido = null;
let datosUltimoGpsChofer = null;

function activarRastreoPedidoCliente(pedidoId) {
  if (!pedidoId || !db) return;
  pedidoActivoClienteId = pedidoId;
  localStorage.setItem('pedidosflash_pedido_activo', pedidoId);

  const banner = document.getElementById('banner-flotante-rastreo');
  if (banner) banner.classList.remove('hidden');

  const dotP = document.getElementById('nav-pulse-dot');
  const dotS = document.getElementById('nav-static-dot');
  const btnR = document.getElementById('nav-btn-rastreo');
  if (dotP) dotP.classList.remove('hidden');
  if (dotS) dotS.classList.remove('hidden');
  if (btnR) btnR.classList.add('text-accent-emerald');

  if (listenerPedidoActivoRef) listenerPedidoActivoRef.off();
  listenerPedidoActivoRef = db.ref(`pedidos/${pedidoId}`);
  listenerPedidoActivoRef.on('value', (snap) => {
    const p = snap.val();
    if (!p) return;
    actualizarVistaRastreoCliente(p);
  });
}

function cerrarModalExitoYAbrirRastreo() {
  document.getElementById('modal-exito').classList.add('hidden');
  abrirModalRastreoCliente();
}

function abrirModalRastreoCliente() {
  document.getElementById('modal-rastreo-cliente').classList.remove('hidden');
  setTimeout(() => {
    if (typeof L !== 'undefined') {
      if (!mapaRastreoClienteInstance) {
        mapaRastreoClienteInstance = L.map('mapa-rastreo-cliente-box', { zoomControl: false, attributionControl: false }).setView([10.1506, -68.5668], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapaRastreoClienteInstance);
      } else {
        mapaRastreoClienteInstance.invalidateSize();
      }
    }
    if (pedidoActivoClienteId && db) {
      db.ref(`pedidos/${pedidoActivoClienteId}`).once('value').then(snap => {
        const p = snap.val();
        if (p) actualizarVistaRastreoCliente(p);
      });
    }
  }, 200);
  if (window.lucide) lucide.createIcons();
}

function cerrarModalRastreoCliente() {
  document.getElementById('modal-rastreo-cliente').classList.add('hidden');
}

let ultimoEstadoConocidoPedido = null;
let ultimoChoferNotificado = null;

function actualizarVistaRastreoCliente(p) {
  datosUltimoPedido = p;
  const estadoAnterior = ultimoEstadoConocidoPedido;
  ultimoEstadoConocidoPedido = p.estado;

  const numOrdEl = document.getElementById('rastreo-cliente-num-orden');
  const badgeEst = document.getElementById('rastreo-badge-estado');
  const txtEst = document.getElementById('rastreo-texto-estado');
  const cajaChofer = document.getElementById('rastreo-caja-chofer');
  const cajaCancelar = document.getElementById('rastreo-caja-cancelar');

  if (numOrdEl) numOrdEl.innerText = p.orden || `#FLASH`;

  const puedeCancelar = (p.estado === 'pendiente' || p.estado === 'aceptado' || p.estado === 'en_local' || p.estado === 'en_camino');
  if (cajaCancelar) {
    if (puedeCancelar) cajaCancelar.classList.remove('hidden');
    else cajaCancelar.classList.add('hidden');
  }

  if (p.estado === 'pendiente') {
    if (badgeEst) {
      badgeEst.className = "inline-block px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30";
      badgeEst.innerText = "Buscando Chofer...";
    }
    if (txtEst) txtEst.innerText = "Tu orden fue enviada. En breve un chofer autorizado la tomará.";
    if (cajaChofer) cajaChofer.classList.add('hidden');
  } else if (p.estado === 'aceptado') {
    if (badgeEst) {
      badgeEst.className = "inline-block px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/30";
      badgeEst.innerText = "Chofer Asignado (En Tienda)";
    }
    if (txtEst) txtEst.innerText = `${p.chofer || 'El chofer'} está en el comercio verificando los productos.`;
    if (cajaChofer) cajaChofer.classList.remove('hidden');

    if (p.chofer && p.chofer !== 'Sin Asignar' && (estadoAnterior === 'pendiente' || ultimoChoferNotificado !== p.chofer)) {
      ultimoChoferNotificado = p.chofer;
      dispararAlertaChoferAcepto(p);
    }
  } else if (p.estado === 'en_local') {
    if (badgeEst) {
      badgeEst.className = "inline-block px-3 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/30";
      badgeEst.innerText = "Chofer en el Comercio";
    }
    if (txtEst) txtEst.innerText = `${p.chofer || 'El chofer'} ya llegó a ${p.tiendaNombre || 'la tienda'} y está retirando tus artículos.`;
    if (cajaChofer) cajaChofer.classList.remove('hidden');

    if (estadoAnterior === 'aceptado') {
      reproducirSonidoAlerta('info');
      mostrarToast(`🏪 ${p.chofer || 'Tu chofer'} llegó al comercio a retirar tus productos`, "En Comercio", "info");
    }
  } else if (p.estado === 'en_camino') {
    if (badgeEst) {
      badgeEst.className = "inline-block px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse";
      badgeEst.innerText = "¡Tu pedido va en camino!";
    }
    if (txtEst) txtEst.innerText = `${p.chofer || 'El chofer'} ya salió hacia tu destino.`;
    if (cajaChofer) cajaChofer.classList.remove('hidden');

    if (estadoAnterior !== 'en_camino') {
      reproducirSonidoAlerta('chofer_acepto');
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      mostrarToast(`🚀 ¡${p.chofer || 'Tu chofer'} va en camino a tu dirección!`, "En Camino", "success");
    }
  } else if (p.estado === 'entregado') {
    if (badgeEst) {
      badgeEst.className = "inline-block px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950";
      badgeEst.innerText = "¡Entregado con Éxito!";
    }
    if (txtEst) txtEst.innerText = `¡Gracias por tu compra en Pedidos Flash Nirgua! ⭐`;

    const dotP = document.getElementById('nav-pulse-dot');
    const dotS = document.getElementById('nav-static-dot');
    if (dotP) dotP.classList.add('hidden');
    if (dotS) dotS.classList.add('hidden');
    const banner = document.getElementById('banner-flotante-rastreo');
    if (banner) banner.classList.add('hidden');

    if (!p.calificacionRegistrada) {
      setTimeout(abrirModalCalificacion, 600);
    }
  } else if (p.estado === 'cancelado') {
    if (badgeEst) {
      badgeEst.className = "inline-block px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40";
      badgeEst.innerText = "Pedido Cancelado ✖";
    }
    if (txtEst) txtEst.innerText = p.motivoCancelacion ? `Motivo: ${p.motivoCancelacion}` : "Este pedido fue cancelado.";
    if (cajaChofer) cajaChofer.classList.add('hidden');
    if (cajaCancelar) cajaCancelar.classList.add('hidden');

    const dotP = document.getElementById('nav-pulse-dot');
    const dotS = document.getElementById('nav-static-dot');
    if (dotP) dotP.classList.add('hidden');
    if (dotS) dotS.classList.add('hidden');
    const banner = document.getElementById('banner-flotante-rastreo');
    if (banner) banner.classList.add('hidden');
    if (localStorage.getItem('pedidosflash_pedido_activo') === pedidoActivoClienteId) {
      localStorage.removeItem('pedidosflash_pedido_activo');
    }
  }

  if (p.chofer && p.chofer !== 'Sin Asignar') {
    const nomCh = document.getElementById('rastreo-nombre-chofer');
    if (nomCh) nomCh.innerText = p.chofer;
    const vehCh = document.getElementById('rastreo-vehiculo-chofer');
    if (vehCh) vehCh.innerText = p.vehiculoRequerido || 'Repartidor';
    if (p.choferTelefono) {
      const btnLlamar = document.getElementById('rastreo-btn-llamar-chofer');
      if (btnLlamar) btnLlamar.href = `tel:${p.choferTelefono}`;
      const btnWa = document.getElementById('rastreo-btn-wa-chofer');
      if (btnWa) btnWa.href = `https://wa.me/${normalizarTelefono(p.choferTelefono)}?text=${encodeURIComponent(`Hola ${p.chofer}, te escribo con respecto a mi pedido/viaje ${p.orden || ''}`)}`;
      escucharGpsChoferEnVivo(p.choferTelefono);
    }
  }

  actualizarMapaClienteConPuntos(p);
  if (window.lucide) lucide.createIcons();
}

function escucharGpsChoferEnVivo(telefonoChofer) {
  if (!telefonoChofer || !db) return;
  const tel = normalizarTelefono(telefonoChofer);
  if (listenerGpsChoferActivo === tel) return;
  listenerGpsChoferActivo = tel;

  db.ref(`choferes/${tel}/gps`).on('value', (snap) => {
    const gps = snap.val();
    if (gps && gps.lat && gps.lng) {
      datosUltimoGpsChofer = { lat: parseFloat(gps.lat), lng: parseFloat(gps.lng) };
      if (mapaRastreoClienteInstance && typeof L !== 'undefined') {
        const pos = [datosUltimoGpsChofer.lat, datosUltimoGpsChofer.lng];
        if (marcadorClienteChoferRef) {
          marcadorClienteChoferRef.setLatLng(pos);
        } else {
          marcadorClienteChoferRef = L.marker(pos, {
            icon: L.divIcon({
              className: 'custom-pin',
              html: `<div class="pin-radar-chofer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>`,
              iconSize: [28, 28]
            })
          }).addTo(mapaRastreoClienteInstance).bindPopup("Tu Chofer (GPS en Vivo)").openPopup();
        }

        if (datosUltimoPedido) {
          const destLat = datosUltimoPedido.lat || datosUltimoPedido.destinoLat || 10.1506;
          const destLng = datosUltimoPedido.lng || datosUltimoPedido.destinoLng || -68.5668;
          calcularYRutaChoferOSRM(datosUltimoGpsChofer.lat, datosUltimoGpsChofer.lng, destLat, destLng);
        }
      }
    }
  });
}

function calcularYRutaChoferOSRM(cLat, cLng, dLat, dLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${cLng},${cLat};${dLng},${dLat}?overview=full&geometries=geojson`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data && data.routes && data.routes.length > 0) {
        const r = data.routes[0];
        const coords = r.geometry.coordinates.map(c => [c[1], c[0]]);

        if (lineaRutaChoferOSRM && mapaRastreoClienteInstance) {
          mapaRastreoClienteInstance.removeLayer(lineaRutaChoferOSRM);
        }

        if (mapaRastreoClienteInstance && typeof L !== 'undefined') {
          lineaRutaChoferOSRM = L.polyline(coords, {
            color: '#00e676',
            weight: 5,
            opacity: 0.9,
            dashArray: null
          }).addTo(mapaRastreoClienteInstance);
        }

        const distMetros = r.distance;
        const distTxt = distMetros >= 1000 ? `${(distMetros / 1000).toFixed(1)} km` : `${Math.round(distMetros)} m`;
        const durSegundos = r.duration;
        const etaMinutos = Math.max(1, Math.round(durSegundos / 60));

        const distEl = document.getElementById('rastreo-distancia-val');
        const etaEl = document.getElementById('rastreo-eta-val');
        if (distEl) distEl.innerText = distTxt;
        if (etaEl) etaEl.innerText = `${etaMinutos} min aprox`;
      }
    })
    .catch(() => {});
}

function centrarEnChofer() {
  if (marcadorClienteChoferRef && mapaRastreoClienteInstance) {
    mapaRastreoClienteInstance.setView(marcadorClienteChoferRef.getLatLng(), 16);
  } else if (marcadorClienteDestRef && mapaRastreoClienteInstance) {
    mapaRastreoClienteInstance.setView(marcadorClienteDestRef.getLatLng(), 15);
  }
}

function verRutaCompleta() {
  if (!mapaRastreoClienteInstance || typeof L === 'undefined') return;
  const puntos = [];
  if (marcadorClienteChoferRef) puntos.push(marcadorClienteChoferRef.getLatLng());
  if (marcadorClienteOrigRef) puntos.push(marcadorClienteOrigRef.getLatLng());
  if (marcadorClienteDestRef) puntos.push(marcadorClienteDestRef.getLatLng());
  if (puntos.length >= 2) {
    mapaRastreoClienteInstance.fitBounds(L.latLngBounds(puntos), { padding: [35, 35] });
  }
}

function actualizarMapaClienteConPuntos(p) {
  if (!mapaRastreoClienteInstance || typeof L === 'undefined') return;
  const latDest = p.lat ? parseFloat(p.lat) : (p.destinoLat ? parseFloat(p.destinoLat) : 10.1506);
  const lngDest = p.lng ? parseFloat(p.lng) : (p.destinoLng ? parseFloat(p.destinoLng) : -68.5668);
  const latOrig = p.origenLat ? parseFloat(p.origenLat) : 10.1506;
  const lngOrig = p.origenLng ? parseFloat(p.origenLng) : -68.5668;

  if (marcadorClienteOrigRef) mapaRastreoClienteInstance.removeLayer(marcadorClienteOrigRef);
  if (marcadorClienteDestRef) mapaRastreoClienteInstance.removeLayer(marcadorClienteDestRef);

  marcadorClienteOrigRef = L.marker([latOrig, lngOrig], {
    icon: L.divIcon({ className: 'custom-pin', html: '<div class="pin-jewel-a">A</div>', iconSize: [28, 28] })
  }).addTo(mapaRastreoClienteInstance).bindPopup(`🏪 Tienda: ${p.tiendaNombre || 'Comercio'}`);

  marcadorClienteDestRef = L.marker([latDest, lngDest], {
    icon: L.divIcon({
      className: 'custom-pin',
      html: `<div class="pin-persona-cliente">
               <div class="pin-persona-onda"></div>
               <div class="pin-persona-cuerpo">
                 <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
               </div>
               <span class="pin-persona-badge-tu">TÚ</span>
             </div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    })
  }).addTo(mapaRastreoClienteInstance).bindPopup("👤 ¡Tu Ubicación Exacta!");

  const bounds = L.latLngBounds([[latOrig, lngOrig], [latDest, lngDest]]);
  mapaRastreoClienteInstance.fitBounds(bounds, { padding: [25, 25] });
}

// ================= SISTEMA DE CALIFICACIÓN =================
let estrellasCalificacionActual = 5;
function abrirModalCalificacion() {
  document.getElementById('modal-calificar-servicio').classList.remove('hidden');
  fijarEstrellasCalificacion(5);
  if (window.lucide) lucide.createIcons();
}

function cerrarModalCalificacion() {
  document.getElementById('modal-calificar-servicio').classList.add('hidden');
  localStorage.removeItem('pedidosflash_pedido_activo');
  pedidoActivoClienteId = null;
}

function fijarEstrellasCalificacion(n) {
  estrellasCalificacionActual = n;
  for (let i = 1; i <= 5; i++) {
    const star = document.getElementById(`estrella-${i}`);
    if (star) {
      if (i <= n) {
        star.classList.add('fill-amber-400');
        star.classList.remove('text-slate-600');
      } else {
        star.classList.remove('fill-amber-400');
        star.classList.add('text-slate-600');
      }
    }
  }
  const desc = { 1: "Muy deficiente (1/5)", 2: "Regular (2/5)", 3: "Aceptable (3/5)", 4: "Buen servicio (4/5)", 5: "¡Excelente servicio! (5/5)" };
  document.getElementById('calificar-lbl-texto').innerText = desc[n] || `${n}/5`;
}

function guardarCalificacionServicio() {
  const comentario = document.getElementById('input-comentario-calificacion').value.trim();
  if (pedidoActivoClienteId && db) {
    db.ref(`pedidos/${pedidoActivoClienteId}`).update({
      calificacion: estrellasCalificacionActual,
      comentarioCalificacion: comentario,
      calificacionRegistrada: true
    });
  }
  mostrarToast("¡Muchas gracias por calificar a nuestro chofer!", "Gracias", "success");
  cerrarModalCalificacion();
}

// ================= SÍNTESIS DE AUDIO PARA ALERTAS IN-APP =================
function reproducirSonidoAlerta(tipo = 'exito') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (tipo === 'chofer_acepto') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.setValueAtTime(659.25, t + 0.12);
      osc.frequency.setValueAtTime(783.99, t + 0.24);
      osc.frequency.setValueAtTime(1046.50, t + 0.36);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t);
      osc.frequency.setValueAtTime(880.00, t + 0.14);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    }
  } catch (e) {
    console.warn("Audio Context alert:", e);
  }
}

// ================= ALERTA IN-APP: CHOFER ACEPTÓ EL PEDIDO =================
function dispararAlertaChoferAcepto(p) {
  reproducirSonidoAlerta('chofer_acepto');
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);

  const modalAlert = document.getElementById('modal-chofer-acepto');
  if (modalAlert) {
    const nomEl = document.getElementById('chofer-acepto-nombre');
    const nomCard = document.getElementById('chofer-acepto-nombre-card');
    const telCard = document.getElementById('chofer-acepto-tel-card');
    const vehEl = document.getElementById('chofer-acepto-vehiculo');
    const btnWa = document.getElementById('chofer-acepto-btn-wa');

    const nombreCh = p.chofer || 'Chofer Flash';
    if (nomEl) nomEl.innerText = nombreCh;
    if (nomCard) nomCard.innerText = nombreCh;
    if (telCard) telCard.innerText = p.choferTelefono || 'Asignado en Vivo';
    if (vehEl) vehEl.innerText = p.vehiculoRequerido || '🛵 Moto Flash';
    if (btnWa && p.choferTelefono) {
      btnWa.href = `https://wa.me/${normalizarTelefono(p.choferTelefono)}?text=${encodeURIComponent(`Hola ${nombreCh}, te escribo con respecto a mi pedido ${p.orden || ''}`)}`;
    }

    modalAlert.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  mostrarToast(`🎉 ¡Tu chofer ${p.chofer} ha aceptado tu pedido!`, "Chofer Asignado", "success");
}

function verRastreoDesdeAlerta() {
  cerrarModalChoferAcepto();
  abrirModalRastreoCliente();
}

function cerrarModalChoferAcepto() {
  const modal = document.getElementById('modal-chofer-acepto');
  if (modal) modal.classList.add('hidden');
}

// ================= GESTIÓN DEL HISTORIAL DE PEDIDOS CLIENTE =================
let tabHistorialActiva = 'activos';

function guardarEnHistorialCliente(pedido) {
  try {
    let historial = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
    historial = historial.filter(h => h.id !== pedido.id && h.orden !== pedido.orden);
    historial.unshift(pedido);
    if (historial.length > 40) historial = historial.slice(0, 40);
    localStorage.setItem('pedidosflash_historial', JSON.stringify(historial));
  } catch (e) {
    console.error("Error al guardar historial local:", e);
  }
}

function abrirModalHistorialPedidos() {
  const modal = document.getElementById('modal-historial-pedidos');
  if (modal) modal.classList.remove('hidden');
  cargarYRenderizarHistorial();
  if (window.lucide) lucide.createIcons();
}

function cerrarModalHistorialPedidos() {
  const modal = document.getElementById('modal-historial-pedidos');
  if (modal) modal.classList.add('hidden');
}

function cerrarModalExitoYAbrirHistorial() {
  const modal = document.getElementById('modal-exito');
  if (modal) modal.classList.add('hidden');
  abrirModalHistorialPedidos();
}

function filtrarTabHistorial(tab) {
  tabHistorialActiva = tab;
  const btnActivos = document.getElementById('tab-historial-activos');
  const btnTodos = document.getElementById('tab-historial-todos');
  if (tab === 'activos') {
    if (btnActivos) btnActivos.className = "btn-tactil py-2 text-center rounded-xl text-xs font-black bg-gradient-to-r from-accent-cyan to-brand-600 text-slate-950 shadow-md";
    if (btnTodos) btnTodos.className = "btn-tactil py-2 text-center rounded-xl text-xs font-bold text-slate-400 hover:text-white";
  } else {
    if (btnTodos) btnTodos.className = "btn-tactil py-2 text-center rounded-xl text-xs font-black bg-gradient-to-r from-accent-cyan to-brand-600 text-slate-950 shadow-md";
    if (btnActivos) btnActivos.className = "btn-tactil py-2 text-center rounded-xl text-xs font-bold text-slate-400 hover:text-white";
  }
  let historial = [];
  try {
    historial = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
  } catch (e) {}
  renderizarTarjetasHistorial(historial);
}

function cargarYRenderizarHistorial() {
  const contenedor = document.getElementById('lista-pedidos-historial-contenedor');
  if (!contenedor) return;

  let historialLocal = [];
  try {
    historialLocal = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
  } catch (e) {
    historialLocal = [];
  }

  renderizarTarjetasHistorial(historialLocal);

  if (firebaseActivo && db) {
    const telUsuario = usuarioActivo ? (usuarioActivo.telefonoOriginal || usuarioActivo.telefono) : null;
    db.ref('pedidos').once('value').then(snap => {
      const todos = snap.val() || {};
      const combinadosMap = {};

      historialLocal.forEach(h => { if (h.id) combinadosMap[h.id] = h; });

      Object.keys(todos).forEach(k => {
        const p = todos[k];
        if (!p) return;
        const coincideId = combinadosMap[k] !== undefined || historialLocal.some(h => h.id === k || h.orden === p.orden);
        const coincideTel = telUsuario && p.telefono && (
          limpiarTelefonoId(p.telefono) === limpiarTelefonoId(telUsuario) ||
          normalizarTelefono(p.telefono) === normalizarTelefono(telUsuario)
        );

        if (coincideId || coincideTel) {
          combinadosMap[k] = {
            id: k,
            orden: p.orden || `#FLASH-${k.substring(k.length - 4)}`,
            tipoServicio: p.tipoServicio || 'delivery',
            fecha: p.fecha || (combinadosMap[k] ? combinadosMap[k].fecha : new Date().toISOString()),
            total: p.total || p.totalFinalCliente || 0,
            direccion: p.direccion || '',
            estado: p.estado || 'pendiente',
            tiendaNombre: p.tiendaNombre || (p.tipoServicio === 'transporte' ? 'Transporte Flash' : 'Supermercado Flash'),
            chofer: p.chofer || '',
            choferTelefono: p.choferTelefono || '',
            items: p.items || []
          };
        }
      });

      const listaFinal = Object.values(combinadosMap);
      listaFinal.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      localStorage.setItem('pedidosflash_historial', JSON.stringify(listaFinal));
      renderizarTarjetasHistorial(listaFinal);
    }).catch(() => {
      renderizarTarjetasHistorial(historialLocal);
    });
  }
}

function renderizarTarjetasHistorial(pedidos) {
  const contenedor = document.getElementById('lista-pedidos-historial-contenedor');
  if (!contenedor) return;
  contenedor.innerHTML = "";

  const pedidosFiltrados = (pedidos || []).filter(p => {
    if (!p) return false;
    const esActivo = p.estado === 'pendiente' || p.estado === 'aceptado' || p.estado === 'en_local' || p.estado === 'en_camino';
    if (tabHistorialActiva === 'activos') return esActivo;
    return true;
  });

  if (pedidosFiltrados.length === 0) {
    contenedor.innerHTML = `
      <div class="text-center py-8 bg-slate-950/80 rounded-2xl border border-slate-800 p-4 space-y-2">
        <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 text-accent-cyan flex items-center justify-center mx-auto border border-indigo-500/20">
          <i data-lucide="${tabHistorialActiva === 'activos' ? 'radar' : 'package-search'}" class="w-5 h-5"></i>
        </div>
        <h4 class="text-xs font-bold text-white">${tabHistorialActiva === 'activos' ? 'No tienes pedidos activos' : 'Aún no tienes historial'}</h4>
        <p class="text-[10px] text-slate-400">Tus pedidos aparecerán aquí para que puedas rastrearlos en tiempo real.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  pedidosFiltrados.forEach(p => {
    const esActivo = p.estado === 'pendiente' || p.estado === 'aceptado' || p.estado === 'en_local' || p.estado === 'en_camino';
    const badge = obtenerBadgeEstadoPedido(p.estado);
    const fechaTxt = formatearFechaHistorial(p.fecha);
    let resumenItems = "";
    if (p.items && Array.isArray(p.items) && p.items.length > 0) {
      resumenItems = p.items.map(i => `${i.cantidad || 1}x ${i.nombre}`).join(', ');
    } else {
      resumenItems = p.tipoServicio === 'transporte' ? 'Servicio de Transporte Flash' : 'Pedido de Artículos';
    }

    contenedor.innerHTML += `
      <div class="bg-slate-950/90 border ${esActivo ? 'border-accent-cyan/50 shadow-[0_0_15px_rgba(0,242,254,0.15)]' : 'border-slate-800'} rounded-2xl p-3 space-y-2">
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div>
            <span class="text-[10px] font-mono font-bold text-accent-cyan block">${p.orden || '#FLASH'}</span>
            <span class="text-[9px] text-slate-400">${fechaTxt}</span>
          </div>
          <span class="text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badge.clase}">${badge.texto}</span>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-white truncate">${p.tiendaNombre || 'Comercio Flash'}</span>
            <span class="font-black text-accent-yellow font-mono">$${parseFloat(p.total || 0).toFixed(2)}</span>
          </div>
          <p class="text-[10px] text-slate-300 truncate">${resumenItems}</p>
          ${p.direccion ? `<p class="text-[9px] text-slate-400 truncate">📍 ${p.direccion}</p>` : ''}
          ${p.chofer && p.chofer !== 'Sin Asignar' ? `
            <div class="flex items-center gap-1.5 text-[10px] text-accent-cyan font-semibold pt-0.5">
              <i data-lucide="user" class="w-3.5 h-3.5"></i> <span>Chofer: ${p.chofer}</span>
            </div>
          ` : ''}
        </div>

        <div class="pt-1 flex gap-2">
          ${esActivo ? `
            <button onclick="cerrarModalHistorialPedidos(); activarRastreoPedidoCliente('${p.id}'); abrirModalRastreoCliente();" class="btn-tactil flex-1 bg-gradient-to-r from-accent-emerald to-accent-cyan text-slate-950 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-glow-emerald">
              <i data-lucide="navigation-2" class="w-3.5 h-3.5 fill-slate-950"></i>
              <span>SEGUIR EN VIVO (GPS)</span>
            </button>
            <button onclick="abrirModalCancelarPedido('${p.id}')" class="btn-tactil bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 font-black py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1">
              <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
              <span>Cancelar</span>
            </button>
          ` : `
            <button onclick="cerrarModalHistorialPedidos(); activarRastreoPedidoCliente('${p.id}'); abrirModalRastreoCliente();" class="btn-tactil flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1">
              <i data-lucide="eye" class="w-3.5 h-3.5 text-accent-cyan"></i>
              <span>Ver Hoja</span>
            </button>
            <button onclick="repetirPedidoDesdeHistorial('${p.id}')" class="btn-tactil bg-accent-magenta/20 hover:bg-accent-magenta/30 text-accent-magenta border border-accent-magenta/40 font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Repetir</span>
            </button>
          `}
        </div>
      </div>
    `;
  });

  if (window.lucide) lucide.createIcons();
}

function formatearFechaHistorial(fechaIso) {
  if (!fechaIso) return '';
  try {
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    const ahora = new Date();
    const esHoy = d.getDate() === ahora.getDate() && d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };
    const horaStr = d.toLocaleTimeString('es-VE', opcionesHora);
    if (esHoy) return `Hoy, ${horaStr}`;
    const opcionesFecha = { day: 'numeric', month: 'short' };
    return `${d.toLocaleDateString('es-VE', opcionesFecha)}, ${horaStr}`;
  } catch (e) {
    return '';
  }
}

function obtenerBadgeEstadoPedido(estado) {
  switch (estado) {
    case 'pendiente':
      return { texto: 'Buscando Chofer ⏳', clase: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'aceptado':
      return { texto: 'Chofer Asignado 🛵', clase: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    case 'en_local':
      return { texto: 'Chofer en Comercio 🏪', clase: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    case 'en_camino':
      return { texto: 'En Camino a Casa 🚀', clase: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' };
    case 'entregado':
      return { texto: 'Entregado ✓', clase: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' };
    case 'cancelado':
      return { texto: 'Cancelado ✖', clase: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    default:
      return { texto: estado || 'Procesando', clase: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}

function repetirPedidoDesdeHistorial(id) {
  let historial = [];
  try {
    historial = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
  } catch (e) {}
  const p = historial.find(h => h.id === id);
  if (!p || !p.items || !Array.isArray(p.items) || p.items.length === 0) {
    mostrarToast("No hay artículos para repetir en este pedido", "Aviso", "error");
    return;
  }

  p.items.forEach(it => {
    if (it.id && mapaProductos[it.id]) {
      const prod = mapaProductos[it.id];
      agregarAlCarritoDirecto(prod.id, prod.nombre, prod.precioBase, it.cantidad || 1, prod.tiendaId || prod.local);
    } else {
      const idTemp = it.id || `rep_${Date.now()}_${Math.random()}`;
      carrito[idTemp] = {
        nombre: it.nombre,
        precio: it.precio || 0,
        cantidad: it.cantidad || 1,
        esPersonalizado: it.esPersonalizado || false,
        tiendaId: it.tiendaId || null,
        tiendaNombre: it.tiendaNombre || null
      };
    }
  });

  actualizarTotales();
  cerrarModalHistorialPedidos();
  abrirModalCarrito();
  mostrarToast("¡Artículos agregados a tu canasta!", "Pedido Repetido", "success");
}

// ================= CANCELACIÓN DE PEDIDO POR EL CLIENTE =================
let pedidoIdACancelar = null;

function abrirModalCancelarPedido(pedidoId) {
  const idObjetivo = pedidoId || pedidoActivoClienteId;
  if (!idObjetivo) {
    mostrarToast("No se encontró un pedido activo para cancelar", "Aviso", "error");
    return;
  }
  pedidoIdACancelar = idObjetivo;

  let ordenTexto = "#FLASH";
  try {
    const historial = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
    const encontrado = historial.find(h => h.id === idObjetivo);
    if (encontrado && encontrado.orden) {
      ordenTexto = encontrado.orden;
    } else if (datosUltimoPedido && datosUltimoPedido.orden) {
      ordenTexto = datosUltimoPedido.orden;
    }
  } catch (e) {}

  const numEl = document.getElementById('cancelar-pedido-num-orden');
  if (numEl) numEl.innerText = ordenTexto;
  const inpMotivo = document.getElementById('input-motivo-cancelacion');
  if (inpMotivo) inpMotivo.value = "";

  const modal = document.getElementById('modal-cancelar-pedido');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}
window.abrirModalCancelarPedido = abrirModalCancelarPedido;

function cerrarModalCancelarPedido() {
  const modal = document.getElementById('modal-cancelar-pedido');
  if (modal) modal.classList.add('hidden');
  pedidoIdACancelar = null;
}
window.cerrarModalCancelarPedido = cerrarModalCancelarPedido;

function seleccionarMotivoCancelacion(motivo) {
  const inp = document.getElementById('input-motivo-cancelacion');
  if (inp) inp.value = motivo;
}
window.seleccionarMotivoCancelacion = seleccionarMotivoCancelacion;

async function confirmarCancelacionPedido() {
  if (!pedidoIdACancelar) return;
  const idCancelar = pedidoIdACancelar;
  const motivoInput = document.getElementById('input-motivo-cancelacion');
  const motivo = (motivoInput && motivoInput.value.trim()) ? motivoInput.value.trim() : "Cancelado por el cliente";

  const btn = document.getElementById('btn-confirmar-cancelar-pedido');
  const htmlOrig = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Cancelando...`;
  }

  try {
    if (firebaseActivo && db) {
      await db.ref(`pedidos/${idCancelar}`).update({
        estado: 'cancelado',
        motivoCancelacion: motivo,
        canceladoPor: 'cliente',
        fechaCancelacion: new Date().toISOString()
      });
    }

    try {
      let historial = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
      historial = historial.map(h => {
        if (h.id === idCancelar) {
          return { ...h, estado: 'cancelado', motivoCancelacion: motivo };
        }
        return h;
      });
      localStorage.setItem('pedidosflash_historial', JSON.stringify(historial));
      renderizarTarjetasHistorial(historial);
    } catch (e) {}

    if (pedidoActivoClienteId === idCancelar || localStorage.getItem('pedidosflash_pedido_activo') === idCancelar) {
      if (listenerPedidoActivoRef) {
        listenerPedidoActivoRef.off();
        listenerPedidoActivoRef = null;
      }
      localStorage.removeItem('pedidosflash_pedido_activo');
      pedidoActivoClienteId = null;

      const dotP = document.getElementById('nav-pulse-dot');
      const dotS = document.getElementById('nav-static-dot');
      const btnR = document.getElementById('nav-btn-rastreo');
      if (dotP) dotP.classList.add('hidden');
      if (dotS) dotS.classList.add('hidden');
      if (btnR) btnR.classList.remove('text-accent-emerald');

      const banner = document.getElementById('banner-flotante-rastreo');
      if (banner) banner.classList.add('hidden');

      cerrarModalRastreoCliente();
    }

    reproducirSonidoAlerta('info');
    cerrarModalCancelarPedido();
    mostrarToast("Tu pedido ha sido cancelado correctamente.", "Pedido Cancelado", "info");
  } catch (err) {
    console.error("Error al cancelar pedido:", err);
    mostrarToast("No se pudo conectar con el servidor. Intenta de nuevo.", "Error", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = htmlOrig;
    }
  }
}
window.confirmarCancelacionPedido = confirmarCancelacionPedido;

// ================= INICIALIZACIÓN GLOBAL RÁPIDA =================
function inicializarAppPedidosFlash() {
  // 1. Comprobar sesión de usuario guardada de inmediato (prioridad máxima)
  const usuarioGuardado = localStorage.getItem('pedidosflash_usuario');
  if (usuarioGuardado) {
    try {
      aplicarSesionUsuario(JSON.parse(usuarioGuardado));
    } catch (e) {
      iniciarFlujoAuth();
    }
  } else {
    iniciarFlujoAuth();
  }

  // 2. Renderizar locales, iconos y restaurar carrito sin bloquear la vista inicial
  renderizarCatalogo(false);
  restaurarRespaldoCarrito();
  actualizarUIPreciosTransporte();
  if (window.lucide) lucide.createIcons();

  // 3. Sincronizaciones en segundo plano
  setTimeout(() => {
    sincronizarTiendasDesdeFirebase();
    sincronizarCatalogoFlashDesdeFirebase();
    sincronizarTarifasTransporteDesdeFirebase();
    if (firebaseActivo && db) {
      db.ref('configuracion/tasaBCV').on('value', (snap) => {
        const val = parseFloat(snap.val());
        if (!isNaN(val) && val > 0) {
          tasaBCVActual = val;
          localStorage.setItem('pedidosflash_tasa_bcv', val.toString());
          actualizarUIPreciosTransporte();
          actualizarTotales();
        }
      });
    }
  }, 150);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) guardarRespaldoCarrito();
  });
  window.addEventListener('pagehide', guardarRespaldoCarrito);

  // Comprobar si hay pedido activo
  if (pedidoActivoClienteId) {
    activarRastreoPedidoCliente(pedidoActivoClienteId);
  } else {
    try {
      const historial = JSON.parse(localStorage.getItem('pedidosflash_historial') || '[]');
      const enCurso = historial.find(h => h.estado === 'pendiente' || h.estado === 'aceptado' || h.estado === 'en_local' || h.estado === 'en_camino');
      if (enCurso && enCurso.id) {
        activarRastreoPedidoCliente(enCurso.id);
      }
    } catch (e) {}
  }

  const vid = document.getElementById('video-logo');
  if (vid) {
    vid.muted = true;
    vid.play().catch(() => {
      document.addEventListener('touchstart', () => vid.play(), { once: true });
      document.addEventListener('click', () => vid.play(), { once: true });
    });
  }

  const vidAuth = document.getElementById('video-bg-auth');
  if (vidAuth) {
    vidAuth.muted = true;
    vidAuth.play().catch(() => {
      document.addEventListener('touchstart', () => vidAuth.play(), { once: true });
      document.addEventListener('click', () => vidAuth.play(), { once: true });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarAppPedidosFlash);
} else {
  inicializarAppPedidosFlash();
}
