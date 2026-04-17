const STORAGE = {
  cart: "rizze_cart",
  favorites: "rizze_favorites",
  orders: "rizze_orders"
};

const page = document.body.dataset.page;

const state = {
  products: [],
  team: [],
  cart: readStorage(STORAGE.cart, []),
  favorites: new Set(readStorage(STORAGE.favorites, [])),
  orders: readStorage(STORAGE.orders, []),
  currentCategory: "all",
  currentSort: "default",
  paymentMethod: "card"
};

const CATEGORY_PAGE = {
  all: "products.html",
  skincare: "products-skincare.html",
  makeup: "products-makeup.html",
  fragrance: "products-fragrance.html"
};

const MEMBER_PAGE = {
  arizza: "member-arizza.html",
  maverick: "member-maverick.html",
  erika: "member-erika.html",
  justin: "member-justin.html",
  johnley: "member-johnley.html"
};

let productsLoaded = false;
let teamLoaded = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupMobileMenu();
  setupModalClose();
  await ensureProducts();
  await ensureTeam();

  updateCountBadges();

  if (page === "home") {
    renderHomeSections();
  }

  if (page === "products") {
    setupShopControls();
    applyShopView();
  }

  if (page === "about") {
    renderTeamOverview();
  }

  if (page === "member") {
    renderMemberProfile();
  }

  if (page === "cart") {
    renderCartPage();
  }

  if (page === "checkout") {
    renderCheckoutPage();
    setupCheckout();
  }

  if (page === "orders") {
    renderOrdersPage();
  }
}

async function ensureProducts() {
  if (productsLoaded) {
    return;
  }

  state.products = await loadJson("data/products.json", getFallbackProducts());
  productsLoaded = true;
}

async function ensureTeam() {
  if (teamLoaded) {
    return;
  }

  state.team = await loadJson("data/team.json", getFallbackTeam());
  teamLoaded = true;
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("Fetch failed");
    }
    return await response.json();
  } catch {
    return fallback;
  }
}

function setupMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) {
    return;
  }

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

function renderHomeSections() {
  const bestSellerGrid = document.getElementById("best-sellers-grid");
  const newArrivalsGrid = document.getElementById("new-arrivals-grid");

  if (bestSellerGrid) {
    const bestOrder = ["p2", "p5", "p7", "p3"];
    const best = bestOrder
      .map((id) => state.products.find((item) => item.id === id))
      .filter(Boolean);
    renderProductCards(bestSellerGrid, best, { homeFeatured: true });
  }

  if (newArrivalsGrid) {
    const newOrder = ["p6", "p1", "p4", "p8"];
    const newest = newOrder
      .map((id) => state.products.find((item) => item.id === id))
      .filter(Boolean);
    renderProductCards(newArrivalsGrid, newest, { homeFeatured: true });
  }
}

function setupShopControls() {
  const chipRow = document.getElementById("chip-row");
  const sortSelect = document.getElementById("sort-select");

  if (!chipRow || !sortSelect) {
    return;
  }

  const bodyCategory = document.body.dataset.category;
  if (bodyCategory && Object.keys(CATEGORY_PAGE).includes(bodyCategory)) {
    state.currentCategory = bodyCategory;
  }

  chipRow.onclick = (event) => {
    const chip = event.target.closest("button[data-category]");
    if (!chip) {
      return;
    }

    const nextCategory = chip.dataset.category;
    const targetPage = CATEGORY_PAGE[nextCategory] || CATEGORY_PAGE.all;

    if (!window.location.pathname.endsWith(targetPage)) {
      window.location.href = targetPage;
      return;
    }

    state.currentCategory = nextCategory;
    for (const item of chipRow.querySelectorAll(".chip")) {
      item.classList.remove("active");
    }
    chip.classList.add("active");
    applyShopView();
  };

  for (const chip of chipRow.querySelectorAll(".chip")) {
    chip.classList.toggle("active", chip.dataset.category === state.currentCategory);
  }

  sortSelect.addEventListener("change", () => {
    state.currentSort = sortSelect.value;
    applyShopView();
  });
}

function applyShopView() {
  const grid = document.getElementById("products-grid");
  if (!grid) {
    return;
  }

  let items = [...state.products];

  if (state.currentCategory !== "all") {
    items = items.filter((item) => item.category === state.currentCategory);
  }

  if (state.currentSort === "price-low") {
    items.sort((a, b) => a.price - b.price);
  }

  if (state.currentSort === "price-high") {
    items.sort((a, b) => b.price - a.price);
  }

  if (state.currentSort === "name-az") {
    items.sort((a, b) => a.name.localeCompare(b.name));
  }

  renderProductCards(grid, items);
}

function renderProductCards(container, products, options = {}) {
  if (products.length === 0) {
    container.innerHTML = "<p>No products found in this category.</p>";
    return;
  }

  container.innerHTML = products.map((product) => createProductCard(product, options)).join("");

  container.onclick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "favorite") {
      toggleFavorite(id);
      rerenderProductsForCurrentPage();
      return;
    }

    if (action === "view") {
      openProductModal(id);
      return;
    }

    if (action === "add") {
      addToCart(id);
    }
  };
}

function createProductCard(product, options = {}) {
  const badge = product.bestSeller
    ? `<span class="product-badge best">Best Seller</span>`
    : product.badge === "new"
      ? `<span class="product-badge new">New</span>`
      : "";

  const isFavorite = state.favorites.has(product.id);
  const actionMarkup = options.homeFeatured
    ? `<div class="product-actions product-actions-home"><button class="btn btn-dark" data-action="add" data-id="${product.id}">Add to Cart</button></div>`
    : `<div class="product-actions"><button class="btn btn-link" data-action="view" data-id="${product.id}">Quick View</button><button class="btn btn-dark" data-action="add" data-id="${product.id}">Add to Cart</button></div>`;

  return `
    <article class="product-card ${options.homeFeatured ? "product-card-home-featured" : ""}">
      <div class="product-image-wrap">
        ${badge}
        <button class="btn btn-link favorite-icon favorite ${isFavorite ? "active" : ""}" data-action="favorite" data-id="${product.id}" aria-label="Favorite product">${isFavorite ? "♥" : "♡"}</button>
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
      </div>
      <div class="product-meta">
        <h3>${product.name}</h3>
        <p class="price">₱ ${formatPrice(product.price)}</p>
        ${actionMarkup}
      </div>
    </article>
  `;
}

function openProductModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  const modal = document.getElementById("product-modal");
  const content = document.getElementById("product-modal-content");

  if (!product || !modal || !content) {
    return;
  }

  content.innerHTML = `
    <h2>${product.name}</h2>
    <img src="${product.image}" alt="${product.name}" />
    <p>${product.description}</p>
    <p class="price">₱ ${formatPrice(product.price)}</p>
    <div class="product-actions">
      <button class="btn btn-dark" id="modal-add">Add to Cart</button>
      <button class="btn btn-link" id="modal-close">Close</button>
    </div>
  `;

  modal.classList.add("show");

  const addBtn = document.getElementById("modal-add");
  const closeBtn = document.getElementById("modal-close");

  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(product.id);
      modal.classList.remove("show");
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove("show");
  }
}

function setupModalClose() {
  document.addEventListener("click", (event) => {
    const modal = event.target.closest(".modal");
    if (!modal) {
      return;
    }

    if (event.target === modal) {
      modal.classList.remove("show");
    }
  });
}

function toggleFavorite(productId) {
  if (state.favorites.has(productId)) {
    state.favorites.delete(productId);
    showToast("Removed from favorites");
  } else {
    state.favorites.add(productId);
    showToast("Added to favorites");
  }

  saveStorage(STORAGE.favorites, Array.from(state.favorites));
}

function addToCart(productId) {
  const current = state.cart.find((item) => item.id === productId);
  if (current) {
    current.qty += 1;
  } else {
    state.cart.push({ id: productId, qty: 1 });
  }

  saveStorage(STORAGE.cart, state.cart);
  updateCountBadges();
  showToast("Added to cart");

  if (page === "cart") {
    renderCartPage();
  }

  if (page === "checkout") {
    renderCheckoutPage();
  }
}

function renderCartPage() {
  const filled = document.getElementById("cart-filled");
  const empty = document.getElementById("cart-empty");
  const itemsWrap = document.getElementById("cart-items");
  const subtotalNode = document.getElementById("subtotal-price");
  const totalNode = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-btn");

  if (!filled || !empty || !itemsWrap || !subtotalNode || !totalNode || !checkoutBtn) {
    return;
  }

  const detailedItems = state.cart
    .map((entry) => {
      const product = state.products.find((item) => item.id === entry.id);
      return product ? { ...product, qty: entry.qty } : null;
    })
    .filter(Boolean);

  if (detailedItems.length === 0) {
    filled.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  filled.classList.remove("hidden");
  empty.classList.add("hidden");

  itemsWrap.innerHTML = detailedItems
    .map(
      (item) => `
      <article class="line-item">
        <img src="${item.image}" alt="${item.name}" />
        <div class="line-item-content">
          <h3>${item.name}</h3>
          <p class="price">₱ ${formatPrice(item.price)}</p>
          <div class="qty-box">
            <button data-qty="minus" data-id="${item.id}">−</button>
            <span>${item.qty}</span>
            <button data-qty="plus" data-id="${item.id}">+</button>
          </div>
        </div>
        <button class="remove-item" data-remove="${item.id}" title="Remove">×</button>
      </article>
    `
    )
    .join("");

  const total = calculateCartTotal();
  subtotalNode.textContent = `₱ ${formatPrice(total)}`;
  totalNode.textContent = `₱ ${formatPrice(total)}`;

  itemsWrap.onclick = (event) => {
    const qtyBtn = event.target.closest("button[data-qty]");
    if (qtyBtn) {
      const id = qtyBtn.dataset.id;
      const entry = state.cart.find((item) => item.id === id);
      if (entry) {
        entry.qty += qtyBtn.dataset.qty === "plus" ? 1 : -1;
        if (entry.qty <= 0) {
          state.cart = state.cart.filter((item) => item.id !== id);
        }
        saveStorage(STORAGE.cart, state.cart);
        updateCountBadges();
        renderCartPage();
      }
      return;
    }

    const removeBtn = event.target.closest("button[data-remove]");
    if (removeBtn) {
      state.cart = state.cart.filter((item) => item.id !== removeBtn.dataset.remove);
      saveStorage(STORAGE.cart, state.cart);
      updateCountBadges();
      renderCartPage();
    }
  };

  checkoutBtn.onclick = () => {
    window.location.href = "checkout.html";
  };
}

function renderCheckoutPage() {
  const summary = document.getElementById("checkout-summary");
  const payNowBtn = document.getElementById("pay-now-btn");
  const cardFields = document.getElementById("card-fields");

  if (!summary || !payNowBtn || !cardFields) {
    return;
  }

  const cartDetails = state.cart
    .map((entry) => {
      const product = state.products.find((item) => item.id === entry.id);
      return product ? { ...product, qty: entry.qty } : null;
    })
    .filter(Boolean);

  const total = calculateCartTotal();

  summary.innerHTML = `
    <h3>Order Summary</h3>
    ${cartDetails
      .map(
        (item) => `
      <div class="checkout-item">
        <img src="${item.image}" alt="${item.name}" />
        <div>
          <strong>${item.name}</strong>
          <p>QTY: ${item.qty}</p>
        </div>
        <strong>P ${formatPrice(item.price * item.qty)}</strong>
      </div>
    `
      )
      .join("")}
    <div class="summary-row"><span>Subtotal</span><strong>P ${formatPrice(total)}</strong></div>
    <div class="summary-row"><span>Shipping</span><strong>Free</strong></div>
    <div class="summary-row total"><span>Total</span><strong>P ${formatPrice(total)}</strong></div>
  `;

  payNowBtn.textContent = `${state.paymentMethod === "cod" ? "Place Order" : "Pay Now"} - P ${formatPrice(total)}`;

  if (state.paymentMethod === "cod") {
    cardFields.classList.add("hidden");
  } else {
    cardFields.classList.remove("hidden");
  }
}

function setupCheckout() {
  const paymentWrap = document.getElementById("payment-options");
  const form = document.getElementById("checkout-form");

  if (!paymentWrap || !form) {
    return;
  }

  paymentWrap.onclick = (event) => {
    const option = event.target.closest("button[data-payment]");
    if (!option) {
      return;
    }

    state.paymentMethod = option.dataset.payment;
    for (const item of paymentWrap.querySelectorAll(".payment-option")) {
      item.classList.remove("active");
    }
    option.classList.add("active");
    renderCheckoutPage();
  };

  form.onsubmit = (event) => {
    event.preventDefault();

    if (state.cart.length === 0) {
      showToast("Cart is empty");
      return;
    }

    const timestamp = new Date();
    const orderId = `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const newOrder = {
      id: orderId,
      date: timestamp.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      method: state.paymentMethod === "cod" ? "Cash on Delivery" : "Pay via Card",
      status: "Processing",
      items: state.cart.map((entry) => ({ ...entry })),
      total: calculateCartTotal()
    };

    state.orders.unshift(newOrder);
    saveStorage(STORAGE.orders, state.orders);

    state.cart = [];
    saveStorage(STORAGE.cart, state.cart);

    updateCountBadges();
    window.location.href = "success.html";
  };
}

function renderOrdersPage() {
  const list = document.getElementById("orders-list");
  if (!list) {
    return;
  }

  if (state.orders.length === 0) {
    list.innerHTML = "<p>No orders yet. Start shopping to place your first order.</p>";
    return;
  }

  list.innerHTML = state.orders
    .map((order) => {
      const firstItem = order.items[0];
      const product = state.products.find((item) => item.id === firstItem.id);
      const productName = product ? product.name : "Product";
      const productImage = product ? product.image : "";

      return `
        <article class="order-card">
          <div class="order-top">
            <div><span>Order ID</span><strong>${order.id}</strong></div>
            <div><span>Date Ordered</span><strong>${order.date}</strong></div>
            <div><span>Payment Method</span><strong>${order.method}</strong></div>
            <div><span>Total</span><strong>P ${formatPrice(order.total)}</strong></div>
            <span class="status-pill">${order.status}</span>
          </div>
          <div class="order-item">
            <img src="${productImage}" alt="${productName}" />
            <div>
              <strong>${productName}</strong>
              <p>QTY: ${firstItem.qty}</p>
            </div>
            <strong>P ${formatPrice(order.total)}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTeamOverview() {
  const grid = document.getElementById("team-grid");
  if (!grid) {
    return;
  }

  grid.innerHTML = state.team
    .map(
      (member) => `
      <article class="team-card">
        <img class="team-photo" src="${member.image}" alt="${member.name}" />
        <h3>${member.name}</h3>
        <p class="role">${member.role}</p>
        <p>${member.about}</p>
        <a class="view-profile" href="${MEMBER_PAGE[member.id] || "member-arizza.html"}">View Profile →</a>
      </article>
    `
    )
    .join("");
}

function renderMemberProfile() {
  const wrap = document.getElementById("member-profile");
  if (!wrap) {
    return;
  }

  const id = document.body.dataset.memberId;
  const member = state.team.find((item) => item.id === id) || state.team[0];

  if (!member) {
    wrap.innerHTML = "<p>Member profile unavailable.</p>";
    return;
  }

  wrap.innerHTML = `
    <section class="profile-box">
      <a class="back-link" href="about.html">← Back to Team</a>

      <div class="profile-head">
        <img src="${member.image}" alt="${member.name}" />
        <div>
          <h2>${member.name}</h2>
          <p class="role">${member.role}</p>
        </div>
      </div>

      <div class="profile-block">
        <h3>About</h3>
        <p>${member.about}</p>
      </div>

      <div class="profile-block">
        <h3>Skills</h3>
        <div class="skill-tags">
          ${member.skills.map((skill) => `<span>${skill}</span>`).join("")}
        </div>
      </div>

      <div class="profile-block">
        <h3>Project Contribution</h3>
        <p>${member.contribution}</p>
      </div>
    </section>
  `;
}

function updateCountBadges() {
  const cartCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const ordersCount = state.orders.length;

  const cartNodes = document.querySelectorAll("#cart-count");
  for (const node of cartNodes) {
    node.textContent = String(cartCount);
    const icon = node.closest(".nav-icon");
    if (icon) {
      icon.classList.toggle("has-items", cartCount > 0);
    }
  }

  const ordersNodes = document.querySelectorAll("#orders-count");
  for (const node of ordersNodes) {
    node.textContent = String(ordersCount);
    const icon = node.closest(".nav-icon");
    if (icon) {
      icon.classList.toggle("has-items", ordersCount > 0);
    }
  }
}

function rerenderProductsForCurrentPage() {
  if (page === "home") {
    renderHomeSections();
  }

  if (page === "products") {
    applyShopView();
  }
}

function calculateCartTotal() {
  return state.cart.reduce((sum, entry) => {
    const product = state.products.find((item) => item.id === entry.id);
    return product ? sum + product.price * entry.qty : sum;
  }, 0);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1700);
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatPrice(value) {
  return Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getFallbackProducts() {
  return [
    {
      id: "p1",
      name: "Xanel Matte Lipstick",
      category: "makeup",
      price: 399,
      image: "assets/Rectangle%204.png",
      description: "Creamy matte lipstick with long-wear pigment and a soft-focus finish.",
      badge: "new",
      bestSeller: false,
      newArrival: true
    },
    {
      id: "p2",
      name: "Necessaire Body Lotion",
      category: "skincare",
      price: 199,
      image: "assets/best-seller-card-1.png",
      description: "Hydrating daily lotion that leaves skin smooth and visibly refreshed.",
      badge: "best",
      bestSeller: true,
      newArrival: false
    },
    {
      id: "p3",
      name: "Narcisi Parfum",
      category: "fragrance",
      price: 499,
      image: "assets/best-seller-card-4.png",
      description: "A clean floral fragrance layered with warm woody notes.",
      badge: "best",
      bestSeller: true,
      newArrival: false
    }
  ];
}

function getFallbackTeam() {
  return [
    {
      id: "arizza",
      name: "Arizza L. Villareal",
      role: "Frontend Designer",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
      about: "Driven by continuous growth and learning, with a focus on building reliable and structured front-end implementations.",
      skills: ["UI Design"],
      contribution: "Led the visual design direction, creating the overall aesthetic and component designs that define Rizze Beauty's luxurious look and feel."
    }
  ];
}
