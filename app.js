const DATA_URL = "https://opensheet.elk.sh/18Q5dm_v6XIbUk4ea6qqNpXZ33Y7oj8re1mZ4kee7Jv8/PRODUCTOS_WEB";
const WHATSAPP_NUMBER = "5493535649674";
const PAGE_SIZE = 18;
const CART_STORAGE_KEY = "dls_carrito_v1";
const DEFAULT_SEARCH_PLACEHOLDER = "Busca por producto, seccion, subseccion u oferta";

const state = {
  productos: [],
  filtrados: [],
  carrito: [],
  rawQuery: "",
  query: "",
  activeSection: "__all__",
  sortMode: "relevance",
  viewMode: "grid",
  priceBounds: { min: 0, max: 0 },
  selectedPrice: { min: 0, max: 0 },
  visibleCount: 0,
  isLoadingMore: false,
  observer: null
};

const refs = {
  mobileHeader: document.getElementById("mobileHeader"),
  closeMobileHeader: document.getElementById("closeMobileHeader"),
  openMobileHeader: document.getElementById("openMobileHeader"),
  productos: document.getElementById("productos"),
  buscador: document.getElementById("buscador"),
  limpiarBusqueda: document.getElementById("limpiarBusqueda"),
  estadoBusqueda: document.getElementById("estadoBusqueda"),
  estadoPaginado: document.getElementById("estadoPaginado"),
  loaderProductos: document.getElementById("loaderProductos"),
  infiniteSentinel: document.getElementById("infiniteSentinel"),
  categoryHero: document.getElementById("categoryHero"),
  categoryHeroContent: document.getElementById("categoryHeroContent"),
  sortSelect: document.getElementById("sortSelect"),
  viewGrid: document.getElementById("viewGrid"),
  viewList: document.getElementById("viewList"),
  priceMin: document.getElementById("priceMin"),
  priceMax: document.getElementById("priceMax"),
  clearPriceFilter: document.getElementById("clearPriceFilter"),
  contador: document.getElementById("contadorCarrito"),
  carritoPanel: document.getElementById("carrito"),
  carritoOverlay: document.getElementById("carritoOverlay"),
  toggleCarrito: document.getElementById("toggleCarrito"),
  cerrarCarrito: document.getElementById("cerrarCarrito"),
  listaCarrito: document.getElementById("listaCarrito"),
  totalCarrito: document.getElementById("totalCarrito"),
  finalizarCompra: document.getElementById("finalizarCompra"),
  menuLateral: document.getElementById("menuLateral"),
  menuOverlay: document.getElementById("menuOverlay"),
  abrirMenu: document.getElementById("abrirMenu"),
  cerrarMenu: document.getElementById("cerrarMenu"),
  listaSecciones: document.getElementById("listaSecciones"),
  listaSeccionesDesktop: document.getElementById("listaSeccionesDesktop"),
  subirArriba: document.getElementById("subirArriba")
};

function escapeHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parsePrice(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const normalizado = String(valor).trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function parseDiscount(valor) {
  const limpio = String(valor ?? "").replace("%", "").replace(",", ".").trim();
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function calcularPrecioFinal(precioBase, oferta) {
  if (precioBase === null) return null;
  const descuento = parseDiscount(oferta);
  if (descuento <= 0) return precioBase;
  return precioBase - (precioBase * descuento / 100);
}

function precioComparable(prod) {
  const precioBase = parsePrice(prod.Precio);
  const precioFinal = calcularPrecioFinal(precioBase, prod.Oferta);
  return precioFinal === null ? null : precioFinal;
}

function formatCurrency(valor) {
  return `$${Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getSectionImage(seccion) {
  const nombre = normalizeText(seccion);
  if (nombre.includes("chocolate")) return "imagenes/chocolate.jpg";
  if (nombre.includes("cacao")) return "imagenes/cacao.jpg";
  if (nombre.includes("balde")) return "imagenes/baldes.jpg";
  if (nombre.includes("almendra")) return "imagenes/almendra.jpg";
  if (nombre.includes("azucar")) return "imagenes/azucar.jpg";
  if (nombre.includes("aro")) return "imagenes/aro.jpg";
  if (nombre.includes("bandeja")) return "imagenes/bandeja.jpg";
  if (nombre.includes("banderin")) return "imagenes/banderin.jpg";
  if (nombre.includes("nuez")) return "imagenes/nuez.jpg";
  return null;
}

function setBodyLock() {
  const menuOpen = !refs.menuLateral.classList.contains("-translate-x-full");
  const cartOpen = !refs.carritoPanel.classList.contains("translate-x-full");
  document.body.classList.toggle("overflow-hidden", menuOpen || cartOpen);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function closeMobileHeader() {
  if (!isMobileViewport()) return;
  refs.mobileHeader.classList.add("mobile-hidden");
  refs.openMobileHeader.classList.remove("hidden");
}

function openMobileHeader() {
  refs.mobileHeader.classList.remove("mobile-hidden");
  refs.openMobileHeader.classList.add("hidden");
}

function syncMobileHeaderByViewport() {
  if (isMobileViewport()) return;
  openMobileHeader();
}

function abrirMenu() {
  refs.menuOverlay.classList.remove("hidden");
  refs.menuLateral.classList.remove("-translate-x-full");
  setBodyLock();
}

function cerrarMenu() {
  refs.menuLateral.classList.add("-translate-x-full");
  refs.menuOverlay.classList.add("hidden");
  setBodyLock();
}

function abrirCarrito() {
  refs.carritoOverlay.classList.remove("hidden");
  refs.carritoPanel.classList.remove("translate-x-full");
  setBodyLock();
}

function cerrarCarrito() {
  refs.carritoPanel.classList.add("translate-x-full");
  refs.carritoOverlay.classList.add("hidden");
  setBodyLock();
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.carrito));
  } catch (error) {
    console.warn("No se pudo guardar el carrito en localStorage:", error);
  }
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    state.carrito = parsed
      .filter((item) => item && typeof item.descripcion === "string")
      .map((item) => ({
        key: String(item.key || item.descripcion),
        descripcion: item.descripcion,
        precioFinal: Number(item.precioFinal) || 0,
        cantidad: Math.max(1, Number(item.cantidad) || 1)
      }));
  } catch (error) {
    console.warn("No se pudo leer el carrito desde localStorage:", error);
  }
}

function buildSectionsMap(lista) {
  const map = new Map();
  for (const prod of lista) {
    const section = (prod.Seccion || "Sin seccion").trim() || "Sin seccion";
    map.set(section, (map.get(section) || 0) + 1);
  }
  return map;
}

function createSectionButton(label, count, sectionValue) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.section = sectionValue;
  btn.className = "section-filter w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800";
  btn.innerHTML = `
    <span class="section-label">${escapeHtml(label)}</span>
    <span class="section-count ml-2 text-xs text-slate-400">(${count})</span>
  `;

  btn.addEventListener("click", () => {
    state.activeSection = sectionValue;
    applyFilters(true, false);
    cerrarMenu();
  });

  return btn;
}

function updateActiveSectionButtons() {
  document.querySelectorAll(".section-filter").forEach((btn) => {
    const active = btn.dataset.section === state.activeSection;
    const count = btn.querySelector(".section-count");

    btn.classList.toggle("bg-brand-100", active);
    btn.classList.toggle("border-brand-500", active);
    btn.classList.toggle("text-brand-900", active);
    btn.classList.toggle("text-slate-700", !active);

    if (count) {
      count.classList.toggle("text-brand-700", active);
      count.classList.toggle("text-slate-400", !active);
    }
  });
}

function renderSectionMenus() {
  const map = buildSectionsMap(state.productos);
  refs.listaSecciones.innerHTML = "";
  refs.listaSeccionesDesktop.innerHTML = "";

  const allCount = state.productos.length;
  refs.listaSecciones.appendChild(createSectionButton("Todas las categorias", allCount, "__all__"));
  refs.listaSeccionesDesktop.appendChild(createSectionButton("Todas las categorias", allCount, "__all__"));

  for (const [section, count] of map.entries()) {
    refs.listaSecciones.appendChild(createSectionButton(section, count, section));
    refs.listaSeccionesDesktop.appendChild(createSectionButton(section, count, section));
  }

  updateActiveSectionButtons();
}

function initializePriceFilterBounds() {
  const prices = state.productos
    .map((prod) => precioComparable(prod))
    .filter((price) => price !== null);

  if (!prices.length) {
    state.priceBounds = { min: 0, max: 0 };
    state.selectedPrice = { min: 0, max: 0 };
    refs.priceMin.value = "";
    refs.priceMax.value = "";
    refs.priceMin.disabled = true;
    refs.priceMax.disabled = true;
    refs.clearPriceFilter.disabled = true;
    return;
  }

  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));

  state.priceBounds = { min, max };
  state.selectedPrice = { min, max };

  refs.priceMin.disabled = false;
  refs.priceMax.disabled = false;
  refs.clearPriceFilter.disabled = false;

  refs.priceMin.min = String(min);
  refs.priceMin.max = String(max);
  refs.priceMax.min = String(min);
  refs.priceMax.max = String(max);
  refs.priceMin.value = String(min);
  refs.priceMax.value = String(max);
}

function isPriceFilterActive() {
  return (
    state.selectedPrice.min > state.priceBounds.min ||
    state.selectedPrice.max < state.priceBounds.max
  );
}

function syncSelectedPriceFromInputs() {
  if (refs.priceMin.disabled || refs.priceMax.disabled) return;

  let min = Number(refs.priceMin.value || state.priceBounds.min);
  let max = Number(refs.priceMax.value || state.priceBounds.max);

  min = Number.isFinite(min) ? min : state.priceBounds.min;
  max = Number.isFinite(max) ? max : state.priceBounds.max;

  min = Math.max(state.priceBounds.min, Math.min(min, state.priceBounds.max));
  max = Math.max(state.priceBounds.min, Math.min(max, state.priceBounds.max));

  if (min > max) {
    if (document.activeElement === refs.priceMin) {
      max = min;
    } else {
      min = max;
    }
  }

  state.selectedPrice = { min, max };
  refs.priceMin.value = String(min);
  refs.priceMax.value = String(max);
}

function resetPriceFilter() {
  state.selectedPrice = { ...state.priceBounds };
  refs.priceMin.value = String(state.priceBounds.min);
  refs.priceMax.value = String(state.priceBounds.max);
}

function setViewMode(mode) {
  state.viewMode = mode === "list" ? "list" : "grid";

  if (state.viewMode === "list") {
    refs.productos.className = "grid grid-cols-1 gap-4";
    refs.viewList.className = "rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-bold text-white";
    refs.viewGrid.className = "rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100";
  } else {
    refs.productos.className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
    refs.viewGrid.className = "rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-bold text-white";
    refs.viewList.className = "rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100";
  }
}

function showLoadingSkeleton() {
  refs.productos.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const card = document.createElement("div");
    card.className = "rounded-3xl border border-slate-200 bg-white p-4 shadow-soft";
    card.innerHTML = `
      <div class="skeleton h-28 rounded-2xl"></div>
      <div class="skeleton mt-4 h-5 rounded-lg"></div>
      <div class="skeleton mt-2 h-4 rounded-lg"></div>
      <div class="skeleton mt-5 h-9 rounded-xl"></div>
    `;
    refs.productos.appendChild(card);
  }
}

function renderCategoryHero() {
  if (state.activeSection === "__all__") {
    refs.categoryHero.classList.add("hidden");
    refs.categoryHeroContent.innerHTML = "";
    refs.buscador.placeholder = DEFAULT_SEARCH_PLACEHOLDER;
    return;
  }

  refs.categoryHero.classList.remove("hidden");
  refs.buscador.placeholder = `Estas buscando en la seccion: ${state.activeSection}`;

  const image = getSectionImage(state.activeSection);
  const queryText = state.rawQuery ? `<p class="mt-1 text-xs text-white/90">Termino actual: "${escapeHtml(state.rawQuery)}"</p>` : "";

  if (image) {
    refs.categoryHeroContent.style.backgroundImage = `url('${image}')`;
    refs.categoryHeroContent.style.backgroundSize = "cover";
    refs.categoryHeroContent.style.backgroundPosition = "center";
    refs.categoryHeroContent.innerHTML = `
      <div class="absolute inset-0 bg-slate-900/55"></div>
      <div class="relative">
        <p class="text-xs font-bold uppercase tracking-widest text-cyan-100">Filtro activo</p>
        <h3 class="mt-1 text-xl font-extrabold text-white sm:text-2xl">Estas buscando en la seccion ${escapeHtml(state.activeSection)}</h3>
        ${queryText}
      </div>
    `;
    return;
  }

  refs.categoryHeroContent.style.backgroundImage = "linear-gradient(90deg, #1f1f22, #ec1e8f)";
  refs.categoryHeroContent.style.backgroundSize = "cover";
  refs.categoryHeroContent.innerHTML = `
    <p class="text-xs font-bold uppercase tracking-widest text-cyan-100">Filtro activo</p>
    <h3 class="mt-1 text-xl font-extrabold text-white sm:text-2xl">Estas buscando en la seccion ${escapeHtml(state.activeSection)}</h3>
    ${queryText}
  `;
}

function createProductCard(prod, delayIndex) {
  const precioBase = parsePrice(prod.Precio);
  const descuento = parseDiscount(prod.Oferta);
  const precioFinal = calcularPrecioFinal(precioBase, prod.Oferta);
  const descripcion = prod.Descripcion || "Producto";
  const seccion = prod.Seccion || "Sin seccion";
  const subseccion = prod.Subseccion || "";

  const card = document.createElement("article");
  card.className = state.viewMode === "list"
    ? "product-enter group overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
    : "product-enter group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card";
  card.style.animationDelay = `${Math.min(delayIndex * 40, 320)}ms`;

  const mensaje = encodeURIComponent(`Hola! Quisiera consultar por el producto: ${descripcion}`);
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`;

  let precioHtml = '<p class="text-sm italic text-slate-400">Consultar precio</p>';
  if (precioFinal !== null) {
    precioHtml = `
      <div class="flex items-baseline gap-2">
        <p class="text-2xl font-extrabold tracking-tight text-slate-900">${formatCurrency(precioFinal)}</p>
        ${descuento > 0 ? `<p class="text-xs font-semibold text-slate-400 line-through">${formatCurrency(precioBase)}</p>` : ""}
      </div>
      ${descuento > 0 ? `<span class="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-600">-${Math.round(descuento)}% OFF</span>` : ""}
    `;
  }
  const infoClass = state.viewMode === "list"
    ? "flex flex-1 flex-col"
    : "flex flex-1 flex-col p-4";

  card.innerHTML = `
    <div class="${infoClass}">
      <div class="mb-3 inline-flex w-fit rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-900">
        ${escapeHtml(seccion)}
      </div>
      ${subseccion ? `<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(subseccion)}</p>` : '<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Catalogo DLS</p>'}
      <h3 class="min-h-[3.25rem] overflow-hidden text-base font-extrabold leading-6 text-slate-900">${escapeHtml(descripcion)}</h3>
      <div class="mt-3 min-h-[3.5rem]">${precioHtml}</div>
      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        ${precioFinal !== null ? '<button type="button" class="btn-agregar inline-flex items-center justify-center rounded-xl bg-accent-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-accent-600">Agregar</button>' : ""}
        <a href="${waLink}" target="_blank" rel="noreferrer" class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-600">
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" class="h-4 w-4" />
          Consultar
        </a>
      </div>
    </div>
  `;

  const addBtn = card.querySelector(".btn-agregar");
  if (addBtn) {
    addBtn.addEventListener("click", () => agregarAlCarrito(prod, precioFinal));
  }

  return card;
}

function agregarAlCarrito(prod, precioFinal) {
  const key = `${prod.Seccion || ""}::${prod.Descripcion || ""}`;
  const existente = state.carrito.find((item) => item.key === key);

  if (existente) {
    existente.cantidad += 1;
  } else {
    state.carrito.push({
      key,
      descripcion: prod.Descripcion || "Producto",
      precioFinal: precioFinal || 0,
      cantidad: 1
    });
  }

  renderCarrito();
  abrirCarrito();
}

function renderCarrito() {
  refs.listaCarrito.innerHTML = "";

  if (!state.carrito.length) {
    refs.listaCarrito.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        Todavia no agregaste productos.
      </div>
    `;
    refs.totalCarrito.textContent = "$0";
    refs.contador.textContent = "0";
    saveCartToStorage();
    return;
  }

  let total = 0;
  let cantidadTotal = 0;

  state.carrito.forEach((item, index) => {
    const subtotal = item.precioFinal * item.cantidad;
    total += subtotal;
    cantidadTotal += item.cantidad;

    const row = document.createElement("article");
    row.className = "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm";
    row.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">${escapeHtml(item.descripcion)}</h3>
          <p class="mt-1 text-xs text-slate-500">${formatCurrency(item.precioFinal)} c/u</p>
        </div>
        <button type="button" data-action="eliminar" data-index="${index}" class="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600">Eliminar</button>
      </div>
      <div class="mt-3 flex items-center justify-between">
        <div class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button type="button" data-action="restar" data-index="${index}" class="h-7 w-7 rounded-lg bg-white text-sm font-bold text-slate-700 hover:bg-slate-100">-</button>
          <span class="min-w-6 text-center text-sm font-semibold">${item.cantidad}</span>
          <button type="button" data-action="sumar" data-index="${index}" class="h-7 w-7 rounded-lg bg-white text-sm font-bold text-slate-700 hover:bg-slate-100">+</button>
        </div>
        <p class="text-sm font-bold text-slate-900">${formatCurrency(subtotal)}</p>
      </div>
    `;

    refs.listaCarrito.appendChild(row);
  });

  refs.totalCarrito.textContent = formatCurrency(total);
  refs.contador.textContent = String(cantidadTotal);
  saveCartToStorage();

  refs.listaCarrito.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const action = btn.dataset.action;
      if (!Number.isFinite(index) || !state.carrito[index]) return;

      if (action === "sumar") state.carrito[index].cantidad += 1;
      if (action === "restar") {
        state.carrito[index].cantidad -= 1;
        if (state.carrito[index].cantidad <= 0) state.carrito.splice(index, 1);
      }
      if (action === "eliminar") state.carrito.splice(index, 1);
      renderCarrito();
    });
  });
}

function sortProducts(lista) {
  const copy = [...lista];

  if (state.sortMode === "price_asc") {
    copy.sort((a, b) => {
      const pa = precioComparable(a);
      const pb = precioComparable(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    });
    return copy;
  }

  if (state.sortMode === "price_desc") {
    copy.sort((a, b) => {
      const pa = precioComparable(a);
      const pb = precioComparable(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pb - pa;
    });
    return copy;
  }

  if (state.sortMode === "offers") {
    copy.sort((a, b) => {
      const da = parseDiscount(a.Oferta);
      const db = parseDiscount(b.Oferta);
      if (db !== da) return db - da;

      const pa = precioComparable(a);
      const pb = precioComparable(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    });
    return copy;
  }

  return copy;
}

function updateStatusTexts() {
  refs.estadoPaginado.textContent = `Mostrando ${state.visibleCount} de ${state.filtrados.length}`;
  const activePrice = isPriceFilterActive();
  const priceTag = activePrice
    ? ` | Precio: ${formatCurrency(state.selectedPrice.min)} a ${formatCurrency(state.selectedPrice.max)}`
    : "";

  if (!state.query && state.activeSection === "__all__") {
    if (activePrice) {
      refs.estadoBusqueda.classList.remove("hidden");
      refs.estadoBusqueda.textContent = `${state.filtrados.length} producto(s) filtrados por rango de precio.${priceTag}`;
    } else {
      refs.estadoBusqueda.classList.add("hidden");
      refs.estadoBusqueda.textContent = "";
    }
    return;
  }

  refs.estadoBusqueda.classList.remove("hidden");

  const displayQuery = state.rawQuery || state.query;

  if (state.activeSection !== "__all__") {
    refs.estadoBusqueda.textContent = state.query
      ? `Estas buscando "${displayQuery}" en la seccion ${state.activeSection}. ${state.filtrados.length} resultado(s).${priceTag}`
      : `Estas buscando en la seccion ${state.activeSection}. ${state.filtrados.length} producto(s).${priceTag}`;
    return;
  }

  refs.estadoBusqueda.textContent = `${state.filtrados.length} resultado(s) para "${displayQuery}".${priceTag}`;
}

function renderEmptyState() {
  refs.productos.innerHTML = `
    <div class="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-soft sm:col-span-2 xl:col-span-3">
      <h2 class="text-lg font-extrabold text-slate-900">No encontramos productos</h2>
      <p class="mt-2 text-sm font-medium text-slate-500">Prueba otra busqueda, orden o categoria.</p>
    </div>
  `;
}

function renderNextBatch() {
  if (state.isLoadingMore) return;
  if (state.visibleCount >= state.filtrados.length) return;

  state.isLoadingMore = true;
  refs.loaderProductos.classList.remove("hidden");

  const start = state.visibleCount;
  const end = Math.min(start + PAGE_SIZE, state.filtrados.length);
  const fragment = document.createDocumentFragment();

  for (let i = start; i < end; i += 1) {
    fragment.appendChild(createProductCard(state.filtrados[i], i - start));
  }

  refs.productos.appendChild(fragment);
  state.visibleCount = end;
  state.isLoadingMore = false;
  refs.loaderProductos.classList.add("hidden");

  updateStatusTexts();
}

function ensureScrollableContent() {
  let attempts = 0;
  while (
    state.visibleCount < state.filtrados.length &&
    document.documentElement.scrollHeight <= window.innerHeight * 1.2 &&
    attempts < 8
  ) {
    renderNextBatch();
    attempts += 1;
  }
}

function resetProductFeed(initialTarget = PAGE_SIZE) {
  refs.productos.innerHTML = "";
  state.visibleCount = 0;

  if (!state.filtrados.length) {
    refs.loaderProductos.classList.add("hidden");
    renderEmptyState();
    updateStatusTexts();
    return;
  }

  const target = Math.min(initialTarget, state.filtrados.length);
  while (state.visibleCount < target) {
    renderNextBatch();
  }

  ensureScrollableContent();
}

function applyFilters(resetScroll = false, preserveVisible = false) {
  state.rawQuery = refs.buscador.value.trim();
  state.query = normalizeText(state.rawQuery);
  const query = state.query;
  const section = state.activeSection;
  const priceActive = isPriceFilterActive();

  const filtered = state.productos.filter((prod) => {
    const seccion = String(prod.Seccion || "").trim() || "Sin seccion";
    const matchSection = section === "__all__" ? true : seccion === section;

    if (!matchSection) return false;

    if (priceActive) {
      const price = precioComparable(prod);
      if (price === null) return false;
      if (price < state.selectedPrice.min || price > state.selectedPrice.max) return false;
    }

    if (!query) return true;

    const descripcion = normalizeText(prod.Descripcion);
    const seccionNorm = normalizeText(prod.Seccion);
    const subseccionNorm = normalizeText(prod.Subseccion);
    const enOferta = parseDiscount(prod.Oferta) > 0;

    return (
      descripcion.includes(query) ||
      seccionNorm.includes(query) ||
      subseccionNorm.includes(query) ||
      (query.includes("oferta") && enOferta)
    );
  });

  state.filtrados = sortProducts(filtered);

  const target = preserveVisible ? Math.max(state.visibleCount, PAGE_SIZE) : PAGE_SIZE;
  resetProductFeed(target);
  updateActiveSectionButtons();
  renderCategoryHero();

  if (resetScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function initInfiniteScroll() {
  if (state.observer) state.observer.disconnect();

  state.observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      renderNextBatch();
    },
    { root: null, rootMargin: "450px 0px", threshold: 0.01 }
  );

  state.observer.observe(refs.infiniteSentinel);
}

function finalizarCompra() {
  if (!state.carrito.length) {
    window.alert("Tu carrito esta vacio.");
    return;
  }

  const resumen = state.carrito
    .map((item) => `- ${item.descripcion} x${item.cantidad}`)
    .join("\n");

  const mensaje = encodeURIComponent(
    `Hola! Quiero finalizar mi compra:\n${resumen}\nTotal: ${refs.totalCarrito.textContent}`
  );

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`, "_blank", "noopener");
}

function bindUI() {
  refs.closeMobileHeader.addEventListener("click", closeMobileHeader);
  refs.openMobileHeader.addEventListener("click", openMobileHeader);
  window.addEventListener("resize", syncMobileHeaderByViewport);

  refs.abrirMenu.addEventListener("click", abrirMenu);
  refs.cerrarMenu.addEventListener("click", cerrarMenu);
  refs.menuOverlay.addEventListener("click", cerrarMenu);

  refs.toggleCarrito.addEventListener("click", abrirCarrito);
  refs.cerrarCarrito.addEventListener("click", cerrarCarrito);
  refs.carritoOverlay.addEventListener("click", cerrarCarrito);

  refs.buscador.addEventListener("input", () => applyFilters(false, false));

  refs.limpiarBusqueda.addEventListener("click", () => {
    refs.buscador.value = "";
    state.activeSection = "__all__";
    applyFilters(true, false);
    refs.buscador.focus();
  });

  refs.sortSelect.addEventListener("change", () => {
    state.sortMode = refs.sortSelect.value;
    applyFilters(false, true);
  });

  refs.priceMin.addEventListener("input", () => {
    syncSelectedPriceFromInputs();
    applyFilters(false, false);
  });

  refs.priceMax.addEventListener("input", () => {
    syncSelectedPriceFromInputs();
    applyFilters(false, false);
  });

  refs.clearPriceFilter.addEventListener("click", () => {
    resetPriceFilter();
    applyFilters(false, false);
  });

  refs.viewGrid.addEventListener("click", () => {
    if (state.viewMode === "grid") return;
    setViewMode("grid");
    applyFilters(false, true);
  });

  refs.viewList.addEventListener("click", () => {
    if (state.viewMode === "list") return;
    setViewMode("list");
    applyFilters(false, true);
  });

  refs.finalizarCompra.addEventListener("click", finalizarCompra);

  window.addEventListener("scroll", () => {
    if (window.scrollY > 450) refs.subirArriba.classList.remove("hidden");
    else refs.subirArriba.classList.add("hidden");
  });

  refs.subirArriba.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    cerrarMenu();
    cerrarCarrito();
  });
}

function renderErrorState() {
  refs.productos.innerHTML = `
    <div class="rounded-3xl border border-red-200 bg-red-50 px-6 py-14 text-center shadow-soft sm:col-span-2 xl:col-span-3">
      <h2 class="text-lg font-extrabold text-red-700">No se pudo cargar el catalogo</h2>
      <p class="mt-2 text-sm font-medium text-red-600">Recarga la pagina en unos segundos.</p>
    </div>
  `;
}

async function init() {
  bindUI();
  syncMobileHeaderByViewport();
  setViewMode(state.viewMode);
  showLoadingSkeleton();
  loadCartFromStorage();
  renderCarrito();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    state.productos = Array.isArray(data) ? data : [];

    renderSectionMenus();
    initializePriceFilterBounds();
    renderCategoryHero();
    applyFilters(false, false);
    initInfiniteScroll();
  } catch (error) {
    console.error("Error al cargar productos:", error);
    renderErrorState();
    refs.loaderProductos.classList.add("hidden");
    refs.estadoPaginado.textContent = "";
  }
}

init();
