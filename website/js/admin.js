(function () {
  var API_BASE = '';
  var TOKEN_KEY = 'rakpana_admin_token';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function authHeaders(extra) {
    var headers = extra || {};
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  function api(path, options) {
    options = options || {};
    options.headers = authHeaders(options.headers || {});
    return fetch(API_BASE + path, options).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  // ============ LOGIN ============
  var loginScreen = document.getElementById('login-screen');
  var adminApp = document.getElementById('admin-app');
  var loginBtn = document.getElementById('login-btn');
  var loginPassword = document.getElementById('login-password');
  var loginError = document.getElementById('login-error');
  var logoutBtn = document.getElementById('logout-btn');

  function showApp() {
    loginScreen.style.display = 'none';
    adminApp.style.display = 'block';
    loadAttractions();
    loadCalendar();
    loadStories();
    loadProducts();
    loadQuestions();
  }

  function showLogin(message) {
    loginScreen.style.display = 'flex';
    adminApp.style.display = 'none';
    loginError.textContent = message || '';
  }

  function attemptLogin() {
    var password = loginPassword.value;
    if (!password) return;
    loginBtn.disabled = true;
    api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function (result) {
      loginBtn.disabled = false;
      if (result.ok && result.data.success) {
        setToken(result.data.token);
        loginPassword.value = '';
        showApp();
      } else {
        loginError.textContent = (result.data && result.data.error) || 'เข้าสู่ระบบไม่สำเร็จ';
      }
    }).catch(function () {
      loginBtn.disabled = false;
      loginError.textContent = 'ไม่สามารถเชื่อมต่อ backend ได้ (ตรวจสอบว่า backend/app.py เปิดอยู่)';
    });
  }

  loginBtn.addEventListener('click', attemptLogin);
  loginPassword.addEventListener('keydown', function (e) { if (e.key === 'Enter') attemptLogin(); });

  logoutBtn.addEventListener('click', function () {
    api('/api/admin/logout', { method: 'POST' }).finally(function () {
      clearToken();
      showLogin();
    });
  });

  // Verify any stored token on load.
  if (getToken()) {
    api('/api/admin/check').then(function (result) {
      if (result.ok && result.data.is_admin) {
        showApp();
      } else {
        clearToken();
        showLogin();
      }
    }).catch(function () { showLogin('ไม่สามารถเชื่อมต่อ backend ได้'); });
  } else {
    showLogin();
  }

  // ============ TABS ============
  var tabButtons = document.querySelectorAll('.admin-tabs .pill-btn');
  var panels = {
    attractions: document.getElementById('tab-attractions'),
    calendar: document.getElementById('tab-calendar'),
    stories: document.getElementById('tab-stories'),
    products: document.getElementById('tab-products'),
    qa: document.getElementById('tab-qa')
  };
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var target = btn.getAttribute('data-tab');
      Object.keys(panels).forEach(function (key) { panels[key].style.display = key === target ? 'block' : 'none'; });
    });
  });

  // ============ IMAGE UPLOAD HELPER ============
  function uploadImageIfPresent(fileInput) {
    var file = fileInput.files[0];
    if (!file) return Promise.resolve(null);
    var formData = new FormData();
    formData.append('image', file);
    return fetch(API_BASE + '/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data.success) throw new Error(data.error || 'อัปโหลดรูปไม่สำเร็จ');
        return data.url;
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ============ STORIES ============
  var storyIdField = document.getElementById('story-id');
  var storyTitle = document.getElementById('story-title');
  var storyExcerpt = document.getElementById('story-excerpt');
  var storyDate = document.getElementById('story-date');
  var storyImage = document.getElementById('story-image');
  var storyImagePreview = document.getElementById('story-image-preview');
  var storyFormTitle = document.getElementById('story-form-title');
  var storySaveBtn = document.getElementById('story-save-btn');
  var storyCancelBtn = document.getElementById('story-cancel-btn');
  var storyFormMsg = document.getElementById('story-form-msg');
  var storyList = document.getElementById('story-list');
  var currentStoryImagePath = null;

  storyImage.addEventListener('change', function () {
    var file = storyImage.files[0];
    if (!file) return;
    storyImagePreview.src = URL.createObjectURL(file);
    storyImagePreview.style.display = 'block';
  });

  function resetStoryForm() {
    storyIdField.value = '';
    storyTitle.value = '';
    storyExcerpt.value = '';
    storyDate.value = '';
    storyImage.value = '';
    storyImagePreview.style.display = 'none';
    currentStoryImagePath = null;
    storyFormTitle.textContent = 'เพิ่มบทความใหม่';
    storyCancelBtn.style.display = 'none';
    storyFormMsg.textContent = '';
  }

  storyCancelBtn.addEventListener('click', resetStoryForm);

  function loadStories() {
    api('/api/stories').then(function (result) {
      if (!result.ok) return;
      var stories = result.data;
      storyList.innerHTML = '';
      if (stories.length === 0) {
        storyList.innerHTML = '<div class="admin-empty">ยังไม่มีบทความ เพิ่มบทความแรกได้จากฟอร์มด้านซ้าย</div>';
        return;
      }
      stories.forEach(function (story) {
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (story.image_path ? '<img src="' + escapeHtml(story.image_path) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(story.title) + '</h5>' +
            '<p>' + escapeHtml(story.excerpt) + '</p>' +
            '<div class="admin-item-meta">เผยแพร่: ' + escapeHtml(story.published_at) + '</div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<button class="edit-btn">แก้ไข</button>' +
            '<button class="delete-btn">ลบ</button>' +
          '</div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          storyIdField.value = story.id;
          storyTitle.value = story.title;
          storyExcerpt.value = story.excerpt;
          storyDate.value = story.published_at;
          currentStoryImagePath = story.image_path;
          if (story.image_path) {
            storyImagePreview.src = story.image_path;
            storyImagePreview.style.display = 'block';
          } else {
            storyImagePreview.style.display = 'none';
          }
          storyFormTitle.textContent = 'แก้ไขบทความ';
          storyCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบบทความ "' + story.title + '" ใช่หรือไม่?')) return;
          api('/api/stories/' + story.id, { method: 'DELETE' }).then(function () { loadStories(); });
        });
        storyList.appendChild(item);
      });
    });
  }

  storySaveBtn.addEventListener('click', function () {
    var title = storyTitle.value.trim();
    var excerpt = storyExcerpt.value.trim();
    var publishedAt = storyDate.value || new Date().toISOString().slice(0, 10);
    if (!title || !excerpt) {
      storyFormMsg.textContent = 'กรุณากรอกชื่อบทความและเนื้อหา';
      storyFormMsg.className = 'admin-msg error';
      return;
    }
    storySaveBtn.disabled = true;
    uploadImageIfPresent(storyImage).then(function (uploadedUrl) {
      var imagePath = uploadedUrl || currentStoryImagePath;
      var id = storyIdField.value;
      var payload = { title: title, excerpt: excerpt, published_at: publishedAt, image_path: imagePath };
      var request = id
        ? api('/api/stories/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return request;
    }).then(function (result) {
      storySaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        storyFormMsg.textContent = 'บันทึกสำเร็จ';
        storyFormMsg.className = 'admin-msg success';
        resetStoryForm();
        loadStories();
      } else {
        storyFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        storyFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      storySaveBtn.disabled = false;
      storyFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      storyFormMsg.className = 'admin-msg error';
    });
  });

  // ============ PRODUCTS ============
  var productIdField = document.getElementById('product-id');
  var productKind = document.getElementById('product-kind');
  var productName = document.getElementById('product-name');
  var productDescription = document.getElementById('product-description');
  var productPrice = document.getElementById('product-price');
  var productImage = document.getElementById('product-image');
  var productImagePreview = document.getElementById('product-image-preview');
  var productFormTitle = document.getElementById('product-form-title');
  var productSaveBtn = document.getElementById('product-save-btn');
  var productCancelBtn = document.getElementById('product-cancel-btn');
  var productFormMsg = document.getElementById('product-form-msg');
  var productListProduct = document.getElementById('product-list-product');
  var productListService = document.getElementById('product-list-service');
  var currentProductImagePath = null;

  productImage.addEventListener('change', function () {
    var file = productImage.files[0];
    if (!file) return;
    productImagePreview.src = URL.createObjectURL(file);
    productImagePreview.style.display = 'block';
  });

  function resetProductForm() {
    productIdField.value = '';
    productKind.value = 'product';
    productName.value = '';
    productDescription.value = '';
    productPrice.value = '';
    productImage.value = '';
    productImagePreview.style.display = 'none';
    currentProductImagePath = null;
    productFormTitle.textContent = 'เพิ่มรายการใหม่';
    productCancelBtn.style.display = 'none';
    productFormMsg.textContent = '';
  }

  productCancelBtn.addEventListener('click', resetProductForm);

  function renderProductItem(container, product) {
    var item = document.createElement('div');
    item.className = 'card admin-item';
    item.innerHTML =
      (product.image_path ? '<img src="' + escapeHtml(product.image_path) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
      '<div class="admin-item-body">' +
        '<h5>' + escapeHtml(product.name) + '</h5>' +
        '<p>' + escapeHtml(product.description) + '</p>' +
        '<div class="admin-item-meta">' + escapeHtml(product.price_text || '') + '</div>' +
      '</div>' +
      '<div class="admin-item-actions">' +
        '<button class="edit-btn">แก้ไข</button>' +
        '<button class="delete-btn">ลบ</button>' +
      '</div>';
    item.querySelector('.edit-btn').addEventListener('click', function () {
      productIdField.value = product.id;
      productKind.value = product.kind;
      productName.value = product.name;
      productDescription.value = product.description;
      productPrice.value = product.price_text || '';
      currentProductImagePath = product.image_path;
      if (product.image_path) {
        productImagePreview.src = product.image_path;
        productImagePreview.style.display = 'block';
      } else {
        productImagePreview.style.display = 'none';
      }
      productFormTitle.textContent = 'แก้ไขรายการ';
      productCancelBtn.style.display = 'inline-block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    item.querySelector('.delete-btn').addEventListener('click', function () {
      if (!confirm('ลบ "' + product.name + '" ใช่หรือไม่?')) return;
      api('/api/products/' + product.id, { method: 'DELETE' }).then(function () { loadProducts(); });
    });
    container.appendChild(item);
  }

  function loadProducts() {
    api('/api/products').then(function (result) {
      if (!result.ok) return;
      var items = result.data;
      productListProduct.innerHTML = '';
      productListService.innerHTML = '';
      var products = items.filter(function (p) { return p.kind === 'product'; });
      var services = items.filter(function (p) { return p.kind === 'service'; });
      if (products.length === 0) productListProduct.innerHTML = '<div class="admin-empty">ยังไม่มีสินค้า</div>';
      else products.forEach(function (p) { renderProductItem(productListProduct, p); });
      if (services.length === 0) productListService.innerHTML = '<div class="admin-empty">ยังไม่มีบริการ</div>';
      else services.forEach(function (p) { renderProductItem(productListService, p); });
    });
  }

  productSaveBtn.addEventListener('click', function () {
    var name = productName.value.trim();
    var description = productDescription.value.trim();
    if (!name || !description) {
      productFormMsg.textContent = 'กรุณากรอกชื่อและรายละเอียด';
      productFormMsg.className = 'admin-msg error';
      return;
    }
    productSaveBtn.disabled = true;
    uploadImageIfPresent(productImage).then(function (uploadedUrl) {
      var imagePath = uploadedUrl || currentProductImagePath;
      var id = productIdField.value;
      var payload = {
        kind: productKind.value,
        name: name,
        description: description,
        price_text: productPrice.value.trim(),
        image_path: imagePath
      };
      var request = id
        ? api('/api/products/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return request;
    }).then(function (result) {
      productSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        productFormMsg.textContent = 'บันทึกสำเร็จ';
        productFormMsg.className = 'admin-msg success';
        resetProductForm();
        loadProducts();
      } else {
        productFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        productFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      productSaveBtn.disabled = false;
      productFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      productFormMsg.className = 'admin-msg error';
    });
  });

  // ============ Q&A ============
  var qaList = document.getElementById('qa-admin-list');

  function loadQuestions() {
    api('/api/qa').then(function (result) {
      if (!result.ok) return;
      var questions = result.data;
      qaList.innerHTML = '';
      if (questions.length === 0) {
        qaList.innerHTML = '<div class="admin-empty">ยังไม่มีคำถามเข้ามา</div>';
        return;
      }
      questions.forEach(function (q) {
        var item = document.createElement('div');
        item.className = 'card admin-item qa-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'stretch';
        item.innerHTML =
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(q.name) + (q.answered ? '<span class="answered-badge">ตอบแล้ว</span>' : '') + '</h5>' +
            '<div class="admin-item-meta">ติดต่อกลับ: ' + escapeHtml(q.contact) + ' · ' + escapeHtml((q.created_at || '').slice(0, 16).replace('T', ' ')) + '</div>' +
            '<p style="margin-top:8px;">' + escapeHtml(q.question) + '</p>' +
            (q.answer ? '<p style="margin-top:8px; color:var(--green-700);"><strong>คำตอบ:</strong> ' + escapeHtml(q.answer) + '</p>' : '') +
          '</div>';
        if (!q.answered) {
          var answerBox = document.createElement('div');
          answerBox.className = 'qa-answer-box';
          answerBox.innerHTML = '<input type="text" placeholder="พิมพ์คำตอบ..."><button class="btn-link">ส่งคำตอบ</button>';
          var input = answerBox.querySelector('input');
          answerBox.querySelector('button').addEventListener('click', function () {
            var answer = input.value.trim();
            if (!answer) return;
            api('/api/qa/' + q.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: answer }) })
              .then(function () { loadQuestions(); });
          });
          item.appendChild(answerBox);
        }
        qaList.appendChild(item);
      });
    });
  }

  // ============ ATTRACTIONS ============
  var attractionIdField = document.getElementById('attraction-id');
  var attractionCategory = document.getElementById('attraction-category');
  var attractionName = document.getElementById('attraction-name');
  var attractionTag = document.getElementById('attraction-tag');
  var attractionDescription = document.getElementById('attraction-description');
  var attractionImage = document.getElementById('attraction-image');
  var attractionImagePreview = document.getElementById('attraction-image-preview');
  var attractionFormTitle = document.getElementById('attraction-form-title');
  var attractionSaveBtn = document.getElementById('attraction-save-btn');
  var attractionCancelBtn = document.getElementById('attraction-cancel-btn');
  var attractionFormMsg = document.getElementById('attraction-form-msg');
  var attractionList = document.getElementById('attraction-list');
  var currentAttractionImagePath = null;

  attractionImage.addEventListener('change', function () {
    var file = attractionImage.files[0];
    if (!file) return;
    attractionImagePreview.src = URL.createObjectURL(file);
    attractionImagePreview.style.display = 'block';
  });

  function resetAttractionForm() {
    attractionIdField.value = '';
    attractionCategory.value = 'nature';
    attractionName.value = '';
    attractionTag.value = '';
    attractionDescription.value = '';
    attractionImage.value = '';
    attractionImagePreview.style.display = 'none';
    currentAttractionImagePath = null;
    attractionFormTitle.textContent = 'เพิ่มแหล่งท่องเที่ยวใหม่';
    attractionCancelBtn.style.display = 'none';
    attractionFormMsg.textContent = '';
  }

  attractionCancelBtn.addEventListener('click', resetAttractionForm);

  function loadAttractions() {
    api('/api/attractions').then(function (result) {
      if (!result.ok) return;
      var places = result.data;
      attractionList.innerHTML = '';
      if (places.length === 0) {
        attractionList.innerHTML = '<div class="admin-empty">ยังไม่มีแหล่งท่องเที่ยว</div>';
        return;
      }
      places.forEach(function (place) {
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (place.image_path ? '<img src="' + escapeHtml(place.image_path) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(place.name) + '</h5>' +
            '<p>' + escapeHtml(place.description) + '</p>' +
            '<div class="admin-item-meta">' + (place.category === 'nature' ? 'ธรรมชาติ' : 'วัฒนธรรม') + (place.tag ? ' · ' + escapeHtml(place.tag) : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          attractionIdField.value = place.id;
          attractionCategory.value = place.category;
          attractionName.value = place.name;
          attractionTag.value = place.tag || '';
          attractionDescription.value = place.description;
          currentAttractionImagePath = place.image_path;
          if (place.image_path) {
            attractionImagePreview.src = place.image_path;
            attractionImagePreview.style.display = 'block';
          } else {
            attractionImagePreview.style.display = 'none';
          }
          attractionFormTitle.textContent = 'แก้ไขแหล่งท่องเที่ยว';
          attractionCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบ "' + place.name + '" ใช่หรือไม่? (หมุดบนแผนที่หน้าเว็บที่ชี้มาที่นี่จะใช้งานไม่ได้)')) return;
          api('/api/attractions/' + place.id, { method: 'DELETE' }).then(function () { loadAttractions(); });
        });
        attractionList.appendChild(item);
      });
    });
  }

  attractionSaveBtn.addEventListener('click', function () {
    var name = attractionName.value.trim();
    var description = attractionDescription.value.trim();
    if (!name || !description) {
      attractionFormMsg.textContent = 'กรุณากรอกชื่อและรายละเอียด';
      attractionFormMsg.className = 'admin-msg error';
      return;
    }
    attractionSaveBtn.disabled = true;
    uploadImageIfPresent(attractionImage).then(function (uploadedUrl) {
      var imagePath = uploadedUrl || currentAttractionImagePath;
      var id = attractionIdField.value;
      var payload = {
        category: attractionCategory.value,
        name: name,
        tag: attractionTag.value.trim(),
        description: description,
        image_path: imagePath
      };
      var request = id
        ? api('/api/attractions/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/attractions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return request;
    }).then(function (result) {
      attractionSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        attractionFormMsg.textContent = 'บันทึกสำเร็จ';
        attractionFormMsg.className = 'admin-msg success';
        resetAttractionForm();
        loadAttractions();
      } else {
        attractionFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        attractionFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      attractionSaveBtn.disabled = false;
      attractionFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      attractionFormMsg.className = 'admin-msg error';
    });
  });

  // ============ CALENDAR ============
  var calendarMonths = [];
  var selectedCalendarMonth = 0;
  var calMonthButtons = document.getElementById('calendar-month-buttons');
  var calFormTitle = document.getElementById('calendar-form-title');
  var calTraditionTitleInput = document.getElementById('cal-tradition-title-input');
  var calTraditionDescInput = document.getElementById('cal-tradition-desc-input');
  var calActivityTitleInput = document.getElementById('cal-activity-title-input');
  var calActivityDescInput = document.getElementById('cal-activity-desc-input');
  var calProductsInput = document.getElementById('cal-products-input');
  var calSaveBtn = document.getElementById('calendar-save-btn');
  var calFormMsg = document.getElementById('calendar-form-msg');

  function fillCalendarForm(index) {
    selectedCalendarMonth = index;
    var m = calendarMonths[index];
    calFormTitle.textContent = 'แก้ไขข้อมูลเดือน' + m.label;
    calTraditionTitleInput.value = m.tradition_title || '';
    calTraditionDescInput.value = m.tradition_desc || '';
    calActivityTitleInput.value = m.activity_title || '';
    calActivityDescInput.value = m.activity_desc || '';
    calProductsInput.value = m.products || '';
    calFormMsg.textContent = '';
    calMonthButtons.querySelectorAll('.pill-btn').forEach(function (b, i) {
      b.classList.toggle('active', i === index);
    });
  }

  function loadCalendar() {
    api('/api/calendar').then(function (result) {
      if (!result.ok) return;
      calendarMonths = result.data;
      calMonthButtons.innerHTML = '';
      calendarMonths.forEach(function (m, i) {
        var btn = document.createElement('button');
        btn.className = 'pill-btn' + (i === 0 ? ' active' : '');
        btn.textContent = m.label + (m.tradition_title ? '' : ' (ว่าง)');
        btn.addEventListener('click', function () { fillCalendarForm(i); });
        calMonthButtons.appendChild(btn);
      });
      fillCalendarForm(0);
    });
  }

  calSaveBtn.addEventListener('click', function () {
    calSaveBtn.disabled = true;
    var payload = {
      tradition_title: calTraditionTitleInput.value.trim(),
      tradition_desc: calTraditionDescInput.value.trim(),
      activity_title: calActivityTitleInput.value.trim(),
      activity_desc: calActivityDescInput.value.trim(),
      products: calProductsInput.value.trim()
    };
    api('/api/calendar/' + selectedCalendarMonth, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (result) {
      calSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        calFormMsg.textContent = 'บันทึกสำเร็จ';
        calFormMsg.className = 'admin-msg success';
        loadCalendar();
      } else {
        calFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        calFormMsg.className = 'admin-msg error';
      }
    }).catch(function () {
      calSaveBtn.disabled = false;
      calFormMsg.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      calFormMsg.className = 'admin-msg error';
    });
  });
})();
