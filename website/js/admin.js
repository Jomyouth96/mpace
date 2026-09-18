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

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ============ MULTI-IMAGE PICKER (reused by every form below) ============
  function createImagePicker(containerId) {
    var container = document.getElementById(containerId);
    var savedImages = [];
    var pendingFiles = [];

    function render() {
      var savedThumbs = savedImages.map(function (url, i) {
        return '<div class="image-picker-thumb" data-kind="saved" data-index="' + i + '">' +
          '<img src="' + escapeHtml(url) + '">' +
          '<button type="button" class="remove-btn">×</button></div>';
      }).join('');
      var pendingThumbs = pendingFiles.map(function (file, i) {
        return '<div class="image-picker-thumb pending" data-kind="pending" data-index="' + i + '">' +
          '<img src="' + URL.createObjectURL(file) + '">' +
          '<button type="button" class="remove-btn">×</button></div>';
      }).join('');
      container.innerHTML =
        '<div class="image-picker">' +
          '<div class="image-picker-strip">' + savedThumbs + pendingThumbs + '</div>' +
          '<input type="file" accept="image/*" multiple class="picker-file-input">' +
        '</div>';
      container.querySelectorAll('.remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var thumb = btn.closest('.image-picker-thumb');
          var kind = thumb.getAttribute('data-kind');
          var idx = parseInt(thumb.getAttribute('data-index'), 10);
          if (kind === 'saved') savedImages.splice(idx, 1);
          else pendingFiles.splice(idx, 1);
          render();
        });
      });
      container.querySelector('.picker-file-input').addEventListener('change', function (e) {
        pendingFiles = pendingFiles.concat(Array.prototype.slice.call(e.target.files));
        render();
      });
    }

    return {
      setImages: function (urls) { savedImages = (urls || []).slice(); pendingFiles = []; render(); },
      reset: function () { savedImages = []; pendingFiles = []; render(); },
      uploadAndGetImages: function () {
        if (!pendingFiles.length) return Promise.resolve(savedImages.slice());
        var uploads = pendingFiles.map(function (file) {
          var formData = new FormData();
          formData.append('image', file);
          return fetch(API_BASE + '/api/upload', {
            method: 'POST', headers: authHeaders(), body: formData
          }).then(function (res) {
            return res.json().then(function (data) {
              if (!res.ok || !data.success) throw new Error(data.error || 'อัปโหลดรูปไม่สำเร็จ');
              return data.url;
            });
          });
        });
        return Promise.all(uploads).then(function (urls) {
          var result = savedImages.concat(urls);
          savedImages = result;
          pendingFiles = [];
          return result;
        });
      }
    };
  }

  // ============ REPEATABLE FIELD GROUP (calendar traditions/activities — more than 1 per month) ============
  function createRepeatFieldGroup(containerId, addLabel) {
    var container = document.getElementById(containerId);
    var items = [];

    function render() {
      var itemsHtml = items.map(function (item, i) {
        return '<div class="repeat-item" data-index="' + i + '">' +
          '<div class="form-field"><label>ชื่อ</label><input type="text" data-field="title" value="' + escapeHtml(item.title || '') + '"></div>' +
          '<div class="form-field"><label>รายละเอียด</label><textarea rows="2" data-field="desc">' + escapeHtml(item.desc || '') + '</textarea></div>' +
          '<button type="button" class="repeat-remove-btn">ลบ</button>' +
        '</div>';
      }).join('');
      container.innerHTML = itemsHtml + '<button type="button" class="btn-outline repeat-add-btn" style="color:var(--green-800); border-color:var(--green-800); font-size:13px; padding:8px 16px;">+ ' + addLabel + '</button>';

      container.querySelectorAll('.repeat-item').forEach(function (el) {
        var idx = parseInt(el.getAttribute('data-index'), 10);
        el.querySelectorAll('[data-field]').forEach(function (input) {
          input.addEventListener('input', function () {
            items[idx][input.getAttribute('data-field')] = input.value;
          });
        });
        el.querySelector('.repeat-remove-btn').addEventListener('click', function () {
          items.splice(idx, 1);
          render();
        });
      });
      container.querySelector('.repeat-add-btn').addEventListener('click', function () {
        items.push({ title: '', desc: '' });
        render();
      });
    }

    return {
      setItems: function (list) {
        items = (list || []).map(function (x) { return { title: x.title || '', desc: x.desc || '' }; });
        render();
      },
      getItems: function () {
        return items.filter(function (it) { return (it.title || '').trim() || (it.desc || '').trim(); });
      }
    };
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
    loadNearby();
    loadCalendar();
    loadProducts();
    loadServices();
    loadStories();
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
    nearby: document.getElementById('tab-nearby'),
    calendar: document.getElementById('tab-calendar'),
    products: document.getElementById('tab-products'),
    services: document.getElementById('tab-services'),
    stories: document.getElementById('tab-stories'),
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

  // ============ ATTRACTIONS ============
  var attractionIdField = document.getElementById('attraction-id');
  var attractionCategory = document.getElementById('attraction-category');
  var attractionName = document.getElementById('attraction-name');
  var attractionTag = document.getElementById('attraction-tag');
  var attractionDescription = document.getElementById('attraction-description');
  var attractionMapUrl = document.getElementById('attraction-map-url');
  var attractionMapStatus = document.getElementById('attraction-map-status');
  var attractionImages = createImagePicker('attraction-images-picker');
  var attractionFormTitle = document.getElementById('attraction-form-title');
  var attractionSaveBtn = document.getElementById('attraction-save-btn');
  var attractionCancelBtn = document.getElementById('attraction-cancel-btn');
  var attractionFormMsg = document.getElementById('attraction-form-msg');
  var attractionList = document.getElementById('attraction-list');
  attractionImages.setImages([]);

  function resetAttractionForm() {
    attractionIdField.value = '';
    attractionCategory.value = 'nature';
    attractionName.value = '';
    attractionTag.value = '';
    attractionDescription.value = '';
    attractionMapUrl.value = '';
    attractionMapStatus.textContent = '';
    attractionImages.setImages([]);
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
        var img = (place.images && place.images[0]) ? place.images[0] : null;
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(place.name) + '</h5>' +
            '<p>' + escapeHtml(place.description) + '</p>' +
            '<div class="admin-item-meta">' + (place.category === 'nature' ? 'ธรรมชาติ' : 'วัฒนธรรม') + (place.tag ? ' · ' + escapeHtml(place.tag) : '') + (place.images ? ' · ' + place.images.length + ' รูป' : '') + ' · ' + (place.lat != null && place.lng != null ? '📍 ปักหมุดแล้ว' : 'ยังไม่ได้ปักหมุดบนแผนที่') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          attractionIdField.value = place.id;
          attractionCategory.value = place.category;
          attractionName.value = place.name;
          attractionTag.value = place.tag || '';
          attractionDescription.value = place.description;
          attractionMapUrl.value = place.map_url || '';
          attractionMapStatus.textContent = (place.lat != null && place.lng != null)
            ? 'พิกัดปัจจุบัน: ' + place.lat.toFixed(5) + ', ' + place.lng.toFixed(5)
            : '';
          attractionImages.setImages(place.images || []);
          attractionFormTitle.textContent = 'แก้ไขแหล่งท่องเที่ยว';
          attractionCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบ "' + place.name + '" ใช่หรือไม่? (หมุดบนแผนที่หน้าเว็บจะหายไปด้วย)')) return;
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
    attractionImages.uploadAndGetImages().then(function (images) {
      var id = attractionIdField.value;
      var payload = {
        category: attractionCategory.value,
        name: name,
        tag: attractionTag.value.trim(),
        description: description,
        map_url: attractionMapUrl.value.trim(),
        images: images
      };
      return id
        ? api('/api/attractions/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/attractions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }).then(function (result) {
      attractionSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        var hasPin = result.data.lat != null && result.data.lng != null;
        var pastedUrl = attractionMapUrl.value.trim();
        attractionFormMsg.textContent = 'บันทึกสำเร็จ' + (pastedUrl ? (hasPin ? ' — ปักหมุดบนแผนที่แล้ว' : ' — อ่านพิกัดจากลิงก์นี้ไม่ได้ ลองวางลิงก์แบบเต็ม (เปิดลิงก์แล้วคัดลอก URL จาก address bar) แทนลิงก์แบบย่อ') : '');
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

  // ============ NEARBY ATTRACTIONS ============
  var nearbyIdField = document.getElementById('nearby-id');
  var nearbyArea = document.getElementById('nearby-area');
  var nearbyName = document.getElementById('nearby-name');
  var nearbyDescription = document.getElementById('nearby-description');
  var nearbyImages = createImagePicker('nearby-images-picker');
  var nearbyFormTitle = document.getElementById('nearby-form-title');
  var nearbySaveBtn = document.getElementById('nearby-save-btn');
  var nearbyCancelBtn = document.getElementById('nearby-cancel-btn');
  var nearbyFormMsg = document.getElementById('nearby-form-msg');
  var nearbyList = document.getElementById('nearby-list');
  nearbyImages.setImages([]);

  function resetNearbyForm() {
    nearbyIdField.value = '';
    nearbyArea.value = '';
    nearbyName.value = '';
    nearbyDescription.value = '';
    nearbyImages.setImages([]);
    nearbyFormTitle.textContent = 'เพิ่มแหล่งท่องเที่ยวใกล้เคียงใหม่';
    nearbyCancelBtn.style.display = 'none';
    nearbyFormMsg.textContent = '';
  }

  nearbyCancelBtn.addEventListener('click', resetNearbyForm);

  function loadNearby() {
    api('/api/nearby-attractions').then(function (result) {
      if (!result.ok) return;
      var items = result.data;
      nearbyList.innerHTML = '';
      if (items.length === 0) {
        nearbyList.innerHTML = '<div class="admin-empty">ยังไม่มีข้อมูล</div>';
        return;
      }
      items.forEach(function (place) {
        var img = (place.images && place.images[0]) ? place.images[0] : null;
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(place.name) + '</h5>' +
            '<p>' + escapeHtml(place.description) + '</p>' +
            '<div class="admin-item-meta">' + escapeHtml(place.area_tag) + (place.images ? ' · ' + place.images.length + ' รูป' : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          nearbyIdField.value = place.id;
          nearbyArea.value = place.area_tag;
          nearbyName.value = place.name;
          nearbyDescription.value = place.description;
          nearbyImages.setImages(place.images || []);
          nearbyFormTitle.textContent = 'แก้ไขแหล่งท่องเที่ยวใกล้เคียง';
          nearbyCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบ "' + place.name + '" ใช่หรือไม่?')) return;
          api('/api/nearby-attractions/' + place.id, { method: 'DELETE' }).then(function () { loadNearby(); });
        });
        nearbyList.appendChild(item);
      });
    });
  }

  nearbySaveBtn.addEventListener('click', function () {
    var area = nearbyArea.value.trim();
    var name = nearbyName.value.trim();
    var description = nearbyDescription.value.trim();
    if (!area || !name || !description) {
      nearbyFormMsg.textContent = 'กรุณากรอกพื้นที่ ชื่อ และรายละเอียด';
      nearbyFormMsg.className = 'admin-msg error';
      return;
    }
    nearbySaveBtn.disabled = true;
    nearbyImages.uploadAndGetImages().then(function (images) {
      var id = nearbyIdField.value;
      var payload = { area_tag: area, name: name, description: description, images: images };
      return id
        ? api('/api/nearby-attractions/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/nearby-attractions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }).then(function (result) {
      nearbySaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        nearbyFormMsg.textContent = 'บันทึกสำเร็จ';
        nearbyFormMsg.className = 'admin-msg success';
        resetNearbyForm();
        loadNearby();
      } else {
        nearbyFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        nearbyFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      nearbySaveBtn.disabled = false;
      nearbyFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      nearbyFormMsg.className = 'admin-msg error';
    });
  });

  // ============ CALENDAR ============
  var calendarMonths = [];
  var selectedCalendarMonth = 0;
  var calMonthButtons = document.getElementById('calendar-month-buttons');
  var calFormTitle = document.getElementById('calendar-form-title');
  var calImages = createImagePicker('calendar-images-picker');
  var calTraditions = createRepeatFieldGroup('cal-traditions-repeat', 'เพิ่มประเพณี');
  var calActivities = createRepeatFieldGroup('cal-activities-repeat', 'เพิ่มกิจกรรม');
  var calProductsInput = document.getElementById('cal-products-input');
  var calSaveBtn = document.getElementById('calendar-save-btn');
  var calFormMsg = document.getElementById('calendar-form-msg');
  calImages.setImages([]);
  calTraditions.setItems([]);
  calActivities.setItems([]);

  function fillCalendarForm(index) {
    selectedCalendarMonth = index;
    var m = calendarMonths[index];
    calFormTitle.textContent = 'แก้ไขข้อมูลเดือน' + m.label;
    calImages.setImages(m.images || []);
    calTraditions.setItems(m.traditions || []);
    calActivities.setItems(m.activities || []);
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
        var hasData = (m.traditions && m.traditions.length) || (m.activities && m.activities.length) || m.products;
        var btn = document.createElement('button');
        btn.className = 'pill-btn' + (i === 0 ? ' active' : '');
        btn.textContent = m.label + (hasData ? '' : ' (ว่าง)');
        btn.addEventListener('click', function () { fillCalendarForm(i); });
        calMonthButtons.appendChild(btn);
      });
      fillCalendarForm(0);
    });
  }

  calSaveBtn.addEventListener('click', function () {
    calSaveBtn.disabled = true;
    calImages.uploadAndGetImages().then(function (images) {
      var payload = {
        traditions: calTraditions.getItems(),
        activities: calActivities.getItems(),
        products: calProductsInput.value.trim(),
        images: images
      };
      return api('/api/calendar/' + selectedCalendarMonth, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
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
    }).catch(function (err) {
      calSaveBtn.disabled = false;
      calFormMsg.textContent = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      calFormMsg.className = 'admin-msg error';
    });
  });

  // ============ PRODUCTS ============
  var productIdField = document.getElementById('product-id');
  var productName = document.getElementById('product-name');
  var productDescription = document.getElementById('product-description');
  var productPrice = document.getElementById('product-price');
  var productImages = createImagePicker('product-images-picker');
  var productFormTitle = document.getElementById('product-form-title');
  var productSaveBtn = document.getElementById('product-save-btn');
  var productCancelBtn = document.getElementById('product-cancel-btn');
  var productFormMsg = document.getElementById('product-form-msg');
  var productList = document.getElementById('product-list');
  productImages.setImages([]);

  function resetProductForm() {
    productIdField.value = '';
    productName.value = '';
    productDescription.value = '';
    productPrice.value = '';
    productImages.setImages([]);
    productFormTitle.textContent = 'เพิ่มสินค้าใหม่';
    productCancelBtn.style.display = 'none';
    productFormMsg.textContent = '';
  }

  productCancelBtn.addEventListener('click', resetProductForm);

  function loadProducts() {
    api('/api/products').then(function (result) {
      if (!result.ok) return;
      var products = result.data;
      productList.innerHTML = '';
      if (products.length === 0) {
        productList.innerHTML = '<div class="admin-empty">ยังไม่มีสินค้า</div>';
        return;
      }
      products.forEach(function (p) {
        var img = (p.images && p.images[0]) ? p.images[0] : null;
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(p.name) + '</h5>' +
            '<p>' + escapeHtml(p.description) + '</p>' +
            '<div class="admin-item-meta">' + escapeHtml(p.price_text || '') + (p.images ? ' · ' + p.images.length + ' รูป' : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          productIdField.value = p.id;
          productName.value = p.name;
          productDescription.value = p.description;
          productPrice.value = p.price_text || '';
          productImages.setImages(p.images || []);
          productFormTitle.textContent = 'แก้ไขสินค้า';
          productCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบ "' + p.name + '" ใช่หรือไม่?')) return;
          api('/api/products/' + p.id, { method: 'DELETE' }).then(function () { loadProducts(); });
        });
        productList.appendChild(item);
      });
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
    productImages.uploadAndGetImages().then(function (images) {
      var id = productIdField.value;
      var payload = { name: name, description: description, price_text: productPrice.value.trim(), images: images };
      return id
        ? api('/api/products/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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

  // ============ SERVICES ============
  var SERVICE_TYPE_LABELS = {
    tour: 'ทัวร์', guide: 'ไกด์ชุมชน', restaurant: 'ร้านอาหาร',
    massage: 'นวดไทย', driver: 'บริการรถรับส่ง'
  };
  var SERVICE_TYPE_FIELDS = {
    tour: ['price', 'schedule', 'includes'],
    guide: ['languages', 'license'],
    restaurant: ['awards'],
    massage: ['awards', 'license'],
    driver: ['awards']
  };

  var serviceIdField = document.getElementById('service-id');
  var serviceType = document.getElementById('service-type');
  var serviceName = document.getElementById('service-name');
  var serviceDescription = document.getElementById('service-description');
  var serviceImages = createImagePicker('service-images-picker');
  var servicePrice = document.getElementById('service-price');
  var serviceSchedule = document.getElementById('service-schedule');
  var serviceIncludes = document.getElementById('service-includes');
  var serviceLanguages = document.getElementById('service-languages');
  var serviceLicense = document.getElementById('service-license');
  var serviceAwards = document.getElementById('service-awards');
  var serviceFormTitle = document.getElementById('service-form-title');
  var serviceSaveBtn = document.getElementById('service-save-btn');
  var serviceCancelBtn = document.getElementById('service-cancel-btn');
  var serviceFormMsg = document.getElementById('service-form-msg');
  var serviceList = document.getElementById('service-list');
  serviceImages.setImages([]);

  var serviceFieldRows = {
    price: document.getElementById('service-field-price'),
    schedule: document.getElementById('service-field-schedule'),
    includes: document.getElementById('service-field-includes'),
    languages: document.getElementById('service-field-languages'),
    license: document.getElementById('service-field-license'),
    awards: document.getElementById('service-field-awards')
  };

  function updateServiceFieldVisibility() {
    var visible = SERVICE_TYPE_FIELDS[serviceType.value] || [];
    Object.keys(serviceFieldRows).forEach(function (key) {
      serviceFieldRows[key].style.display = visible.indexOf(key) !== -1 ? 'flex' : 'none';
    });
  }
  serviceType.addEventListener('change', updateServiceFieldVisibility);
  updateServiceFieldVisibility();

  function resetServiceForm() {
    serviceIdField.value = '';
    serviceType.value = 'tour';
    serviceName.value = '';
    serviceDescription.value = '';
    serviceImages.setImages([]);
    servicePrice.value = '';
    serviceSchedule.value = '';
    serviceIncludes.value = '';
    serviceLanguages.value = '';
    serviceLicense.value = '';
    serviceAwards.value = '';
    updateServiceFieldVisibility();
    serviceFormTitle.textContent = 'เพิ่มบริการใหม่';
    serviceCancelBtn.style.display = 'none';
    serviceFormMsg.textContent = '';
  }

  serviceCancelBtn.addEventListener('click', resetServiceForm);

  function loadServices() {
    api('/api/services').then(function (result) {
      if (!result.ok) return;
      var services = result.data;
      serviceList.innerHTML = '';
      if (services.length === 0) {
        serviceList.innerHTML = '<div class="admin-empty">ยังไม่มีบริการ</div>';
        return;
      }
      services.forEach(function (s) {
        var img = (s.images && s.images[0]) ? s.images[0] : null;
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(s.name) + '</h5>' +
            '<p>' + escapeHtml(s.description) + '</p>' +
            '<div class="admin-item-meta">' + SERVICE_TYPE_LABELS[s.service_type] + (s.price_text ? ' · ' + escapeHtml(s.price_text) : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          serviceIdField.value = s.id;
          serviceType.value = s.service_type;
          serviceName.value = s.name;
          serviceDescription.value = s.description;
          serviceImages.setImages(s.images || []);
          servicePrice.value = s.price_text || '';
          serviceSchedule.value = s.schedule_text || '';
          serviceIncludes.value = s.includes_text || '';
          serviceLanguages.value = s.languages || '';
          serviceLicense.value = s.license_no || '';
          serviceAwards.value = s.awards || '';
          updateServiceFieldVisibility();
          serviceFormTitle.textContent = 'แก้ไขบริการ';
          serviceCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบ "' + s.name + '" ใช่หรือไม่?')) return;
          api('/api/services/' + s.id, { method: 'DELETE' }).then(function () { loadServices(); });
        });
        serviceList.appendChild(item);
      });
    });
  }

  serviceSaveBtn.addEventListener('click', function () {
    var name = serviceName.value.trim();
    var description = serviceDescription.value.trim();
    if (!name || !description) {
      serviceFormMsg.textContent = 'กรุณากรอกชื่อและรายละเอียด';
      serviceFormMsg.className = 'admin-msg error';
      return;
    }
    serviceSaveBtn.disabled = true;
    serviceImages.uploadAndGetImages().then(function (images) {
      var id = serviceIdField.value;
      var payload = {
        service_type: serviceType.value,
        name: name,
        description: description,
        images: images,
        price_text: servicePrice.value.trim(),
        schedule_text: serviceSchedule.value.trim(),
        includes_text: serviceIncludes.value.trim(),
        languages: serviceLanguages.value.trim(),
        license_no: serviceLicense.value.trim(),
        awards: serviceAwards.value.trim()
      };
      return id
        ? api('/api/services/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }).then(function (result) {
      serviceSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        serviceFormMsg.textContent = 'บันทึกสำเร็จ';
        serviceFormMsg.className = 'admin-msg success';
        resetServiceForm();
        loadServices();
      } else {
        serviceFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        serviceFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      serviceSaveBtn.disabled = false;
      serviceFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      serviceFormMsg.className = 'admin-msg error';
    });
  });

  // ============ STORIES ============
  var storyIdField = document.getElementById('story-id');
  var storyTitle = document.getElementById('story-title');
  var storyExcerpt = document.getElementById('story-excerpt');
  var storyTitleEn = document.getElementById('story-title-en');
  var storyExcerptEn = document.getElementById('story-excerpt-en');
  var storyTitleZh = document.getElementById('story-title-zh');
  var storyExcerptZh = document.getElementById('story-excerpt-zh');
  var storyDate = document.getElementById('story-date');
  var storyImages = createImagePicker('story-images-picker');
  var storyFormTitle = document.getElementById('story-form-title');
  var storySaveBtn = document.getElementById('story-save-btn');
  var storyCancelBtn = document.getElementById('story-cancel-btn');
  var storyFormMsg = document.getElementById('story-form-msg');
  var storyList = document.getElementById('story-list');
  storyImages.setImages([]);

  function resetStoryForm() {
    storyIdField.value = '';
    storyTitle.value = '';
    storyExcerpt.value = '';
    storyTitleEn.value = '';
    storyExcerptEn.value = '';
    storyTitleZh.value = '';
    storyExcerptZh.value = '';
    storyDate.value = '';
    storyImages.setImages([]);
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
        var img = (story.images && story.images[0]) ? story.images[0] : null;
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(story.title) + '</h5>' +
            '<p>' + escapeHtml(story.excerpt) + '</p>' +
            '<div class="admin-item-meta">เผยแพร่: ' + escapeHtml(story.published_at) +
              ' · ภาษา: ไทย' + (story.title_en && story.excerpt_en ? ', EN' : '') + (story.title_zh && story.excerpt_zh ? ', 中文' : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<button class="edit-btn">แก้ไข</button>' +
            '<button class="delete-btn">ลบ</button>' +
          '</div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          storyIdField.value = story.id;
          storyTitle.value = story.title;
          storyExcerpt.value = story.excerpt;
          storyTitleEn.value = story.title_en || '';
          storyExcerptEn.value = story.excerpt_en || '';
          storyTitleZh.value = story.title_zh || '';
          storyExcerptZh.value = story.excerpt_zh || '';
          storyDate.value = story.published_at;
          storyImages.setImages(story.images || []);
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
    storyImages.uploadAndGetImages().then(function (images) {
      var id = storyIdField.value;
      var payload = {
        title: title, excerpt: excerpt,
        title_en: storyTitleEn.value.trim(), excerpt_en: storyExcerptEn.value.trim(),
        title_zh: storyTitleZh.value.trim(), excerpt_zh: storyExcerptZh.value.trim(),
        published_at: publishedAt, images: images
      };
      return id
        ? api('/api/stories/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
})();
