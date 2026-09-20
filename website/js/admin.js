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
    loadSeasons();
    loadProducts();
    loadServices();
    loadHighlights();
    loadStories();
    loadQuestions();
    loadOrders();
    loadBookings();
    loadCoupons();
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
    seasons: document.getElementById('tab-seasons'),
    products: document.getElementById('tab-products'),
    services: document.getElementById('tab-services'),
    highlights: document.getElementById('tab-highlights'),
    stories: document.getElementById('tab-stories'),
    qa: document.getElementById('tab-qa'),
    orders: document.getElementById('tab-orders'),
    bookings: document.getElementById('tab-bookings'),
    coupons: document.getElementById('tab-coupons')
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
  var attractionNameEn = document.getElementById('attraction-name-en');
  var attractionDescriptionEn = document.getElementById('attraction-description-en');
  var attractionNameZh = document.getElementById('attraction-name-zh');
  var attractionDescriptionZh = document.getElementById('attraction-description-zh');
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
    attractionNameEn.value = '';
    attractionDescriptionEn.value = '';
    attractionNameZh.value = '';
    attractionDescriptionZh.value = '';
    attractionMapUrl.value = '';
    attractionMapStatus.textContent = '';
    attractionImages.setImages([]);
    attractionFormTitle.textContent = 'เพิ่มแหล่งท่องเที่ยวใหม่';
    attractionCancelBtn.style.display = 'none';
    attractionFormMsg.textContent = '';
  }

  attractionCancelBtn.addEventListener('click', resetAttractionForm);

  var attractionSearch = document.getElementById('attraction-search');
  var attractionsCache = [];

  function loadAttractions() {
    api('/api/attractions').then(function (result) {
      if (!result.ok) return;
      attractionsCache = result.data;
      renderAttractionList(attractionsCache);
    });
  }

  function renderAttractionList(places) {
      attractionList.innerHTML = '';
      if (places.length === 0) {
        attractionList.innerHTML = '<div class="admin-empty">' +
          (attractionsCache.length === 0 ? 'ยังไม่มีแหล่งท่องเที่ยว' : 'ไม่พบแหล่งท่องเที่ยวที่ตรงกับการค้นหา') + '</div>';
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
            '<div class="admin-item-meta">' + (place.category === 'nature' ? 'ธรรมชาติ' : 'วัฒนธรรม') + (place.tag ? ' · ' + escapeHtml(place.tag) : '') + (place.images ? ' · ' + place.images.length + ' รูป' : '') + ' · ' + (place.lat != null && place.lng != null ? '📍 ปักหมุดแล้ว' : 'ยังไม่ได้ปักหมุดบนแผนที่') + ' · ภาษา: ไทย' + (place.name_en && place.description_en ? ', EN' : '') + (place.name_zh && place.description_zh ? ', 中文' : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          attractionIdField.value = place.id;
          attractionCategory.value = place.category;
          attractionName.value = place.name;
          attractionTag.value = place.tag || '';
          attractionDescription.value = place.description;
          attractionNameEn.value = place.name_en || '';
          attractionDescriptionEn.value = place.description_en || '';
          attractionNameZh.value = place.name_zh || '';
          attractionDescriptionZh.value = place.description_zh || '';
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
  }

  attractionSearch.addEventListener('input', function () {
    var q = attractionSearch.value.trim().toLowerCase();
    renderAttractionList(q ? attractionsCache.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; }) : attractionsCache);
  });

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
        name_en: attractionNameEn.value.trim(),
        description_en: attractionDescriptionEn.value.trim(),
        name_zh: attractionNameZh.value.trim(),
        description_zh: attractionDescriptionZh.value.trim(),
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

  var nearbySearch = document.getElementById('nearby-search');
  var nearbyCache = [];

  function loadNearby() {
    api('/api/nearby-attractions').then(function (result) {
      if (!result.ok) return;
      nearbyCache = result.data;
      renderNearbyList(nearbyCache);
    });
  }

  function renderNearbyList(items) {
      nearbyList.innerHTML = '';
      if (items.length === 0) {
        nearbyList.innerHTML = '<div class="admin-empty">' +
          (nearbyCache.length === 0 ? 'ยังไม่มีข้อมูล' : 'ไม่พบรายการที่ตรงกับการค้นหา') + '</div>';
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
  }

  nearbySearch.addEventListener('input', function () {
    var q = nearbySearch.value.trim().toLowerCase();
    renderNearbyList(q ? nearbyCache.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; }) : nearbyCache);
  });

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

  // ============ HIGHLIGHTS ("สิ่งที่น่าสนใจ") ============
  var highlightIdField = document.getElementById('highlight-id');
  var highlightName = document.getElementById('highlight-name');
  var highlightDescription = document.getElementById('highlight-description');
  var highlightImages = createImagePicker('highlight-images-picker');
  var highlightFormTitle = document.getElementById('highlight-form-title');
  var highlightSaveBtn = document.getElementById('highlight-save-btn');
  var highlightCancelBtn = document.getElementById('highlight-cancel-btn');
  var highlightFormMsg = document.getElementById('highlight-form-msg');
  var highlightList = document.getElementById('highlight-list');
  highlightImages.setImages([]);

  function resetHighlightForm() {
    highlightIdField.value = '';
    highlightName.value = '';
    highlightDescription.value = '';
    highlightImages.setImages([]);
    highlightFormTitle.textContent = 'เพิ่ม "สิ่งที่น่าสนใจ" ใหม่';
    highlightCancelBtn.style.display = 'none';
    highlightFormMsg.textContent = '';
  }

  highlightCancelBtn.addEventListener('click', resetHighlightForm);

  var highlightSearch = document.getElementById('highlight-search');
  var highlightsCache = [];

  function loadHighlights() {
    api('/api/highlights').then(function (result) {
      if (!result.ok) return;
      highlightsCache = result.data;
      renderHighlightList(highlightsCache);
    });
  }

  function renderHighlightList(items) {
      highlightList.innerHTML = '';
      if (items.length === 0) {
        highlightList.innerHTML = '<div class="admin-empty">' +
          (highlightsCache.length === 0 ? 'ยังไม่มีข้อมูล' : 'ไม่พบรายการที่ตรงกับการค้นหา') + '</div>';
        return;
      }
      items.forEach(function (h) {
        var img = (h.images && h.images[0]) ? h.images[0] : null;
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(h.name) + '</h5>' +
            '<p>' + escapeHtml(h.description) + '</p>' +
            '<div class="admin-item-meta">' + (h.images ? h.images.length + ' รูป' : '0 รูป') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          highlightIdField.value = h.id;
          highlightName.value = h.name;
          highlightDescription.value = h.description;
          highlightImages.setImages(h.images || []);
          highlightFormTitle.textContent = 'แก้ไข "สิ่งที่น่าสนใจ"';
          highlightCancelBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        item.querySelector('.delete-btn').addEventListener('click', function () {
          if (!confirm('ลบ "' + h.name + '" ใช่หรือไม่?')) return;
          api('/api/highlights/' + h.id, { method: 'DELETE' }).then(function () { loadHighlights(); });
        });
        highlightList.appendChild(item);
      });
  }

  highlightSearch.addEventListener('input', function () {
    var q = highlightSearch.value.trim().toLowerCase();
    renderHighlightList(q ? highlightsCache.filter(function (h) { return h.name.toLowerCase().indexOf(q) !== -1; }) : highlightsCache);
  });

  highlightSaveBtn.addEventListener('click', function () {
    var name = highlightName.value.trim();
    var description = highlightDescription.value.trim();
    if (!name || !description) {
      highlightFormMsg.textContent = 'กรุณากรอกชื่อและรายละเอียด';
      highlightFormMsg.className = 'admin-msg error';
      return;
    }
    highlightSaveBtn.disabled = true;
    highlightImages.uploadAndGetImages().then(function (images) {
      var id = highlightIdField.value;
      var payload = { name: name, description: description, images: images };
      return id
        ? api('/api/highlights/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : api('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }).then(function (result) {
      highlightSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        highlightFormMsg.textContent = 'บันทึกสำเร็จ';
        highlightFormMsg.className = 'admin-msg success';
        resetHighlightForm();
        loadHighlights();
      } else {
        highlightFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        highlightFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      highlightSaveBtn.disabled = false;
      highlightFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      highlightFormMsg.className = 'admin-msg error';
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

  // ============ SEASONAL PICKS ("ฤดูกาลแนะนำ") ============
  var SEASON_LABELS = { summer: 'ฤดูร้อน', rainy: 'ฤดูฝน', winter: 'ฤดูหนาว' };
  var seasonsData = [];
  var selectedSeasonKey = 'summer';
  var seasonAdminButtons = document.getElementById('season-admin-buttons');
  var seasonFormTitle = document.getElementById('season-form-title');
  var seasonPeriodInput = document.getElementById('season-period-input');
  var seasonDescriptionInput = document.getElementById('season-description-input');
  var seasonImages = createImagePicker('season-images-picker');
  var seasonSaveBtn = document.getElementById('season-save-btn');
  var seasonFormMsg = document.getElementById('season-form-msg');
  seasonImages.setImages([]);

  function fillSeasonForm(key) {
    selectedSeasonKey = key;
    var s = seasonsData.find(function (x) { return x.season_key === key; }) || {};
    seasonFormTitle.textContent = 'แก้ไขข้อมูล' + SEASON_LABELS[key];
    seasonPeriodInput.value = s.period_text || '';
    seasonDescriptionInput.value = s.description || '';
    seasonImages.setImages(s.images || []);
    seasonFormMsg.textContent = '';
    seasonAdminButtons.querySelectorAll('.pill-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-key') === key);
    });
  }

  function loadSeasons() {
    api('/api/seasons').then(function (result) {
      if (!result.ok) return;
      seasonsData = result.data;
      seasonAdminButtons.innerHTML = '';
      seasonsData.forEach(function (s, i) {
        var btn = document.createElement('button');
        btn.className = 'pill-btn' + (i === 0 ? ' active' : '');
        btn.setAttribute('data-key', s.season_key);
        btn.textContent = SEASON_LABELS[s.season_key];
        btn.addEventListener('click', function () { fillSeasonForm(s.season_key); });
        seasonAdminButtons.appendChild(btn);
      });
      if (seasonsData.length) fillSeasonForm(seasonsData[0].season_key);
    });
  }

  seasonSaveBtn.addEventListener('click', function () {
    seasonSaveBtn.disabled = true;
    seasonImages.uploadAndGetImages().then(function (images) {
      var payload = {
        period_text: seasonPeriodInput.value.trim(),
        description: seasonDescriptionInput.value.trim(),
        images: images
      };
      return api('/api/seasons/' + selectedSeasonKey, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }).then(function (result) {
      seasonSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        seasonFormMsg.textContent = 'บันทึกสำเร็จ';
        seasonFormMsg.className = 'admin-msg success';
        loadSeasons();
      } else {
        seasonFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        seasonFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      seasonSaveBtn.disabled = false;
      seasonFormMsg.textContent = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      seasonFormMsg.className = 'admin-msg error';
    });
  });

  // ============ PRODUCTS ============
  var productIdField = document.getElementById('product-id');
  var productName = document.getElementById('product-name');
  var productDescription = document.getElementById('product-description');
  var productNameEn = document.getElementById('product-name-en');
  var productDescriptionEn = document.getElementById('product-description-en');
  var productNameZh = document.getElementById('product-name-zh');
  var productDescriptionZh = document.getElementById('product-description-zh');
  var productPrice = document.getElementById('product-price');
  var productPriceAmount = document.getElementById('product-price-amount');
  var productTags = document.getElementById('product-tags');
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
    productPriceAmount.value = '';
    productTags.value = '';
    productNameEn.value = '';
    productDescriptionEn.value = '';
    productNameZh.value = '';
    productDescriptionZh.value = '';
    productImages.setImages([]);
    productFormTitle.textContent = 'เพิ่มสินค้าใหม่';
    productCancelBtn.style.display = 'none';
    productFormMsg.textContent = '';
  }

  productCancelBtn.addEventListener('click', resetProductForm);

  var productSearch = document.getElementById('product-search');
  var productsCache = [];

  function loadProducts() {
    api('/api/products').then(function (result) {
      if (!result.ok) return;
      productsCache = result.data;
      renderProductList(productsCache);
    });
  }

  function renderProductList(products) {
      productList.innerHTML = '';
      if (products.length === 0) {
        productList.innerHTML = '<div class="admin-empty">' +
          (productsCache.length === 0 ? 'ยังไม่มีสินค้า' : 'ไม่พบสินค้าที่ตรงกับการค้นหา') + '</div>';
        return;
      }
      products.forEach(function (p) {
        var img = (p.images && p.images[0]) ? p.images[0] : null;
        var tags = p.tags || [];
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(p.name) + '</h5>' +
            '<p>' + escapeHtml(p.description) + '</p>' +
            '<div class="admin-item-meta">' + escapeHtml(p.price_text || '') + (p.images ? ' · ' + p.images.length + ' รูป' : '') + (tags.length ? ' · แท็ก: ' + escapeHtml(tags.join(', ')) : '') + ' · ภาษา: ไทย' + (p.name_en && p.description_en ? ', EN' : '') + (p.name_zh && p.description_zh ? ', 中文' : '') + (p.price_amount != null ? ' · 🛒 ใส่ตะกร้าได้ (฿' + p.price_amount + ')' : ' · ยังกดสั่งซื้อไม่ได้') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          productIdField.value = p.id;
          productName.value = p.name;
          productDescription.value = p.description;
          productPrice.value = p.price_text || '';
          productPriceAmount.value = (p.price_amount != null) ? p.price_amount : '';
          productTags.value = tags.join(', ');
          productNameEn.value = p.name_en || '';
          productDescriptionEn.value = p.description_en || '';
          productNameZh.value = p.name_zh || '';
          productDescriptionZh.value = p.description_zh || '';
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
  }

  productSearch.addEventListener('input', function () {
    var q = productSearch.value.trim().toLowerCase();
    renderProductList(q ? productsCache.filter(function (p) {
      return p.name.toLowerCase().indexOf(q) !== -1 || (p.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
    }) : productsCache);
  });

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
      var tags = productTags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      var payload = {
        name: name, description: description, price_text: productPrice.value.trim(),
        price_amount: productPriceAmount.value.trim(), tags: tags, images: images,
        name_en: productNameEn.value.trim(), description_en: productDescriptionEn.value.trim(),
        name_zh: productNameZh.value.trim(), description_zh: productDescriptionZh.value.trim()
      };
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
    massage: 'นวดไทย', driver: 'บริการรถรับส่ง', accommodation: 'ที่พัก'
  };
  var SERVICE_TYPE_FIELDS = {
    tour: ['price', 'schedule', 'includes'],
    guide: ['languages', 'license'],
    restaurant: ['awards'],
    massage: ['awards', 'license'],
    driver: ['awards'],
    accommodation: ['price', 'schedule', 'includes']
  };

  var serviceIdField = document.getElementById('service-id');
  var serviceType = document.getElementById('service-type');
  var serviceName = document.getElementById('service-name');
  var serviceDescription = document.getElementById('service-description');
  var serviceNameEn = document.getElementById('service-name-en');
  var serviceDescriptionEn = document.getElementById('service-description-en');
  var serviceNameZh = document.getElementById('service-name-zh');
  var serviceDescriptionZh = document.getElementById('service-description-zh');
  var serviceImages = createImagePicker('service-images-picker');
  var servicePrice = document.getElementById('service-price');
  var serviceSchedule = document.getElementById('service-schedule');
  var serviceIncludes = document.getElementById('service-includes');
  var serviceLanguages = document.getElementById('service-languages');
  var serviceLicense = document.getElementById('service-license');
  var serviceAwards = document.getElementById('service-awards');
  var serviceTags = document.getElementById('service-tags');
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
    serviceTags.value = '';
    serviceNameEn.value = '';
    serviceDescriptionEn.value = '';
    serviceNameZh.value = '';
    serviceDescriptionZh.value = '';
    updateServiceFieldVisibility();
    serviceFormTitle.textContent = 'เพิ่มบริการใหม่';
    serviceCancelBtn.style.display = 'none';
    serviceFormMsg.textContent = '';
  }

  serviceCancelBtn.addEventListener('click', resetServiceForm);

  var serviceSearch = document.getElementById('service-search');
  var servicesCache = [];

  function loadServices() {
    api('/api/services').then(function (result) {
      if (!result.ok) return;
      servicesCache = result.data;
      renderServiceList(servicesCache);
    });
  }

  function renderServiceList(services) {
      serviceList.innerHTML = '';
      if (services.length === 0) {
        serviceList.innerHTML = '<div class="admin-empty">' +
          (servicesCache.length === 0 ? 'ยังไม่มีบริการ' : 'ไม่พบบริการที่ตรงกับการค้นหา') + '</div>';
        return;
      }
      services.forEach(function (s) {
        var img = (s.images && s.images[0]) ? s.images[0] : null;
        var tags = s.tags || [];
        var item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML =
          (img ? '<img src="' + escapeHtml(img) + '">' : '<div class="thumb-fallback">ไม่มีรูป</div>') +
          '<div class="admin-item-body">' +
            '<h5>' + escapeHtml(s.name) + '</h5>' +
            '<p>' + escapeHtml(s.description) + '</p>' +
            '<div class="admin-item-meta">' + SERVICE_TYPE_LABELS[s.service_type] + (s.price_text ? ' · ' + escapeHtml(s.price_text) : '') + (tags.length ? ' · แท็ก: ' + escapeHtml(tags.join(', ')) : '') + ' · ภาษา: ไทย' + (s.name_en && s.description_en ? ', EN' : '') + (s.name_zh && s.description_zh ? ', 中文' : '') + '</div>' +
          '</div>' +
          '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
        item.querySelector('.edit-btn').addEventListener('click', function () {
          serviceIdField.value = s.id;
          serviceType.value = s.service_type;
          serviceName.value = s.name;
          serviceDescription.value = s.description;
          serviceNameEn.value = s.name_en || '';
          serviceDescriptionEn.value = s.description_en || '';
          serviceNameZh.value = s.name_zh || '';
          serviceDescriptionZh.value = s.description_zh || '';
          serviceImages.setImages(s.images || []);
          servicePrice.value = s.price_text || '';
          serviceSchedule.value = s.schedule_text || '';
          serviceIncludes.value = s.includes_text || '';
          serviceLanguages.value = s.languages || '';
          serviceLicense.value = s.license_no || '';
          serviceAwards.value = s.awards || '';
          serviceTags.value = tags.join(', ');
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
  }

  serviceSearch.addEventListener('input', function () {
    var q = serviceSearch.value.trim().toLowerCase();
    renderServiceList(q ? servicesCache.filter(function (s) {
      return s.name.toLowerCase().indexOf(q) !== -1 || (s.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
    }) : servicesCache);
  });

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
        awards: serviceAwards.value.trim(),
        tags: serviceTags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        name_en: serviceNameEn.value.trim(),
        description_en: serviceDescriptionEn.value.trim(),
        name_zh: serviceNameZh.value.trim(),
        description_zh: serviceDescriptionZh.value.trim()
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

  var storySearch = document.getElementById('story-search');
  var storiesCache = [];

  function loadStories() {
    api('/api/stories').then(function (result) {
      if (!result.ok) return;
      storiesCache = result.data;
      renderStoryList(storiesCache);
    });
  }

  function renderStoryList(stories) {
      storyList.innerHTML = '';
      if (stories.length === 0) {
        storyList.innerHTML = '<div class="admin-empty">' +
          (storiesCache.length === 0 ? 'ยังไม่มีบทความ เพิ่มบทความแรกได้จากฟอร์มด้านซ้าย' : 'ไม่พบบทความที่ตรงกับการค้นหา') + '</div>';
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
  }

  storySearch.addEventListener('input', function () {
    var q = storySearch.value.trim().toLowerCase();
    renderStoryList(q ? storiesCache.filter(function (s) {
      return s.title.toLowerCase().indexOf(q) !== -1 || (s.published_at || '').indexOf(q) !== -1;
    }) : storiesCache);
  });

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

  var qaSearch = document.getElementById('qa-search');
  var qaCache = [];

  function loadQuestions() {
    api('/api/qa').then(function (result) {
      if (!result.ok) return;
      qaCache = result.data;
      renderQuestionList(qaCache);
    });
  }

  function renderQuestionList(questions) {
      qaList.innerHTML = '';
      if (questions.length === 0) {
        qaList.innerHTML = '<div class="admin-empty">' +
          (qaCache.length === 0 ? 'ยังไม่มีคำถามเข้ามา' : 'ไม่พบคำถามที่ตรงกับการค้นหา') + '</div>';
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
  }

  qaSearch.addEventListener('input', function () {
    var q = qaSearch.value.trim().toLowerCase();
    renderQuestionList(q ? qaCache.filter(function (x) {
      return x.name.toLowerCase().indexOf(q) !== -1 ||
        (x.question || '').toLowerCase().indexOf(q) !== -1 ||
        (x.created_at || '').indexOf(q) !== -1;
    }) : qaCache);
  });

  // ============ ORDERS ============
  var ORDER_STATUS_LABELS = { new: 'ใหม่', confirmed: 'ยืนยันแล้ว', shipped: 'จัดส่งแล้ว', done: 'เสร็จสิ้น' };
  var ordersList = document.getElementById('orders-list');
  var ordersSearch = document.getElementById('orders-search');
  var ordersCache = [];

  function loadOrders() {
    api('/api/orders').then(function (result) {
      if (!result.ok) return;
      ordersCache = result.data;
      renderOrdersList(ordersCache);
    });
  }

  function renderOrdersList(orders) {
    ordersList.innerHTML = '';
    if (orders.length === 0) {
      ordersList.innerHTML = '<div class="admin-empty">' +
        (ordersCache.length === 0 ? 'ยังไม่มีคำสั่งซื้อเข้ามา' : 'ไม่พบคำสั่งซื้อที่ตรงกับการค้นหา') + '</div>';
      return;
    }
    orders.forEach(function (o) {
      var itemsHtml = (o.items || []).map(function (it) {
        return escapeHtml(it.name) + ' × ' + it.qty + ' (฿' + it.line_total + ')';
      }).join('<br>');
      var hasShipping = o.shipping_cost !== null && o.shipping_cost !== undefined;
      var item = document.createElement('div');
      item.className = 'card admin-item';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'stretch';
      item.innerHTML =
        '<div class="admin-item-body">' +
          '<h5>' + escapeHtml(o.customer_name) + ' <span class="answered-badge">' + ORDER_STATUS_LABELS[o.status] + '</span></h5>' +
          '<div class="admin-item-meta">ติดต่อ: ' + escapeHtml(o.customer_contact) + ' · ที่อยู่: ' + escapeHtml(o.customer_address) + ' · ' + escapeHtml((o.created_at || '').slice(0, 16).replace('T', ' ')) + '</div>' +
          '<p style="margin-top:8px;">' + itemsHtml + '</p>' +
          (o.notes ? '<p style="margin-top:4px; color:var(--text-muted);">หมายเหตุ: ' + escapeHtml(o.notes) + '</p>' : '') +
          (o.coupon_code ? '<p style="margin-top:4px; color:var(--green-700);">คูปอง: ' + escapeHtml(o.coupon_code) + ' (ลด ฿' + o.discount_amount + ')</p>' : '') +
          '<p style="margin-top:8px;"><strong>ยอดสินค้า: ฿' + o.subtotal + (o.discount_amount ? ' − ส่วนลด ฿' + o.discount_amount : '') +
            ' + ค่าส่ง ' + (hasShipping ? '฿' + o.shipping_cost : 'ยังไม่ระบุ') + ' = รวม ฿' + o.total + '</strong></p>' +
        '</div>';
      var shippingRow = document.createElement('div');
      shippingRow.style.display = 'flex';
      shippingRow.style.gap = '8px';
      shippingRow.style.alignItems = 'center';
      shippingRow.style.marginTop = '10px';
      var shippingInput = document.createElement('input');
      shippingInput.type = 'number';
      shippingInput.min = '0';
      shippingInput.step = '0.01';
      shippingInput.placeholder = 'ค่าจัดส่ง (บาท)';
      shippingInput.style.maxWidth = '160px';
      if (hasShipping) shippingInput.value = o.shipping_cost;
      var shippingSaveBtn = document.createElement('button');
      shippingSaveBtn.className = 'btn-outline';
      shippingSaveBtn.style.fontSize = '12.5px';
      shippingSaveBtn.style.padding = '6px 12px';
      shippingSaveBtn.textContent = 'บันทึกค่าจัดส่ง';
      shippingSaveBtn.addEventListener('click', function () {
        if (shippingInput.value === '') return;
        shippingSaveBtn.disabled = true;
        api('/api/orders/' + o.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipping_cost: shippingInput.value }) })
          .then(function () { loadOrders(); });
      });
      shippingRow.appendChild(shippingInput);
      shippingRow.appendChild(shippingSaveBtn);
      item.appendChild(shippingRow);
      var actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '10px';
      ['new', 'confirmed', 'shipped', 'done'].forEach(function (status) {
        var btn = document.createElement('button');
        btn.className = 'btn-outline';
        btn.style.fontSize = '12.5px';
        btn.style.padding = '6px 12px';
        btn.textContent = ORDER_STATUS_LABELS[status];
        if (status === o.status) btn.disabled = true;
        btn.addEventListener('click', function () {
          api('/api/orders/' + o.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: status }) })
            .then(function () { loadOrders(); });
        });
        actions.appendChild(btn);
      });
      item.appendChild(actions);
      ordersList.appendChild(item);
    });
  }

  ordersSearch.addEventListener('input', function () {
    var q = ordersSearch.value.trim().toLowerCase();
    renderOrdersList(q ? ordersCache.filter(function (o) {
      return o.customer_name.toLowerCase().indexOf(q) !== -1 || (o.created_at || '').indexOf(q) !== -1;
    }) : ordersCache);
  });

  // ============ BOOKINGS ============
  var BOOKING_STATUS_LABELS = { new: 'ใหม่', confirmed: 'ยืนยันแล้ว', done: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
  var bookingsList = document.getElementById('bookings-list');
  var bookingsSearch = document.getElementById('bookings-search');
  var bookingsCache = [];

  function loadBookings() {
    api('/api/bookings').then(function (result) {
      if (!result.ok) return;
      bookingsCache = result.data;
      renderBookingsList(bookingsCache);
    });
  }

  function renderBookingsList(bookings) {
    bookingsList.innerHTML = '';
    if (bookings.length === 0) {
      bookingsList.innerHTML = '<div class="admin-empty">' +
        (bookingsCache.length === 0 ? 'ยังไม่มีการจองเข้ามา' : 'ไม่พบการจองที่ตรงกับการค้นหา') + '</div>';
      return;
    }
    bookings.forEach(function (b) {
      var item = document.createElement('div');
      item.className = 'card admin-item';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'stretch';
      item.innerHTML =
        '<div class="admin-item-body">' +
          '<h5>' + escapeHtml(b.customer_name) + ' <span class="answered-badge">' + BOOKING_STATUS_LABELS[b.status] + '</span></h5>' +
          '<div class="admin-item-meta">บริการ: ' + escapeHtml(b.service_name) + ' · ติดต่อ: ' + escapeHtml(b.customer_contact) + ' · ' + escapeHtml((b.created_at || '').slice(0, 16).replace('T', ' ')) + '</div>' +
          (b.preferred_date ? '<p style="margin-top:8px;">วันที่ต้องการ: ' + escapeHtml(b.preferred_date) + '</p>' : '') +
          (b.party_size ? '<p style="margin-top:4px;">จำนวนคน: ' + escapeHtml(b.party_size) + '</p>' : '') +
          (b.notes ? '<p style="margin-top:4px; color:var(--text-muted);">หมายเหตุ: ' + escapeHtml(b.notes) + '</p>' : '') +
        '</div>';
      var actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '10px';
      ['new', 'confirmed', 'done', 'cancelled'].forEach(function (status) {
        var btn = document.createElement('button');
        btn.className = 'btn-outline';
        btn.style.fontSize = '12.5px';
        btn.style.padding = '6px 12px';
        btn.textContent = BOOKING_STATUS_LABELS[status];
        if (status === b.status) btn.disabled = true;
        btn.addEventListener('click', function () {
          api('/api/bookings/' + b.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: status }) })
            .then(function () { loadBookings(); });
        });
        actions.appendChild(btn);
      });
      item.appendChild(actions);
      bookingsList.appendChild(item);
    });
  }

  bookingsSearch.addEventListener('input', function () {
    var q = bookingsSearch.value.trim().toLowerCase();
    renderBookingsList(q ? bookingsCache.filter(function (b) {
      return b.customer_name.toLowerCase().indexOf(q) !== -1 ||
        b.service_name.toLowerCase().indexOf(q) !== -1 ||
        (b.created_at || '').indexOf(q) !== -1;
    }) : bookingsCache);
  });

  // ============ COUPONS ============
  var COUPON_TYPE_LABELS = { percent: '%', fixed: 'บาท' };
  var couponIdField = document.getElementById('coupon-id');
  var couponCode = document.getElementById('coupon-code');
  var couponDiscountType = document.getElementById('coupon-discount-type');
  var couponDiscountValue = document.getElementById('coupon-discount-value');
  var couponMaxUses = document.getElementById('coupon-max-uses');
  var couponActiveField = document.getElementById('coupon-active-field');
  var couponActive = document.getElementById('coupon-active');
  var couponFormTitle = document.getElementById('coupon-form-title');
  var couponSaveBtn = document.getElementById('coupon-save-btn');
  var couponCancelBtn = document.getElementById('coupon-cancel-btn');
  var couponFormMsg = document.getElementById('coupon-form-msg');
  var couponList = document.getElementById('coupon-list');
  var couponSearch = document.getElementById('coupon-search');
  var couponsCache = [];

  function resetCouponForm() {
    couponIdField.value = '';
    couponCode.value = '';
    couponCode.disabled = false;
    couponDiscountType.value = 'percent';
    couponDiscountValue.value = '';
    couponMaxUses.value = '';
    couponActive.checked = true;
    couponActiveField.style.display = 'none';
    couponFormTitle.textContent = 'เพิ่มคูปองส่วนลดใหม่';
    couponCancelBtn.style.display = 'none';
    couponFormMsg.textContent = '';
  }

  couponCancelBtn.addEventListener('click', resetCouponForm);

  function loadCoupons() {
    api('/api/coupons').then(function (result) {
      if (!result.ok) return;
      couponsCache = result.data;
      renderCouponList(couponsCache);
    });
  }

  function renderCouponList(coupons) {
    couponList.innerHTML = '';
    if (coupons.length === 0) {
      couponList.innerHTML = '<div class="admin-empty">' +
        (couponsCache.length === 0 ? 'ยังไม่มีคูปอง' : 'ไม่พบคูปองที่ตรงกับการค้นหา') + '</div>';
      return;
    }
    coupons.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'card admin-item';
      item.innerHTML =
        '<div class="admin-item-body">' +
          '<h5>' + escapeHtml(c.code) + (c.active ? '' : ' <span class="answered-badge">ปิดใช้งาน</span>') + '</h5>' +
          '<div class="admin-item-meta">ส่วนลด ' + c.discount_value + COUPON_TYPE_LABELS[c.discount_type] +
            ' · ใช้ไปแล้ว ' + c.used_count + (c.max_uses ? ' / ' + c.max_uses : ' ครั้ง (ไม่จำกัด)') + '</div>' +
        '</div>' +
        '<div class="admin-item-actions"><button class="edit-btn">แก้ไข</button><button class="delete-btn">ลบ</button></div>';
      item.querySelector('.edit-btn').addEventListener('click', function () {
        couponIdField.value = c.id;
        couponCode.value = c.code;
        couponCode.disabled = true;
        couponDiscountType.value = c.discount_type;
        couponDiscountValue.value = c.discount_value;
        couponMaxUses.value = c.max_uses || '';
        couponActive.checked = !!c.active;
        couponActiveField.style.display = 'block';
        couponFormTitle.textContent = 'แก้ไขคูปอง "' + c.code + '"';
        couponCancelBtn.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      item.querySelector('.delete-btn').addEventListener('click', function () {
        if (!confirm('ลบคูปอง "' + c.code + '" ใช่หรือไม่?')) return;
        api('/api/coupons/' + c.id, { method: 'DELETE' }).then(function () { loadCoupons(); });
      });
      couponList.appendChild(item);
    });
  }

  couponSearch.addEventListener('input', function () {
    var q = couponSearch.value.trim().toLowerCase();
    renderCouponList(q ? couponsCache.filter(function (c) { return c.code.toLowerCase().indexOf(q) !== -1; }) : couponsCache);
  });

  couponSaveBtn.addEventListener('click', function () {
    var code = couponCode.value.trim().toUpperCase();
    var discountValue = couponDiscountValue.value;
    if (!code || discountValue === '') {
      couponFormMsg.textContent = 'กรุณากรอกโค้ดและมูลค่าส่วนลด';
      couponFormMsg.className = 'admin-msg error';
      return;
    }
    couponSaveBtn.disabled = true;
    var id = couponIdField.value;
    var payload = {
      code: code,
      discount_type: couponDiscountType.value,
      discount_value: discountValue,
      max_uses: couponMaxUses.value,
      active: id ? couponActive.checked : true
    };
    var request = id
      ? api('/api/coupons/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : api('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    request.then(function (result) {
      couponSaveBtn.disabled = false;
      if (result.ok && result.data.success) {
        couponFormMsg.textContent = 'บันทึกสำเร็จ';
        couponFormMsg.className = 'admin-msg success';
        resetCouponForm();
        loadCoupons();
      } else {
        couponFormMsg.textContent = (result.data && result.data.error) || 'บันทึกไม่สำเร็จ';
        couponFormMsg.className = 'admin-msg error';
      }
    }).catch(function (err) {
      couponSaveBtn.disabled = false;
      couponFormMsg.textContent = err.message || 'เกิดข้อผิดพลาด';
      couponFormMsg.className = 'admin-msg error';
    });
  });
})();
