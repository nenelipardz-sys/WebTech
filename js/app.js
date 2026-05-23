// Local storage key names used across the site for persistence.
const STORAGE = {
  cart: "rizze_cart",
  favorites: "rizze_favorites",
  orders: "rizze_orders",
  auth: "rizze_auth",
  users: "rizze_users",
  profiles: "rizze_profiles"
};

// Read the current page type from the body attribute.
const page = document.body.dataset.page;

// Global application state for products, team data, user session, cart, and UI state.
const state = {
  products: [],
  team: [],
  cart: readStorage(STORAGE.cart, []),
  favorites: new Set(readStorage(STORAGE.favorites, [])),
  orders: readStorage(STORAGE.orders, []),
  users: readStorage(STORAGE.users, []),
  profiles: readStorage(STORAGE.profiles, {}),
  user: readStorage(STORAGE.auth, null),
  currentCategory: "all",
  currentSort: "default",
  paymentMethod: "card",
  shippingMethod: "free"
};

// Flag used to avoid registering the same auth menu click handler more than once.
let authMenuListenerAdded = false;

// Check if a user is currently signed in.
function isAuthenticated() {
  return Boolean(state.user && state.user.email);
}

// Create or update the auth/profile action in the top navigation.
function renderAuthAction() {
  const navIcons = document.querySelector(".nav-icons");
  if (!navIcons) {
    return;
  }

  let authLink = document.getElementById("auth-action-link");
  if (!authLink) {
    authLink = document.createElement("div");
    authLink.className = "nav-icon auth-action";
    authLink.id = "auth-action-link";
    authLink.tabIndex = 0;
    navIcons.appendChild(authLink);
  }

  const menuContent = isAuthenticated()
    ? `
      <a class="auth-menu-link" href="profile.html" id="auth-profile">Profile</a>
      
      <button class="auth-menu-link" type="button" id="auth-logout">Logout</button>
    `
    : `<a class="auth-menu-link" href="signin.html">Sign In</a>`;

  authLink.innerHTML = `
    <span class="auth-icon">👤</span>
    <div class="auth-menu" aria-label="Account menu">
      ${menuContent}
    </div>
  `;

  authLink.classList.remove("open");
  // Toggle the dropdown menu when the auth icon is clicked.
  authLink.onclick = (event) => {
    event.stopPropagation();
    authLink.classList.toggle("open");
  };

  const logoutButton = authLink.querySelector("#auth-logout");
  if (logoutButton) {
    logoutButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      authLink.classList.remove("open");
      logoutUser();
    };
  }

  if (!authMenuListenerAdded) {
    document.addEventListener("click", (event) => {
      const authNode = document.getElementById("auth-action-link");
      if (!authNode) {
        return;
      }
      if (!authNode.contains(event.target)) {
        authNode.classList.remove("open");
      }
    });
    authMenuListenerAdded = true;
  }
}

// Save signed-in user info to state and localStorage, then refresh nav UI.
function setAuthenticatedUser(user) {
  state.user = {
    name: user.name,
    email: user.email
  };
  saveStorage(STORAGE.auth, state.user);
  ensureProfileRecord(state.user);
  renderAuthAction();
}

// Log the user out, clear auth state, and redirect if needed.
function logoutUser() {
  // Clear user authentication
  state.user = null;
  saveStorage(STORAGE.auth, null);
  
  // Clear cart and orders when logging out
  state.cart = [];
  state.orders = [];
  saveStorage(STORAGE.cart, []);
  saveStorage(STORAGE.orders, []);
  
  // Update UI immediately
  renderAuthAction();
  updateCountBadges();
  
  // Re-render current page content if needed
  if (page === "cart") {
    renderCartPage();
  }
  if (page === "orders") {
    renderOrdersPage();
  }
  
  // Redirect to home page
  if (!window.location.pathname.endsWith("index.html")) {
    window.location.href = "index.html";
  }
}

// Validate login credentials and sign in the user if matching data exists.
function loginUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = state.users.find((item) => item.email === normalizedEmail);
  if (!user || user.password !== password) {
    return false;
  }
  setAuthenticatedUser(user);
  return true;
}

// Register a new user, persist their data, and log them in immediately.
function registerUser(name, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  if (state.users.some((item) => item.email === normalizedEmail)) {
    return false;
  }
  const newUser = {
    name: name.trim(),
    email: normalizedEmail,
    password
  };
  state.users.push(newUser);
  saveStorage(STORAGE.users, state.users);
  setAuthenticatedUser(newUser);
  return true;
}

// Read a redirect URL from query parameters if present.
function getRedirectTarget(defaultTarget = "index.html") {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || defaultTarget;
}

// Check whether the current user has already placed at least one order.
function hasPreviousOrder() {
  return Boolean(state.user?.email) && state.orders.some((order) => order.userEmail === state.user.email);
}

// Decide whether cart checkout should use the saved-profile review page.
function getCartCheckoutTarget() {
  const profile = getProfileRecord();
  const hasSavedAddress = Boolean(getPrimaryAddress(profile));

  if (isAuthenticated() && hasSavedAddress && hasPreviousOrder()) {
    return "checkout-review.html";
  }

  return "checkout.html";
}

// Navigate to the sign-in page and preserve the return target.
function redirectToSignin(target = "checkout.html") {
  window.location.href = `signin.html?redirect=${encodeURIComponent(target)}`;
}

// URL mapping from category keys to shop pages.
const CATEGORY_PAGE = {
  all: "products.html",
  skincare: "products-skincare.html",
  makeup: "products-makeup.html",
  fragrance: "products-fragrance.html"
};

// Mapping from member IDs to their profile page URLs.
const MEMBER_PAGE = {
  arizza: "member-arizza.html",
  maverick: "member-maverick.html",
  erika: "member-erika.html",
  justin: "member-justin.html",
  johnley: "member-johnley.html"
};

// Load guards to prevent duplicate data fetching.
let productsLoaded = false;
let teamLoaded = false;

document.addEventListener("DOMContentLoaded", init);

// Main application bootstrap function.
async function init() {
  setupMobileMenu();
  setupModalClose();
  await ensureProducts();
  await ensureTeam();

  updateCountBadges();
  renderAuthAction();

  if (page === "home") {
    renderHomeSections();
    setupReviewModal();
    setupTestimonialScroll();
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
    if (!isAuthenticated()) {
      redirectToSignin("checkout.html");
      return;
    }

    renderCheckoutPage();
    setupCheckout();
  }

  if (page === "checkout-review") {
    if (!isAuthenticated()) {
      redirectToSignin("checkout-review.html");
      return;
    }

    const profile = getProfileRecord();
    if (!state.cart || state.cart.length === 0) {
      window.location.href = "cart.html";
      return;
    }

    if (!getPrimaryAddress(profile) || !hasPreviousOrder()) {
      window.location.href = "checkout.html";
      return;
    }

    renderCheckoutReviewPage();
    setupCheckoutReview();
  }

  if (page === "login") {
    initLoginPage();
  }

  if (page === "signin") {
    initSigninPage();
  }

  if (page === "orders") {
    renderOrdersPage();
  }

  if (page === "profile") {
    renderProfilePage();
    setupProfilePage();
  }
}

// Load products from JSON only once; use fallback data if loading fails.
async function ensureProducts() {
  if (productsLoaded) {
    return;
  }

  state.products = await loadJson("data/products.json", getFallbackProducts());
  productsLoaded = true;
}

// Load team data from JSON only once; use fallback data if loading fails.
async function ensureTeam() {
  if (teamLoaded) {
    return;
  }

  state.team = await loadJson("data/team.json", getFallbackTeam());
  teamLoaded = true;
}

// Utility to fetch JSON and return fallback data if the request fails.
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

// Enable the mobile navigation toggle button.
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

// Set up the review modal and star rating interactions.
function setupReviewModal() {
  const writeReviewBtn = document.getElementById("write-review-btn");
  const reviewModal = document.getElementById("review-modal");
  const reviewModalClose = document.getElementById("review-modal-close");
  const reviewForm = document.getElementById("review-form");
  const starSelector = document.getElementById("star-selector");
  const reviewRating = document.getElementById("review-rating");

  // Add staggered animations to existing testimonial cards
  const existingCards = document.querySelectorAll(".stats-card");
  existingCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.2}s`;
  });

  if (!writeReviewBtn || !reviewModal) {
    return;
  }

  // Open review modal when button is clicked.
  writeReviewBtn.onclick = () => {
    reviewModal.classList.add("show");
  };

  // Close review modal when close button is clicked.
  if (reviewModalClose) {
    reviewModalClose.onclick = () => {
      reviewModal.classList.remove("show");
    };
  }

  // Handle star rating selection.
  if (starSelector) {
    starSelector.onclick = (event) => {
      const starBtn = event.target.closest(".star-btn");
      if (!starBtn) {
        return;
      }
      event.preventDefault();
      const rating = starBtn.dataset.rating;
      reviewRating.value = rating;

      // Update active star styling.
      for (const btn of starSelector.querySelectorAll(".star-btn")) {
        btn.classList.remove("active");
      }
      for (let i = 0; i < rating; i++) {
        starSelector.querySelectorAll(".star-btn")[i].classList.add("active");
      }
    };

    // Initialize first 5 stars as active (default rating).
    const starBtns = starSelector.querySelectorAll(".star-btn");
    for (let i = 0; i < 5; i++) {
      starBtns[i].classList.add("active");
    }
  }

  // Handle form submission.
  if (reviewForm) {
    reviewForm.onsubmit = (event) => {
      event.preventDefault();
      const name = document.getElementById("review-name").value.trim();
      const text = document.getElementById("review-text").value.trim();
      const rating = reviewRating.value;

      if (!name || !text) {
        showToast("Please fill in all fields.");
        return;
      }

      // Add review to testimonials summary section.
      const testimonialGrid = document.querySelector(".testimonial-summary-grid");
      if (testimonialGrid) {
        const existingCards = testimonialGrid.querySelectorAll(".stats-card").length;
        const newReview = document.createElement("article");
        newReview.className = "stats-card";
        newReview.style.animationDelay = `${existingCards * 0.2}s`;
        newReview.innerHTML = `
            <div class="rating-row">
              <span class="rating-number">${rating}.0</span>
              <span class="rating-stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>
            </div>
          <p>"${text}"</p>
          <strong>- ${name}</strong>
        `;
        testimonialGrid.appendChild(newReview);
      }

      // Show success message and close modal.
      showToast("Thank you for your review!");
      reviewForm.reset();
      reviewModal.classList.remove("show");
      reviewRating.value = "5";

      // Reset stars to default.
      const starBtns = starSelector.querySelectorAll(".star-btn");
      for (let i = 0; i < 5; i++) {
        starBtns[i].classList.add("active");
      }
    };
  }
}

// Highlight the center testimonial card while scrolling.
function setupTestimonialScroll() {
  const testimonialGrid = document.querySelector(".testimonial-summary-grid");
  if (!testimonialGrid) {
    return;
  }

  const cards = Array.from(testimonialGrid.querySelectorAll(".stats-card"));
  if (!cards.length) {
    return;
  }

  const updateActiveCard = () => {
    const center = testimonialGrid.scrollLeft + testimonialGrid.clientWidth / 2;
    let closest = null;
    let distance = Infinity;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2 + window.scrollX;
      const gridLeft = testimonialGrid.getBoundingClientRect().left + window.scrollX;
      const relativeCenter = cardCenter - gridLeft + testimonialGrid.scrollLeft;
      const currentDistance = Math.abs(relativeCenter - center);
      if (currentDistance < distance) {
        distance = currentDistance;
        closest = card;
      }
    });

    cards.forEach((card) => card.classList.toggle("active-card", card === closest));
  };

  testimonialGrid.addEventListener("scroll", () => {
    window.requestAnimationFrame(updateActiveCard);
  });

  window.addEventListener("resize", () => {
    window.requestAnimationFrame(updateActiveCard);
  });

  updateActiveCard();
}

// Render the featured home page product sections.
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

// Initialize category chips and sort controls on the products page.
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

// Apply category filtering and sorting to the products grid.
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

// Render a list of product cards into the provided container.
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

// Build the HTML for a single product card from product data.
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

// Open the quick-view modal for the selected product.
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

// Close the product modal when clicking outside its content area.
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

// Initialize login page form and behavior.
function initLoginPage() {
  if (isAuthenticated()) {
    window.location.href = getRedirectTarget("index.html");
    return;
  }

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const signupLink = document.getElementById("login-signup-link");
  const redirectTarget = getRedirectTarget("index.html");

  if (signupLink) {
    signupLink.href = `signin.html?redirect=${encodeURIComponent(redirectTarget)}`;
  }

  if (!form || !emailInput || !passwordInput) {
    return;
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showToast("Please enter your email and password.");
      return;
    }

    if (loginUser(email, password)) {
      window.location.href = redirectTarget;
      return;
    }

    showToast("Email or password is incorrect.");
  };
}

// Initialize sign-up page form and behavior.
function initSigninPage() {
  if (isAuthenticated()) {
    window.location.href = getRedirectTarget("index.html");
    return;
  }

  const form = document.getElementById("signin-form");
  const nameInput = document.getElementById("signin-name");
  const emailInput = document.getElementById("signin-email");
  const passwordInput = document.getElementById("signin-password");
  const confirmPasswordInput = document.getElementById("signin-confirm-password");
  const loginLink = document.getElementById("signin-login-link");
  const redirectTarget = getRedirectTarget("index.html");

  if (loginLink) {
    loginLink.href = `login.html?redirect=${encodeURIComponent(redirectTarget)}`;
  }

  if (!form || !nameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
    return;
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!name || !email || !password || !confirmPassword) {
      showToast("Please complete all fields to create an account.");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      showToast("Password must be at least 8 characters.");
      return;
    }

    if (!registerUser(name, email, password)) {
      showToast("An account with that email already exists.");
      return;
    }

    window.location.href = redirectTarget;
  };
}

// Toggle the favorite state for a product and save it to storage.
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

// Add a product to the cart, increase quantity if already present.
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

// Build and display the shopping cart page content.
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

  const subtotal = calculateCartTotal();
  const shippingFee = 0;
  const total = subtotal + shippingFee;
  subtotalNode.textContent = `₱ ${formatPrice(subtotal)}`;
  // update shipping line inside cart summary if present
  const cartSummaryEl = document.getElementById("cart-summary");
  if (cartSummaryEl) {
    const rows = Array.from(cartSummaryEl.querySelectorAll(".summary-row"));
    const shipRow = rows.find((r) => r.querySelector("span") && r.querySelector("span").textContent.trim() === "Shipping");
    if (shipRow) {
      shipRow.querySelector("strong").textContent = shippingFee > 0 ? `P ${formatPrice(shippingFee)}` : "Free";
    }
  }
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
    if (!isAuthenticated()) {
      redirectToSignin("checkout.html");
      return;
    }

    if (!state.cart || state.cart.length === 0) {
      showToast('Cart is empty');
      return;
    }
    window.location.href = getCartCheckoutTarget();
  };
}

// Create an order using current cart, shipping and payment selections (used for quick-order from cart)
function createOrderFromCart(primaryAddr) {
  if (!isAuthenticated() || !state.user?.email) {
    showToast("Please sign in to complete checkout.");
    redirectToSignin("checkout.html");
    return;
  }

  try {
    const shipping = getShippingOptionDetails(state.shippingMethod);
    const subtotal = calculateCartTotal();
    const total = subtotal + shipping.fee;
    const timestamp = new Date();
    const orderId = `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const addressRecord = {
      id: primaryAddr.id || `addr-${Date.now()}`,
      label: primaryAddr.fullName || `${primaryAddr.firstName} ${primaryAddr.lastName}`,
      fullName: primaryAddr.fullName || `${primaryAddr.firstName} ${primaryAddr.lastName}`,
      firstName: primaryAddr.firstName || "",
      lastName: primaryAddr.lastName || "",
      email: primaryAddr.email || state.user.email,
      phone: primaryAddr.phone || "",
      addressLine: primaryAddr.addressLine || "",
      city: primaryAddr.city || "",
      province: primaryAddr.province || "",
      zip: primaryAddr.zip || "",
      shippingMethod: state.shippingMethod,
      paymentMethod: state.paymentMethod,
      isDefault: true
    };

    const newOrder = {
      id: orderId,
      date: timestamp.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      method: getPaymentLabel(state.paymentMethod),
      shipping: {
        method: shipping.key,
        label: shipping.label,
        fee: shipping.fee,
        eta: shipping.eta
      },
      shippingAddress: { ...addressRecord },
      status: "Processing",
      items: state.cart.map((entry) => ({ ...entry })),
      subtotal,
      total,
      userEmail: state.user.email
    };

    state.orders.unshift(newOrder);
    saveStorage(STORAGE.orders, state.orders);

    state.cart = [];
    saveStorage(STORAGE.cart, state.cart);
    updateCountBadges();
    window.location.href = "orders.html";
  } catch (err) {
    console.error('Quick checkout error:', err);
    showToast('An error occurred while placing your order.');
  }
}

// Render the checkout summary and payment section.
function renderCheckoutPage() {
  const summary = document.getElementById("checkout-summary");
  const payNowBtn = document.getElementById("pay-now-btn");
  const cardFields = document.getElementById("card-fields");
  const customerSummary = document.getElementById("checkout-customer-summary");

  if (!summary || !payNowBtn || !cardFields) {
    return;
  }

  const cartDetails = state.cart
    .map((entry) => {
      const product = state.products.find((item) => item.id === entry.id);
      return product ? { ...product, qty: entry.qty } : null;
    })
    .filter(Boolean);

  const subtotal = calculateCartTotal();
  const shipping = getShippingOptionDetails(state.shippingMethod);
  const total = subtotal + shipping.fee;

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
    <div class="summary-row"><span>Subtotal</span><strong>P ${formatPrice(subtotal)}</strong></div>
    <div class="summary-row"><span>Shipping</span><strong>${shipping.label} - P ${formatPrice(shipping.fee)}</strong></div>
    <div class="summary-row"><span>Delivery</span><strong>${shipping.eta}</strong></div>
    <div class="summary-row total"><span>Total</span><strong>P ${formatPrice(total)}</strong></div>
  `;

  payNowBtn.textContent = `${state.paymentMethod === "cod" ? "Place Order" : "Pay Now"} - P ${formatPrice(total)}`;

  if (state.paymentMethod === "cod") {
    cardFields.classList.add("hidden");
  } else {
    cardFields.classList.remove("hidden");
  }

  if (customerSummary) {
    const profile = getProfileRecord();
    const address = getPrimaryAddress(profile);
    if (address) {
      customerSummary.classList.remove("is-empty");
      customerSummary.innerHTML = `
        <span class="checkout-customer-label">Saved profile</span>
        <strong>${address.fullName} | ${address.phone}</strong>
        <p>${formatAddressLine(address)}</p>
        <small>${getShippingOptionDetails(profile.shippingMethod || state.shippingMethod).label} · ${getPaymentLabel(profile.paymentMethod || state.paymentMethod)}</small>
      `;
    } else {
      customerSummary.classList.add("is-empty");
      customerSummary.innerHTML = ``;
    }
  }
}

// Render the saved-profile review page for returning customers.
function renderCheckoutReviewPage() {
  const summary = document.getElementById("checkout-review-summary");
  const customerSummary = document.getElementById("checkout-review-customer-summary");
  const shippingCard = document.getElementById("review-shipping-card");
  const paymentCard = document.getElementById("review-payment-card");
  const continueBtn = document.getElementById("checkout-review-continue");

  if (!summary || !customerSummary || !shippingCard || !paymentCard || !continueBtn) {
    return;
  }

  const profile = getProfileRecord();
  const primaryAddress = getPrimaryAddress(profile);
  const shipping = getShippingOptionDetails(profile.shippingMethod || state.shippingMethod);
  const paymentMethod = profile.paymentMethod || state.paymentMethod || "card";

  state.shippingMethod = shipping.key;
  state.paymentMethod = paymentMethod;

  if (primaryAddress) {
    customerSummary.classList.remove("is-empty");
    customerSummary.href = "profile.html";
    customerSummary.innerHTML = `
      <span class="checkout-customer-label">Saved profile</span>
      <strong>${primaryAddress.fullName || profile.fullName || state.user?.name || "Customer"} | ${primaryAddress.phone || profile.phone || ""}</strong>
      <p>${formatAddressLine(primaryAddress)}</p>
    `;
  }

  const freeShipping = getShippingOptionDetails("free");
  const standardShipping = getShippingOptionDetails("standard");

  shippingCard.innerHTML = `
    <div class="method-card-title">Shipping</div>
    <div class="method-list">
      <button class="method-option ${state.shippingMethod === "free" ? "active" : ""}" type="button" data-shipping="free">
        <strong>${freeShipping.label}</strong>
        <span>Free · ${freeShipping.eta}</span>
      </button>
      <button class="method-option ${state.shippingMethod === "standard" ? "active" : ""}" type="button" data-shipping="standard">
        <strong>${standardShipping.label}</strong>
        <span>P ${formatPrice(standardShipping.fee)} · ${standardShipping.eta}</span>
      </button>
    </div>
  `;

  paymentCard.innerHTML = `
    <div class="method-card-title">Payment Method</div>
    <div class="method-list">
      <button class="method-option ${paymentMethod === "card" ? "active" : ""}" type="button" data-payment="card">
        <strong>Online Payment</strong>
        <span>Debit / Credit card</span>
      </button>
      <button class="method-option ${paymentMethod === "cod" ? "active" : ""}" type="button" data-payment="cod">
        <strong>Cash on Delivery</strong>
        <span>Pay when you receive</span>
      </button>
    </div>
  `;

  const cartDetails = state.cart
    .map((entry) => {
      const product = state.products.find((item) => item.id === entry.id);
      return product ? { ...product, qty: entry.qty } : null;
    })
    .filter(Boolean);

  const subtotal = calculateCartTotal();
  const total = subtotal + shipping.fee;

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
    <div class="summary-row"><span>Subtotal</span><strong>P ${formatPrice(subtotal)}</strong></div>
    <div class="summary-row"><span>Shipping</span><strong>${shipping.label} - P ${formatPrice(shipping.fee)}</strong></div>
    <div class="summary-row"><span>Delivery</span><strong>${shipping.eta}</strong></div>
    <div class="summary-row total"><span>Total</span><strong>P ${formatPrice(total)}</strong></div>
  `;

  continueBtn.textContent = `Continue - P ${formatPrice(total)}`;
}

// Set up the saved-profile review page interactions and order placement.
function setupCheckoutReview() {
  const shippingCard = document.getElementById("review-shipping-card");
  const paymentCard = document.getElementById("review-payment-card");
  const continueBtn = document.getElementById("checkout-review-continue");
  const paymentModal = document.getElementById("payment-modal");
  const paymentModalClose = document.getElementById("payment-modal-close");
  const paymentCancel = document.getElementById("payment-cancel");
  const paymentForm = document.getElementById("payment-form");

  if (!shippingCard || !paymentCard || !continueBtn) {
    return;
  }

  function openPaymentModal() {
    if (!paymentModal) {
      return;
    }

    paymentModal.classList.add("show");
    paymentModal.setAttribute("aria-hidden", "false");
  }

  function closePaymentModal() {
    if (!paymentModal) {
      return;
    }

    paymentModal.classList.remove("show");
    paymentModal.setAttribute("aria-hidden", "true");
  }

  if (paymentModalClose) {
    paymentModalClose.onclick = closePaymentModal;
  }

  if (paymentCancel) {
    paymentCancel.onclick = closePaymentModal;
  }

  shippingCard.onclick = (event) => {
    const option = event.target.closest("button[data-shipping]");
    if (!option) {
      return;
    }

    state.shippingMethod = option.dataset.shipping;
    const profile = getProfileRecord();
    if (profile) {
      saveProfileRecord(profile.email, {
        ...profile,
        shippingMethod: state.shippingMethod
      });
    }
    renderCheckoutReviewPage();
  };

  paymentCard.onclick = (event) => {
    const option = event.target.closest("button[data-payment]");
    if (!option) {
      return;
    }

    const selectedPayment = option.dataset.payment;

    if (selectedPayment === "card") {
      openPaymentModal();
      return;
    }

    state.paymentMethod = selectedPayment;
    const profile = getProfileRecord();
    if (profile) {
      saveProfileRecord(profile.email, {
        ...profile,
        paymentMethod: state.paymentMethod
      });
    }
    renderCheckoutReviewPage();
  };

  if (paymentForm) {
    paymentForm.onsubmit = (event) => {
      event.preventDefault();

      const cardName = document.getElementById("card-name")?.value.trim();
      const cardNumber = document.getElementById("card-number")?.value.replace(/\s+/g, "");
      const cardExp = document.getElementById("card-exp")?.value.trim();
      const cardCvv = document.getElementById("card-cvv")?.value.trim();

      if (!cardName || !cardNumber || cardNumber.length < 12 || !cardExp || !cardCvv || cardCvv.length < 3) {
        showToast("Please complete card details.");
        return;
      }

      state.paymentMethod = "card";
      const profile = getProfileRecord();
      if (profile) {
        saveProfileRecord(profile.email, {
          ...profile,
          paymentMethod: "card"
        });
      }

      closePaymentModal();
      paymentCard.querySelectorAll("button[data-payment]").forEach((button) => button.classList.remove("active"));
      const active = paymentCard.querySelector('button[data-payment="card"]');
      if (active) {
        active.classList.add("active");
      }

      showToast("Payment method saved.");
      renderCheckoutReviewPage();
    };
  }

  continueBtn.onclick = () => {
    if (!isAuthenticated() || !state.user?.email) {
      showToast("Please sign in to complete checkout.");
      redirectToSignin("checkout-review.html");
      return;
    }

    const profile = getProfileRecord();
    const primaryAddress = getPrimaryAddress(profile);

    if (!primaryAddress) {
      showToast("Please save a profile address first.");
      window.location.href = "checkout.html";
      return;
    }

    saveProfileRecord(profile.email, {
      ...profile,
      shippingMethod: state.shippingMethod,
      paymentMethod: state.paymentMethod
    });

    createOrderFromCart(primaryAddress);
  };
}

// Set up checkout payment option controls and order submission.
function setupCheckout() {
  const paymentWrap = document.getElementById("payment-options");
  const shippingWrap = document.getElementById("shipping-options");
  const form = document.getElementById("checkout-form");
  const firstNameInput = document.getElementById("checkout-first-name");
  const lastNameInput = document.getElementById("checkout-last-name");
  const emailInput = document.getElementById("checkout-email");
  const phoneInput = document.getElementById("checkout-phone");
  const addressInput = document.getElementById("checkout-address");
  const cityInput = document.getElementById("checkout-city");
  const provinceInput = document.getElementById("checkout-province");
  const zipInput = document.getElementById("checkout-zip");

  if (!paymentWrap || !form) {
    return;
  }

  bindDigitsOnlyInputs(form);
  populateCheckoutFormFromProfile();

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

  if (shippingWrap) {
    shippingWrap.onclick = (event) => {
      const option = event.target.closest("button[data-shipping]");
      if (!option) {
        return;
      }

      state.shippingMethod = option.dataset.shipping;
      for (const item of shippingWrap.querySelectorAll(".shipping-option")) {
        item.classList.remove("active");
      }
      option.classList.add("active");
      renderCheckoutPage();
    };
  }

  form.onsubmit = (event) => {
    event.preventDefault();

    if (state.cart.length === 0) {
      showToast("Cart is empty");
      return;
    }

    if (!isAuthenticated() || !state.user?.email) {
      showToast("Please sign in to complete checkout.");
      redirectToSignin("checkout.html");
      return;
    }

    try {
      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.replace(/\D/g, "");
      const addressLine = addressInput.value.trim();
      const city = cityInput.value.trim();
      const province = provinceInput.value.trim();
      const zip = zipInput.value.replace(/\D/g, "");
      const shipping = getShippingOptionDetails(state.shippingMethod);

      if (!firstName || !lastName || !email || !phone || !addressLine || !city || !province || !zip) {
        showToast("Please complete all checkout fields.");
        return;
      }

      const fullName = `${firstName} ${lastName}`.trim();
      const timestamp = new Date();
      const orderId = `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const subtotal = calculateCartTotal();
      const total = subtotal + shipping.fee;

      const addressRecord = {
        id: `addr-${Date.now()}`,
        label: fullName,
        fullName,
        firstName,
        lastName,
        email,
        phone,
        addressLine,
        city,
        province,
        zip,
        shippingMethod: state.shippingMethod,
        paymentMethod: state.paymentMethod,
        isDefault: true
      };

      const profile = getProfileRecord(state.user.email);
      const existingAddresses = Array.isArray(profile.addresses) ? profile.addresses.filter((item) => item.id !== profile.defaultAddressId) : [];
      const addresses = [addressRecord, ...existingAddresses].map((item, index) => ({
        ...item,
        isDefault: index === 0
      }));

      saveProfileRecord(state.user.email, {
        ...profile,
        fullName,
        email,
        phone,
        shippingMethod: state.shippingMethod,
        paymentMethod: state.paymentMethod,
        defaultAddressId: addressRecord.id,
        addresses
      });

      const newOrder = {
        id: orderId,
        date: timestamp.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        method: getPaymentLabel(state.paymentMethod),
        shipping: {
          method: shipping.key,
          label: shipping.label,
          fee: shipping.fee,
          eta: shipping.eta
        },
        shippingAddress: { ...addressRecord },
        status: "Processing",
        items: state.cart.map((entry) => ({ ...entry })),
        subtotal,
        total,
        userEmail: state.user.email
      };

      state.orders.unshift(newOrder);
      console.log('DEBUG: saving orders (count before save):', state.orders.length);
      saveStorage(STORAGE.orders, state.orders);
      console.log('DEBUG: saved orders (read back):', readStorage(STORAGE.orders, []).length);

      state.cart = [];
      console.log('DEBUG: clearing cart and saving (count before save):', state.cart.length);
      saveStorage(STORAGE.cart, state.cart);
      console.log('DEBUG: saved cart (read back):', readStorage(STORAGE.cart, []).length);

      updateCountBadges();
      window.location.href = "orders.html";
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('An error occurred while placing your order. Please try again.');
    }
  };
}

// Render the user's order history page.
function renderOrdersPage() {
  const list = document.getElementById("orders-list");
  if (!list) {
    return;
  }

  // Filter orders to only show current user's orders
  const userOrders = state.orders.filter(order => order.userEmail === state.user?.email);

  if (userOrders.length === 0) {
    list.innerHTML = "<p>No orders yet. Start shopping to place your first order.</p>";
    return;
  }

  list.innerHTML = userOrders
    .map((order) => {
      const firstItem = order.items[0];
      const product = state.products.find((item) => item.id === firstItem.id);
      const productName = product ? product.name : "Product";
      const productImage = product ? product.image : "";
      const shipping = order.shipping || getShippingOptionDetails();
      const shippingAddress = order.shippingAddress ? formatAddressLine(order.shippingAddress) : "";

      return `
        <article class="order-card">
          <div class="order-top">
            <div><span>Order ID</span><strong>${order.id}</strong></div>
            <div><span>Date Ordered</span><strong>${order.date}</strong></div>
            <div><span>Payment Method</span><strong>${order.method}</strong></div>
            <div><span>Shipping</span><strong>${shipping.label} - P ${formatPrice(shipping.fee)}</strong></div>
            <div><span>Delivery</span><strong>${shipping.eta}</strong></div>
            <div><span>Total</span><strong>P ${formatPrice(order.total)}</strong></div>
            <span class="status-pill">${order.status}</span>
          </div>
          <div class="order-details">
            <strong>${order.shippingAddress?.fullName || state.user?.name || "Customer"}</strong>
            <p>${shippingAddress}</p>
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

// Render the profile page with saved account and address data.
function renderProfilePage() {
  const account = document.getElementById("profile-account");
  const list = document.getElementById("profile-address-list");
  const title = document.getElementById("profile-form-title");
  const cancelButton = document.getElementById("profile-cancel-edit");
  const signoutButton = document.getElementById("profile-signout");

  if (!account || !list || !title || !cancelButton || !signoutButton) {
    return;
  }

  if (!isAuthenticated()) {
    window.location.href = "login.html?redirect=profile.html";
    return;
  }

  const profile = getProfileRecord();
  const primaryAddress = getPrimaryAddress(profile);
  const shipping = getShippingOptionDetails(profile.shippingMethod || state.shippingMethod);

  account.innerHTML = `
    <div class="profile-summary-grid">
      <div><span>Name</span><strong>${profile.fullName || state.user?.name || "—"}</strong></div>
      <div><span>Email</span><strong>${profile.email || state.user?.email || "—"}</strong></div>
      <div><span>Phone</span><strong>${profile.phone || "—"}</strong></div>
      <div><span>Address</span><strong>${primaryAddress ? formatAddressLine(primaryAddress) : "No address saved yet"}</strong></div>
    </div>
  `;

  list.innerHTML = profile.addresses.length
    ? profile.addresses
      .map((address) => `
        <article class="profile-address-item ${address.isDefault ? "active" : ""}">
          <div>
            <strong>${address.fullName}</strong>
            <p>${address.phone}</p>
            <p>${formatAddressLine(address)}</p>
            
          </div>
          <div class="profile-address-actions">
            <button type="button" class="link-action" data-profile-address="edit" data-address-id="${address.id}">Edit</button>
            <button type="button" class="link-action" data-profile-address="default" data-address-id="${address.id}">${address.isDefault ? "✓" : "Set default"}</button>
          </div>
        </article>
      `)
      .join("")
    : `<p class="profile-empty">No addresses added.</p>`;

  title.textContent = "Add address";
  cancelButton.textContent = "Cancel";
  signoutButton.onclick = () => logoutUser();
}

// Set up profile page interactions.
function setupProfilePage() {
  const form = document.getElementById("profile-address-form");
  const addButton = document.getElementById("profile-add-address");
  const cancelButton = document.getElementById("profile-cancel-edit");
  const list = document.getElementById("profile-address-list");
  const addressIdInput = document.getElementById("profile-address-id");
  const title = document.getElementById("profile-form-title");
  const firstNameInput = document.getElementById("profile-first-name");
  const lastNameInput = document.getElementById("profile-last-name");
  const emailInput = document.getElementById("profile-email");
  const phoneInput = document.getElementById("profile-phone");
  const addressLineInput = document.getElementById("profile-address-line");
  const cityInput = document.getElementById("profile-city");
  const provinceInput = document.getElementById("profile-province");
  const zipInput = document.getElementById("profile-zip");
  const defaultCheckbox = document.getElementById("profile-set-default");

  if (!form || !addButton || !cancelButton || !list || !addressIdInput || !title) {
    return;
  }

  bindDigitsOnlyInputs(form);

  function resetForm() {
    addressIdInput.value = "";
    form.reset();
    title.textContent = "Add address";
    if (defaultCheckbox) {
      defaultCheckbox.checked = true;
    }
  }

  function loadAddressToForm(address) {
    if (!address) {
      return;
    }

    addressIdInput.value = address.id;
    firstNameInput.value = address.firstName || "";
    lastNameInput.value = address.lastName || "";
    emailInput.value = address.email || state.user?.email || "";
    phoneInput.value = address.phone || "";
    addressLineInput.value = address.addressLine || "";
    cityInput.value = address.city || "";
    provinceInput.value = address.province || "";
    zipInput.value = address.zip || "";
    defaultCheckbox.checked = Boolean(address.isDefault);
    title.textContent = "Edit address";
  }

  addButton.onclick = () => {
    resetForm();
    firstNameInput.focus();
  };

  cancelButton.onclick = () => {
    resetForm();
  };

  list.onclick = (event) => {
    const button = event.target.closest("button[data-profile-address]");
    if (!button) {
      return;
    }

    const profile = getProfileRecord();
    const address = profile.addresses.find((item) => item.id === button.dataset.addressId);
    if (!address) {
      return;
    }

    if (button.dataset.profileAddress === "edit") {
      loadAddressToForm(address);
      return;
    }

    if (button.dataset.profileAddress === "default") {
      const nextAddresses = profile.addresses.map((item) => ({
        ...item,
        isDefault: item.id === address.id
      }));
      saveProfileRecord(profile.email, {
        ...profile,
        defaultAddressId: address.id,
        addresses: nextAddresses
      });
      renderProfilePage();
    }
  };

  form.onsubmit = (event) => {
    event.preventDefault();

    const profile = getProfileRecord();
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.replace(/\D/g, "");
    const addressLine = addressLineInput.value.trim();
    const city = cityInput.value.trim();
    const province = provinceInput.value.trim();
    const zip = zipInput.value.replace(/\D/g, "");

    if (!firstName || !lastName || !email || !phone || !addressLine || !city || !province || !zip) {
      showToast("Please complete the address form.");
      return;
    }

    const addressId = addressIdInput.value || `addr-${Date.now()}`;
    const fullName = `${firstName} ${lastName}`.trim();
    const existingAddresses = profile.addresses.filter((item) => item.id !== addressId);
    const nextAddress = {
      id: addressId,
      label: fullName,
      fullName,
      firstName,
      lastName,
      email,
      phone,
      addressLine,
      city,
      province,
      zip,
      isDefault: defaultCheckbox ? defaultCheckbox.checked : true
    };

    const addresses = [nextAddress, ...existingAddresses].map((item, index) => ({
      ...item,
      isDefault: index === 0 || (defaultCheckbox ? defaultCheckbox.checked && item.id === nextAddress.id : index === 0)
    }));

    saveProfileRecord(profile.email, {
      ...profile,
      fullName: profile.fullName || fullName,
      email,
      phone,
      defaultAddressId: nextAddress.id,
      addresses
    });

    renderProfilePage();
    resetForm();
    showToast("Address saved.");
  };

  if (profile.addresses.length > 0) {
    loadAddressToForm(getPrimaryAddress(profile));
  } else {
    resetForm();
  }
}

// Render the team member cards on the about page.
function renderTeamOverview() {
  const grid = document.getElementById("team-grid");
  if (!grid) {
    return;
  }

  grid.innerHTML = state.team
    .map(
      (member) => `
      <article class="team-card">
        <img class="team-photo" src="${member.cardImage || member.image}" alt="${member.name}" />
        <h3>${member.name}</h3>
        <p class="role">${member.role}</p>
        <p>${member.about}</p>
        <a class="view-profile" href="${MEMBER_PAGE[member.id] || "member-arizza.html"}">View Profile →</a>
      </article>
    `
    )
    .join("");
}

// Render the selected team member's profile page details.
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

  const skillTagsMarkup = member.skills
    .map((skill) => {
      const link = member.skillLinks && member.skillLinks[skill];
      const isAnchor = typeof link === "string" && link.startsWith("#");
      if (!link) {
        return `<span>${skill}</span>`;
      }
      return `<a href="${link}" ${isAnchor ? "" : "target=\"_blank\" rel=\"noopener noreferrer\""}>${skill}</a>`;
    })
    .join("");

  const profileNameMarkup = member.facebook
    ? `<a href="${member.facebook}" target="_blank" rel="noopener noreferrer">${member.name}</a>`
    : member.name;

  const valuesMarkup = (member.values || [])
    .map(
      (value) => `
        <article class="profile-feature-card">
          <h4>${value.title}</h4>
          <p>${value.description}</p>
        </article>
      `
    )
    .join("");

  wrap.innerHTML = `
    <section class="profile-box">
      <a class="back-link" href="about.html">← Back to Team</a>

      <div class="profile-hero card-surface">
        <div class="profile-intro">
          <p class="profile-eyebrow">Creating Digital Experiences</p>
          <h1>${member.heroTitle || `Hi, I am ${member.name.split(" ")[0]}`}</h1>
          <p class="profile-name">${member.name}</p>
          <p class="profile-role-summary">${member.role}</p>
          <p class="profile-lead">${member.heroSubtitle || "Aspiring Web and Mobile Developer · Content Creator · Editor"}</p>
          <p class="profile-copy">${member.heroCopy || "I create beautiful, functional, and user-friendly digital experiences. Passionate about turning ideas into reality through clean code and innovative design."}</p>
          <div class="profile-actions">
            ${member.projectLink ? `<a class="profile-button" href="${member.projectLink}" target="_blank" rel="noopener noreferrer">View Projects</a>` : ""}
            ${member.facebook ? `<a class="profile-button secondary" href="${member.facebook}" target="_blank" rel="noopener noreferrer">Contact Me</a>` : ""}
          </div>
        </div>
        <figure class="profile-figure">
          <img src="${member.image}" alt="${member.name}" />
        </figure>
      </div>

      <div class="profile-details">
        <div class="profile-block profile-about-grid">
          <div class="profile-about-image">
            <img src="${member.aboutImage || member.image}" alt="${member.name}" />
          </div>
          <div class="profile-about-copy">
            <h3>Who I am</h3>
            <p>${member.about || "I’m passionate about technology, creativity, and building digital ideas into real-world solutions."}</p>
            <p>${member.aboutDetail || "I help beauty, lifestyle, and digital brands tell stories that feel authentic, trendy, and engaging through creative content and aesthetic visuals."}</p>
            <p>${member.aboutExtra || "From social media captions and blog posts to polished long-form content, I create work that connects with people and helps brands build a strong online presence."}</p>
          </div>
        </div>

        <div class="profile-block" id="skills">
          <h3>Skills & Role</h3>
          <div class="skill-tags">
            ${skillTagsMarkup}
          </div>
          <p class="profile-meta"><strong>Role:</strong> ${member.role}</p>
        </div>

        <div class="profile-block profile-why-grid">
          <div>
            <h3>Why Choose Me</h3>
            <div class="profile-features">
              ${valuesMarkup}
            </div>
          </div>
          <div class="profile-why-image">
            <img src="${member.whyImage || member.aboutImage || member.image}" alt="Why choose me" />
          </div>
        </div>

        <div class="profile-block profile-contact-card">
          <h3>Let’s build something amazing together</h3>
          <p>${member.contactCopy || "Whether you need a creative website, a modern mobile app, or a developer who genuinely cares about quality and user experience — I’d love to help bring your ideas to life."}</p>
          <div class="profile-actions">
            ${member.projectLink ? `<a class="profile-button" href="${member.projectLink}" target="_blank" rel="noopener noreferrer">View Projects</a>` : ""}
            ${member.facebook ? `<a class="profile-button secondary" href="${member.facebook}" target="_blank" rel="noopener noreferrer">Message on Facebook</a>` : ""}
          </div>
        </div>
      </div>
    </section>
  `;
}

// Update the cart and orders badges shown in the top navigation.
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

// Re-render products when favorites or filters change.
function rerenderProductsForCurrentPage() {
  if (page === "home") {
    renderHomeSections();
  }

  if (page === "products") {
    applyShopView();
  }
}

// Calculate the total cart price using saved quantities.
function calculateCartTotal() {
  return state.cart.reduce((sum, entry) => {
    const product = state.products.find((item) => item.id === entry.id);
    return product ? sum + product.price * entry.qty : sum;
  }, 0);
}

// Show a temporary message toast to the user.
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

// Read a JSON value from localStorage with a fallback.
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Save a JSON serializable value to localStorage.
function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Load the current user's profile record.
function getProfileRecord(email = state.user?.email) {
  if (!email) {
    return {
      fullName: "",
      email: "",
      phone: "",
      addresses: [],
      defaultAddressId: "",
      shippingMethod: "free",
      paymentMethod: "card"
    };
  }

  const record = state.profiles[email] || {};
  return {
    fullName: "",
    email,
    phone: "",
    addresses: [],
    defaultAddressId: "",
    shippingMethod: "free",
    paymentMethod: "card",
    ...record,
    addresses: Array.isArray(record.addresses) ? record.addresses : []
  };
}

// Save a profile record for the current user.
function saveProfileRecord(email, record) {
  if (!email) {
    return;
  }

  state.profiles[email] = {
    ...getProfileRecord(email),
    ...record,
    email,
    addresses: Array.isArray(record.addresses) ? record.addresses : getProfileRecord(email).addresses
  };
  saveStorage(STORAGE.profiles, state.profiles);
}

// Ensure the current user has a profile record.
function ensureProfileRecord(user) {
  if (!user?.email) {
    return;
  }

  const existing = getProfileRecord(user.email);
  saveProfileRecord(user.email, {
    ...existing,
    fullName: existing.fullName || user.name || "",
    email: user.email
  });
}

// Return the shipping option details for a given method.
function getShippingOptionDetails(method = "free") {
  const options = {
    free: {
      key: "free",
      label: "Free Shipping",
      fee: 0,
      eta: "5-7 business days"
    },
    standard: {
      key: "standard",
      label: "Standard Shipping",
      fee: 120,
      eta: "2-4 business days"
    }
  };

  return options[method] || options.free;
}

// Format a payment method label.
function getPaymentLabel(method = "card") {
  return method === "cod" ? "Cash on Delivery" : "Pay via Card";
}

// Load the saved default address from a profile record.
function getPrimaryAddress(profile) {
  if (!profile || !Array.isArray(profile.addresses) || profile.addresses.length === 0) {
    return null;
  }

  return profile.addresses.find((item) => item.id === profile.defaultAddressId) || profile.addresses[0];
}

// Format an address into a single readable line.
function formatAddressLine(address) {
  if (!address) {
    return "";
  }

  return [address.addressLine, address.city, address.province, address.zip]
    .filter(Boolean)
    .join(", ");
}

// Keep digit-only fields clean as the user types.
function bindDigitsOnlyInputs(root) {
  if (!root) {
    return;
  }

  const inputs = root.querySelectorAll("[data-digits-only]");
  for (const input of inputs) {
    if (input.dataset.digitsBound === "true") {
      continue;
    }

    input.dataset.digitsBound = "true";
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
    });
  }
}

// Fill the checkout form from the saved profile, if one exists.
function populateCheckoutFormFromProfile() {
  const profile = getProfileRecord();
  const address = getPrimaryAddress(profile);
  const firstNameInput = document.getElementById("checkout-first-name");
  const lastNameInput = document.getElementById("checkout-last-name");
  const emailInput = document.getElementById("checkout-email");
  const phoneInput = document.getElementById("checkout-phone");
  const addressInput = document.getElementById("checkout-address");
  const cityInput = document.getElementById("checkout-city");
  const provinceInput = document.getElementById("checkout-province");
  const zipInput = document.getElementById("checkout-zip");
  const shippingWrap = document.getElementById("shipping-options");
  const paymentWrap = document.getElementById("payment-options");

  state.shippingMethod = profile.shippingMethod || state.shippingMethod || "free";
  state.paymentMethod = profile.paymentMethod || state.paymentMethod || "card";

  if (address) {
    firstNameInput.value = address.firstName || "";
    lastNameInput.value = address.lastName || "";
    emailInput.value = profile.email || state.user?.email || "";
    phoneInput.value = address.phone || profile.phone || "";
    addressInput.value = address.addressLine || "";
    cityInput.value = address.city || "";
    provinceInput.value = address.province || "";
    zipInput.value = address.zip || "";
  } else {
    emailInput.value = profile.email || state.user?.email || "";
  }

  if (shippingWrap) {
    for (const item of shippingWrap.querySelectorAll(".shipping-option")) {
      item.classList.toggle("active", item.dataset.shipping === state.shippingMethod);
    }
  }

  if (paymentWrap) {
    for (const item of paymentWrap.querySelectorAll(".payment-option")) {
      item.classList.toggle("active", item.dataset.payment === state.paymentMethod);
    }
  }
}

// Format a number as a Philippine peso amount.
function formatPrice(value) {
  return Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Provide fallback product data in case the JSON file cannot be loaded.
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
      image: "assets/Rectangle%203%20%281%29.png",
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
      image: "assets/Rectangle%206%20%281%29.png",
      description: "A clean floral fragrance layered with warm woody notes.",
      badge: "best",
      bestSeller: true,
      newArrival: false
    },
    {
      id: "p4",
      name: "Bene Tint",
      category: "makeup",
      price: 199,
      image: "assets/Rectangle%205.png",
      description: "Lightweight tint for cheeks and lips with natural blendable color.",
      badge: "new",
      bestSeller: false,
      newArrival: true
    },
    {
      id: "p5",
      name: "Bigglow Combo",
      category: "skincare",
      price: 399,
      image: "assets/Rectangle%204%20%281%29.png",
      description: "A brightening pair formulated to revive dull and tired skin.",
      badge: "best",
      bestSeller: true,
      newArrival: false
    },
    {
      id: "p6",
      name: "Second Sign Toner",
      category: "skincare",
      price: 499,
      image: "assets/Rectangle%203.png",
      description: "Balancing toner that preps skin for better moisture absorption.",
      badge: "new",
      bestSeller: false,
      newArrival: true
    },
    {
      id: "p7",
      name: "Naturliches Hazel Serum",
      category: "skincare",
      price: 249,
      image: "assets/Rectangle%205%20%281%29.png",
      description: "Clarifying serum with witch hazel and soothing botanical extracts.",
      badge: "best",
      bestSeller: true,
      newArrival: false
    },
    {
      id: "p8",
      name: "Blank Anti-aging Serum",
      category: "skincare",
      price: 499,
      image: "assets/Rectangle%206.png",
      description: "Restorative serum that helps soften lines and boost skin bounce.",
      badge: "new",
      bestSeller: false,
      newArrival: true
    },
    {
      id: "p9",
      name: "Peachy Parfum",
      category: "fragrance",
      price: 999,
      image: "assets/Rectangle%206%20%283%29.png",
      description: "Velvety peach scent with fresh citrus top notes.",
      badge: "",
      bestSeller: false,
      newArrival: false
    },
    {
      id: "p10",
      name: "Lumin Set",
      category: "makeup",
      price: 1999,
      image: "assets/Rectangle%206%20%282%29.png",
      description: "Complete makeup set designed for day-to-night polished looks.",
      badge: "",
      bestSeller: false,
      newArrival: false
    }
  ];
}

// Provide fallback team member data when the JSON file cannot be loaded.
function getFallbackTeam() {
  return [
    {
      id: "arizza",
      name: "Arizza L. Villareal",
      role: "Founder Designer",
      roleLabel: "Founder Designer",
      image: "assets/team-profile-img.png",
      cardImage: "assets/team-profile-img.png",
      heroTitle: "Hi, I am Arizza",
      heroSubtitle: "Aspiring Web and Mobile Developer · Content Creator · Editor",
      heroCopy: "I create beautiful, functional, and user-friendly digital experiences. Passionate about turning ideas into reality through clean code and innovative design.",
      about: "I’m Arizza — passionate about technology, creativity, and building digital ideas into real-world solutions.",
      aboutDetail: "I help beauty, lifestyle, and digital brands tell stories that feel authentic, trendy, and engaging through creative content and aesthetic visuals.",
      aboutExtra: "From social media captions and blog posts to polished long-form content, I create work that connects with people and helps brands build a strong online presence.",
      contactCopy: "Whether you need a creative website, a modern mobile app, or a developer who genuinely cares about quality and user experience — I’d love to help bring your ideas to life.",
      facebook: "https://www.facebook.com/arizzadump",
      projectLink: "https://www.figma.com/proto/vX7UiraE8mvEJfdbD20XyS/Rizze---Arizza-V.?node-id=5-6&p=f&t=8r27ZG22L3UxIEhT-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1",
      skills: ["UI/UX", "WEB", "HTML", "CSS"],
      skillLinks: {
        "UI/UX": "https://www.figma.com/proto/vX7UiraE8mvEJfdbD20XyS/Rizze---Arizza-V.?node-id=5-6&p=f&t=8r27ZG22L3UxIEhT-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1",
        HTML: "https://github.com/nenelipardz-sys/WebTech.git",
        CSS: "https://github.com/nenelipardz-sys/WebTech.git"
      },
      values: [
        {
          title: "Explorative & Passionate",
          description: "I enjoy exploring technology while building — projects don’t feel repetitive, they evolve."
        },
        {
          title: "Fast Learner & Adaptable",
          description: "I adjust quickly to new stacks and environments even if they are unfamiliar at first."
        },
        {
          title: "AI-Enhanced, Quality-Driven",
          description: "I use AI wisely to accelerate development without sacrificing craftsmanship."
        },
        {
          title: "Client Satisfaction Focus",
          description: "I prioritize clear communication, polished results, and making sure clients are happy with the final outcome."
        }
      ],
      contribution: "Led the visual design direction, creating the overall aesthetic and component designs that define Rizze Beauty's luxurious look and feel."
    },
    {
      id: "maverick",
      name: "Maverick S. Moran",
      role: "Programmer",
      image: "assets/team-profile-img%20%281%29.png",
      about: "Driven by continuous growth and learning, with a focus on building reliable and structured front-end implementations.",
      skills: ["Python", "HTML", "CSS"],
      skillLinks: {
        Python: "https://github.com/8mvr/Python-pygame.git",
        HTML: "https://www.codedex.io/html",
        CSS: "https://www.codedex.io/css"
      },
      contribution: "Implemented the responsive layouts and styled components, translating design mockups into functional, pixel-perfect code."
    },
    {
      id: "erika",
      name: "Erika P. Bianan",
      role: "Editor",
      image: "assets/team-member-img.png",
      about: "Detail-oriented and focused on refining outputs to ensure clarity, consistency, and overall quality of the project.",
      skills: ["JSON", "UI/UX"],
      skillLinks: {
        JSON: "https://www.w3schools.com/js/js_json.asp",
        "UI/UX": "https://www.figma.com/resource-library/difference-between-ui-and-ux/"
      },
      contribution: "Ensured content consistency across all pages, refined copy, and maintained quality standards throughout the project lifecycle."
    },
    {
      id: "justin",
      name: "Justin Luis C. Gamoso",
      role: "Editor",
      image: "assets/team-profile-img%20%282%29.png",
      about: "Provides direction and coordination for the team, ensuring smooth collaboration and steady progress throughout the project.",
      skills: ["HTML"],
      skillLinks: {
        HTML: "https://www.w3schools.com/html/"
      },
      contribution: "Coordinated team efforts, set project milestones, and ensured deliverables met quality and timeline expectations."
    },
    {
      id: "johnley",
      name: "Johnley T. Jugo",
      role: "Editor",
      image: "assets/team-profile-img%20%283%29.png",
      about: "Dedicated to continuous learning and improvement, contributing to both the design and development aspects of the project.",
      skills: ["JavaScript", "UI/UX"],
      skillLinks: {
        JavaScript: "https://www.w3schools.com/js/",
        "UI/UX": "https://www.figma.com/proto/vX7UiraE8mvEJfdbD20XyS/Rizze---Arizza-V.?node-id=5-960&p=f&t=8r27ZG22L3UxIEhT-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1"
      },
      contribution: "Contributed to design refinements and development support, bridging the gap between visual design and technical implementation."
    }
  ];
}
