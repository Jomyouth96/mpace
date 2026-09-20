var API_BASE = '';

// ============ MOBILE NAV TOGGLE (hamburger menu on tablet/mobile) ============
(function () {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.querySelector('.nav-links');
  if (!toggle || !nav) return;

  function closeNav() {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('click', function (e) {
    if (!nav.classList.contains('open')) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    closeNav();
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 960) closeNav();
  });
})();

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ============ GENERIC CARD-COVER CAROUSEL (auto-crossfade) ============
// Builds the markup for a card's cover image area. If there's more than
// one image, a tiny interval cycles through them with a crossfade.
function renderCoverHtml(images, altText, placeholderHtml, heightClass) {
  images = Array.isArray(images) ? images.filter(Boolean) : [];
  if (images.length === 0) {
    return placeholderHtml || '<div class="thumb"></div>';
  }
  var imgs = images.map(function (src, i) {
    return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(altText || '') + '"' +
      (i === 0 ? ' class="active"' : '') + '>';
  }).join('');
  return '<div class="card-carousel' + (heightClass ? ' ' + heightClass : '') + '" data-count="' + images.length + '">' + imgs + '</div>';
}

function startCardCarousels(root) {
  (root || document).querySelectorAll('.card-carousel').forEach(function (el) {
    var count = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (count <= 1 || el._carouselStarted) return;
    el._carouselStarted = true;
    var index = 0;
    setInterval(function () {
      var imgs = el.querySelectorAll('img');
      if (!imgs.length) return;
      imgs[index].classList.remove('active');
      index = (index + 1) % imgs.length;
      imgs[index].classList.add('active');
    }, 2800 + Math.random() * 800);
  });
}

// ============ GENERIC DETAIL MODAL ============
var Modal = (function () {
  var overlay = document.getElementById('detail-modal');
  if (!overlay) return { open: function () {} };

  var galleryEl = document.getElementById('modal-gallery');
  var titleEl = document.getElementById('modal-title');
  var tagEl = document.getElementById('modal-tag');
  var descEl = document.getElementById('modal-desc');
  var fieldsEl = document.getElementById('modal-fields');
  var closeBtn = document.getElementById('modal-close');
  var galleryIndex = 0;
  var galleryImages = [];

  function renderGallery() {
    if (!galleryImages.length) {
      galleryEl.style.display = 'none';
      galleryEl.innerHTML = '';
      return;
    }
    galleryEl.style.display = 'block';
    var imgs = galleryImages.map(function (src, i) {
      return '<img src="' + escapeHtml(src) + '"' + (i === galleryIndex ? ' class="active"' : '') + '>';
    }).join('');
    var arrows = galleryImages.length > 1
      ? '<button type="button" class="modal-gallery-arrow prev" aria-label="ก่อนหน้า">‹</button>' +
        '<button type="button" class="modal-gallery-arrow next" aria-label="ถัดไป">›</button>' +
        '<div class="modal-gallery-dots">' + galleryImages.map(function (_, i) {
          return '<span' + (i === galleryIndex ? ' class="active"' : '') + '></span>';
        }).join('') + '</div>'
      : '';
    galleryEl.innerHTML = imgs + arrows;
    if (galleryImages.length > 1) {
      galleryEl.querySelector('.prev').addEventListener('click', function () {
        galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
        renderGallery();
      });
      galleryEl.querySelector('.next').addEventListener('click', function () {
        galleryIndex = (galleryIndex + 1) % galleryImages.length;
        renderGallery();
      });
    }
  }

  function open(opts) {
    opts = opts || {};
    galleryImages = Array.isArray(opts.images) ? opts.images.filter(Boolean) : [];
    galleryIndex = 0;
    renderGallery();
    titleEl.textContent = opts.title || '';
    descEl.textContent = opts.desc || '';
    if (opts.tag) {
      tagEl.textContent = opts.tag;
      tagEl.style.display = 'inline-block';
    } else {
      tagEl.style.display = 'none';
    }
    fieldsEl.innerHTML = '';
    (opts.fields || []).forEach(function (f) {
      var div = document.createElement('div');
      div.className = 'modal-field';
      div.innerHTML = '<strong>' + escapeHtml(f.label) + '</strong>' + escapeHtml(f.value);
      fieldsEl.appendChild(div);
    });
    if (opts.priceText) {
      var priceDiv = document.createElement('div');
      priceDiv.className = 'modal-price';
      priceDiv.textContent = opts.priceText;
      fieldsEl.appendChild(priceDiv);
    }
    overlay.classList.add('show');
  }

  function close() {
    overlay.classList.remove('show');
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  return { open: open, close: close };
})();

// ============ ATTRACTIONS (dynamic, per-language, searchable via category filter + map) ============
(function () {
  var grid = document.getElementById('attraction-grid');
  var filterButtons = document.querySelectorAll('#attraction-filters .pill-btn');
  var mapEl = document.getElementById('attraction-leaflet-map');
  if (!grid) return;

  // Real GPS center of Mae Ho Phra subdistrict (municipal office), used so the
  // map has a sensible view even before every attraction has a pinned location.
  var COMMUNITY_CENTER = [19.1136158, 99.0202498];

  var allPlaces = [];
  var activeFilter = 'all';
  var map = null;
  var markersLayer = null;
  var fitDone = false;

  // Thai fields are required on every attraction, so Thai always shows
  // everything. EN/ZH only show attractions where that language's name +
  // description were filled in by the admin.
  function localize(p) {
    var lang = window.getLang ? window.getLang() : 'th';
    if (lang === 'en' && p.name_en && p.description_en) return { name: p.name_en, description: p.description_en };
    if (lang === 'zh' && p.name_zh && p.description_zh) return { name: p.name_zh, description: p.description_zh };
    if (lang === 'th') return { name: p.name, description: p.description };
    return null;
  }

  function openAttractionModal(p, l) {
    Modal.open({
      title: l.name,
      tag: p.tag || (p.category === 'nature' ? (window.t ? window.t('legend_nature') : 'ธรรมชาติ') : (window.t ? window.t('legend_culture') : 'วัฒนธรรม')),
      images: p.images,
      desc: l.description
    });
  }

  function render() {
    var visible = allPlaces
      .map(function (p) { return { p: p, l: localize(p) }; })
      .filter(function (x) { return x.l; })
      .filter(function (x) { return activeFilter === 'all' || x.p.category === activeFilter; });

    if (!visible.length) {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' +
        (window.t ? window.t(!allPlaces.length ? 'err_no_attractions' : 'no_results') : '') + '</p>';
    } else {
      grid.innerHTML = visible.map(function (x) {
        var p = x.p, l = x.l;
        var cover = renderCoverHtml(
          p.images, l.name,
          '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F3E9D2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
            (p.category === 'culture'
              ? '<path d="M12 2 4 7v3h16V7Z"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 21h18"/>'
              : '<path d="M12 22V12"/><path d="M12 12C12 7 8 4 4 4c0 5 3 8 8 8Z"/><path d="M12 12c0-5 4-8 8-8 0 5-3 8-8 8Z"/>') +
            '</svg></div>'
        );
        var desc = l.description.length > 90 ? l.description.slice(0, 90) + '…' : l.description;
        return (
          '<div id="place-' + p.id + '" class="card clickable place-card" data-id="' + p.id + '">' + cover +
          '<div class="body">' +
            '<span class="tag" style="width:fit-content;">' + escapeHtml(p.tag || (p.category === 'nature' ? (window.t ? window.t('legend_nature') : 'ธรรมชาติ') : (window.t ? window.t('legend_culture') : 'วัฒนธรรม'))) + '</span>' +
            '<h4>' + escapeHtml(l.name) + '</h4>' +
            '<p>' + escapeHtml(desc) + '</p>' +
          '</div></div>'
        );
      }).join('');
      startCardCarousels(grid);

      grid.querySelectorAll('.place-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var x = visible.find(function (x) { return String(x.p.id) === card.getAttribute('data-id'); });
          if (x) openAttractionModal(x.p, x.l);
        });
      });
    }

    renderMapMarkers(visible);
  }

  function renderMapMarkers(visible) {
    if (!mapEl || !window.L) return;
    if (!map) {
      map = L.map(mapEl, { scrollWheelZoom: false }).setView(COMMUNITY_CENTER, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);
    }
    markersLayer.clearLayers();

    var located = visible.filter(function (x) { return x.p.lat != null && x.p.lng != null; });
    located.forEach(function (x) {
      var p = x.p, l = x.l;
      var color = p.category === 'culture' ? '#2E6B47' : '#D9A441';
      var marker = L.circleMarker([p.lat, p.lng], {
        radius: 10, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1
      }).addTo(markersLayer);
      var popupEl = document.createElement('div');
      popupEl.innerHTML =
        '<h4>' + escapeHtml(l.name) + '</h4>' +
        '<p>' + escapeHtml(l.description.slice(0, 60)) + (l.description.length > 60 ? '…' : '') + '</p>' +
        '<span class="btn-link">' + (window.t ? window.t('view_details') : 'ดูรายละเอียด →') + '</span>';
      popupEl.querySelector('.btn-link').addEventListener('click', function () { openAttractionModal(p, l); });
      marker.bindPopup(popupEl);
    });

    if (located.length && !fitDone) {
      var bounds = L.latLngBounds(located.map(function (x) { return [x.p.lat, x.p.lng]; }));
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15 });
      fitDone = true;
    }
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      render();
    });
  });

  window.addEventListener('langchange', render);

  fetch(API_BASE + '/api/attractions')
    .then(function (res) { return res.json(); })
    .then(function (places) {
      allPlaces = places;
      render();
    })
    .catch(function () {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_attractions') : '') + '</p>';
    });
})();

// ============ NEARBY ATTRACTIONS (dynamic) ============
(function () {
  var grid = document.getElementById('nearby-grid');
  if (!grid) return;

  fetch(API_BASE + '/api/nearby-attractions')
    .then(function (res) { return res.json(); })
    .then(function (items) {
      if (!items.length) {
        grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_no_nearby') : '') + '</p>';
        return;
      }
      grid.innerHTML = items.map(function (p) {
        var cover = renderCoverHtml(p.images, p.name, '', 'nearby-cover');
        var desc = p.description.length > 90 ? p.description.slice(0, 90) + '…' : p.description;
        return (
          '<div class="card clickable nearby-card" data-id="' + p.id + '" style="padding:0; overflow:hidden;">' +
            (p.images && p.images.length ? cover : '') +
            '<div style="padding:20px; display:flex; flex-direction:column; gap:6px;">' +
              '<span class="tag" style="width:fit-content;">' + escapeHtml(p.area_tag) + '</span>' +
              '<h4>' + escapeHtml(p.name) + '</h4>' +
              '<p>' + escapeHtml(desc) + '</p>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      startCardCarousels(grid);
      grid.querySelectorAll('.nearby-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var p = items.find(function (x) { return String(x.id) === card.getAttribute('data-id'); });
          if (p) Modal.open({ title: p.name, tag: p.area_tag, images: p.images, desc: p.description });
        });
      });
    })
    .catch(function () {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_nearby') : '') + '</p>';
    });
})();

// ============ HIGHLIGHTS ("สิ่งที่น่าสนใจ", dynamic) ============
(function () {
  var grid = document.getElementById('highlight-grid');
  if (!grid) return;

  fetch(API_BASE + '/api/highlights')
    .then(function (res) { return res.json(); })
    .then(function (items) {
      if (!items.length) {
        grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_no_highlights') : '') + '</p>';
        return;
      }
      grid.innerHTML = items.map(function (p) {
        var cover = renderCoverHtml(p.images, p.name, '', 'nearby-cover');
        var desc = p.description.length > 90 ? p.description.slice(0, 90) + '…' : p.description;
        return (
          '<div class="card clickable highlight-card" data-id="' + p.id + '" style="padding:0; overflow:hidden;">' +
            (p.images && p.images.length ? cover : '') +
            '<div style="padding:20px; display:flex; flex-direction:column; gap:6px;">' +
              '<h4>' + escapeHtml(p.name) + '</h4>' +
              '<p>' + escapeHtml(desc) + '</p>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      startCardCarousels(grid);
      grid.querySelectorAll('.highlight-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var p = items.find(function (x) { return String(x.id) === card.getAttribute('data-id'); });
          if (p) Modal.open({ title: p.name, images: p.images, desc: p.description });
        });
      });
    })
    .catch(function () {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_highlights') : '') + '</p>';
    });
})();

// ============ SEASONAL PICKS (dynamic, admin-editable) ============
(function () {
  var SEASON_ORDER = ['summer', 'rainy', 'winter'];
  var buttons = document.querySelectorAll('#season-buttons .season-btn');
  var descEl = document.getElementById('season-desc');
  var picksEl = document.getElementById('season-picks');
  if (!descEl) return;

  var seasonsData = [];
  var currentIndex = 0;

  function render(index) {
    currentIndex = index;
    var key = SEASON_ORDER[index];
    var s = seasonsData.find(function (x) { return x.season_key === key; });
    buttons.forEach(function (b, i) {
      b.classList.toggle('active', i === index);
      var bKey = SEASON_ORDER[i];
      var bs = seasonsData.find(function (x) { return x.season_key === bKey; });
      var name = window.t ? window.t('season_' + bKey) : bKey;
      b.textContent = name + (bs && bs.period_text ? ' (' + bs.period_text + ')' : '');
    });
    if (!s) { descEl.textContent = ''; picksEl.innerHTML = ''; return; }
    descEl.textContent = s.description || '';
    picksEl.innerHTML = (s.images && s.images.length)
      ? '<div class="season-images">' + s.images.map(function (src) {
          return '<img src="' + escapeHtml(src) + '" alt="">';
        }).join('') + '</div>'
      : '';
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      render(parseInt(btn.getAttribute('data-season'), 10));
    });
  });

  window.addEventListener('langchange', function () { render(currentIndex); });

  fetch(API_BASE + '/api/seasons')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      seasonsData = data;
      render(0);
    })
    .catch(function () { render(0); });
})();

// ============ 12-MONTH CALENDAR (dynamic, split optional blocks + gallery) ============
(function () {
  var monthButtonsEl = document.getElementById('month-buttons');
  if (!monthButtonsEl) return;

  var galleryWrap = document.getElementById('calendar-gallery-wrap');
  var galleryEl = document.getElementById('calendar-gallery');
  var hasDataPanel = document.getElementById('calendar-has-data');
  var noDataPanel = document.getElementById('calendar-no-data');
  var traditionBlock = document.getElementById('cal-tradition-block');
  var activityBlock = document.getElementById('cal-activity-block');
  var productsBlock = document.getElementById('cal-products-block');
  var traditionTag = document.getElementById('cal-tradition-tag');
  var traditionItemsEl = document.getElementById('cal-tradition-items');
  var activityItemsEl = document.getElementById('cal-activity-items');
  var productsEl = document.getElementById('cal-products');
  var emptyText = document.getElementById('cal-empty-text');
  var monthData = [];
  var currentMonthIndex = 0;

  function renderGalleryFor(images) {
    images = Array.isArray(images) ? images.filter(Boolean) : [];
    if (!images.length) {
      galleryWrap.style.display = 'none';
      galleryEl.innerHTML = '';
      return;
    }
    galleryWrap.style.display = 'block';
    galleryEl.innerHTML = renderCoverHtml(images, '');
    var carousel = galleryEl.querySelector('.card-carousel');
    if (carousel) {
      // Reuse the same crossfade engine but at gallery size.
      carousel.style.position = 'absolute';
      carousel.style.inset = '0';
      carousel.style.width = '100%';
      carousel.style.height = '100%';
      startCardCarousels(galleryEl);
    }
  }

  function select(index) {
    currentMonthIndex = index;
    var buttons = monthButtonsEl.querySelectorAll('.pill-btn');
    buttons.forEach(function (b, i) { b.classList.toggle('active', i === index); });

    var m = monthData[index];
    renderGalleryFor(m.images);

    var traditions = Array.isArray(m.traditions) ? m.traditions.filter(function (t) { return t.title || t.desc; }) : [];
    var activities = Array.isArray(m.activities) ? m.activities.filter(function (t) { return t.title || t.desc; }) : [];

    var anyBlock = traditions.length || activities.length || m.products;
    if (anyBlock) {
      hasDataPanel.style.display = 'flex';
      noDataPanel.style.display = 'none';

      if (traditions.length) {
        traditionBlock.style.display = 'flex';
        var monthLabel = window.monthName ? window.monthName(m.month_index) : m.label;
        traditionTag.textContent = window.t ? window.t('cal_tradition_prefix').replace('{month}', monthLabel) : monthLabel;
        traditionItemsEl.innerHTML = traditions.map(function (t) {
          return '<div><h4>' + escapeHtml(t.title) + '</h4><p>' + escapeHtml(t.desc) + '</p></div>';
        }).join('');
      } else {
        traditionBlock.style.display = 'none';
      }

      if (activities.length) {
        activityBlock.style.display = 'flex';
        activityItemsEl.innerHTML = activities.map(function (t) {
          return '<div><h4>' + escapeHtml(t.title) + '</h4><p>' + escapeHtml(t.desc) + '</p></div>';
        }).join('');
      } else {
        activityBlock.style.display = 'none';
      }

      var productList = (m.products || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (productList.length) {
        productsBlock.style.display = 'flex';
        productsEl.innerHTML = '';
        productList.forEach(function (name) {
          var span = document.createElement('span');
          span.className = 'product-chip';
          span.textContent = name;
          productsEl.appendChild(span);
        });
      } else {
        productsBlock.style.display = 'none';
      }
    } else {
      hasDataPanel.style.display = 'none';
      noDataPanel.style.display = 'flex';
      var monthLabelEmpty = window.monthName ? window.monthName(m.month_index) : m.label;
      emptyText.textContent = window.t ? window.t('cal_updating_prefix').replace('{month}', monthLabelEmpty) : monthLabelEmpty;
    }
  }

  fetch(API_BASE + '/api/calendar')
    .then(function (res) { return res.json(); })
    .then(function (months) {
      monthData = months;
      monthButtonsEl.innerHTML = '';
      months.forEach(function (m, i) {
        var btn = document.createElement('button');
        btn.className = 'pill-btn' + (i === 0 ? ' active' : '');
        btn.textContent = window.monthName ? window.monthName(i) : m.label;
        btn.setAttribute('data-month', i);
        btn.addEventListener('click', function () { select(i); });
        monthButtonsEl.appendChild(btn);
      });
      if (months.length) select(0);
    })
    .catch(function () {
      monthButtonsEl.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_calendar') : '') + '</p>';
    });

  window.addEventListener('langchange', function () {
    if (!monthData.length) return;
    monthButtonsEl.querySelectorAll('.pill-btn').forEach(function (btn, i) {
      btn.textContent = window.monthName ? window.monthName(i) : monthData[i].label;
    });
    select(currentMonthIndex);
  });
})();

// ============ Q&A FORM ============
(function () {
  var form = document.getElementById('qa-form');
  var successMsg = document.getElementById('qa-success');
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    successMsg.classList.remove('show');
    successMsg.style.color = '';

    var name = document.getElementById('qa-name').value.trim();
    var contact = document.getElementById('qa-contact').value.trim();
    var question = document.getElementById('qa-question').value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = window.t ? window.t('qa_sending') : 'กำลังส่ง...';

    fetch(API_BASE + '/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, contact: contact, question: question })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          successMsg.textContent = window.t ? window.t('qa_success') : 'ขอบคุณสำหรับคำถาม ทีมงานจะติดต่อกลับโดยเร็วที่สุด';
          successMsg.classList.add('show');
          form.reset();
        } else {
          successMsg.textContent = (result.data && result.data.error) || (window.t ? window.t('qa_fail_generic') : 'ส่งคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
          successMsg.style.color = '#B23A3A';
          successMsg.classList.add('show');
        }
      })
      .catch(function () {
        successMsg.textContent = window.t ? window.t('qa_fail_network') : 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ backend เปิดอยู่ (backend/app.py)';
        successMsg.style.color = '#B23A3A';
        successMsg.classList.add('show');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = window.t ? window.t('qa_submit_btn') : 'ส่งคำถาม';
      });
  });
})();

// ============ STORIES (dynamic, per-language content) ============
(function () {
  var grid = document.getElementById('story-grid');
  if (!grid) return;
  var searchInput = document.getElementById('story-search');

  var allStories = [];

  // Thai fields (title/excerpt) are required on every story, so Thai always
  // shows everything. EN/ZH only show stories where that language's fields
  // were filled in by the admin — otherwise the story simply doesn't appear.
  function localize(s) {
    var lang = window.getLang ? window.getLang() : 'th';
    if (lang === 'en' && s.title_en && s.excerpt_en) {
      return { title: s.title_en, excerpt: s.excerpt_en };
    }
    if (lang === 'zh' && s.title_zh && s.excerpt_zh) {
      return { title: s.title_zh, excerpt: s.excerpt_zh };
    }
    if (lang === 'th') return { title: s.title, excerpt: s.excerpt };
    return null;
  }

  function render() {
    var q = (searchInput.value || '').trim().toLowerCase();
    var visible = allStories
      .map(function (s) { return { s: s, l: localize(s) }; })
      .filter(function (x) { return x.l; })
      .filter(function (x) { return !q || x.l.title.toLowerCase().indexOf(q) !== -1 || (x.s.published_at || '').indexOf(q) !== -1; });

    if (!visible.length) {
      grid.innerHTML = '<p class="no-results">' +
        (window.t ? window.t(!allStories.length ? 'err_load_stories' : (q ? 'no_results' : 'no_stories_lang')) : '') + '</p>';
      return;
    }

    grid.innerHTML = visible.map(function (x) {
      var cover = renderCoverHtml(
        x.s.images, x.l.title,
        '<div class="thumb"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8AA08F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg></div>'
      );
      return (
        '<div class="card clickable story-card" data-id="' + x.s.id + '">' + cover +
        '<div class="body">' +
          '<span class="date">' + escapeHtml(x.s.published_at) + '</span>' +
          '<h4>' + escapeHtml(x.l.title) + '</h4>' +
          '<p>' + escapeHtml(x.l.excerpt.length > 90 ? x.l.excerpt.slice(0, 90) + '…' : x.l.excerpt) + '</p>' +
        '</div></div>'
      );
    }).join('');
    startCardCarousels(grid);
    grid.querySelectorAll('.story-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var s = allStories.find(function (x) { return String(x.id) === card.getAttribute('data-id'); });
        var l = s && localize(s);
        if (s && l) Modal.open({ title: l.title, tag: s.published_at, images: s.images, desc: l.excerpt });
      });
    });
  }

  fetch(API_BASE + '/api/stories')
    .then(function (res) { return res.json(); })
    .then(function (stories) {
      allStories = stories;
      render();
    })
    .catch(function () {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_stories') : '') + '</p>';
    });

  searchInput.addEventListener('input', render);
  window.addEventListener('langchange', render);
})();

// ============ PRODUCTS (dynamic, searchable + tag-filterable) ============
(function () {
  var productGrid = document.getElementById('product-grid');
  if (!productGrid) return;
  var searchInput = document.getElementById('product-search');
  var tagFiltersEl = document.getElementById('product-tag-filters');

  var allProducts = [];
  var activeTag = 'all';

  // Thai fields are required, so Thai always shows everything. EN/ZH only
  // show products where that language's name + description were filled in.
  function localize(p) {
    var lang = window.getLang ? window.getLang() : 'th';
    if (lang === 'en' && p.name_en && p.description_en) return { name: p.name_en, description: p.description_en };
    if (lang === 'zh' && p.name_zh && p.description_zh) return { name: p.name_zh, description: p.description_zh };
    if (lang === 'th') return { name: p.name, description: p.description };
    return null;
  }

  function renderProductCard(p, l) {
    var cover = renderCoverHtml(
      p.images, l.name,
      '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1B4D2E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg></div>'
    );
    var priceHtml = p.price_text ? '<div class="product-price">' + escapeHtml(p.price_text) + '</div>' : '';
    var tagsHtml = (p.tags && p.tags.length)
      ? '<div>' + p.tags.map(function (t) { return '<span class="tag-chip">' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
      : '';
    var desc = l.description.length > 90 ? l.description.slice(0, 90) + '…' : l.description;
    var cartBtnHtml = (p.price_amount != null)
      ? '<button type="button" class="btn-small add-to-cart-btn" style="margin-top:8px; width:fit-content;">' + (window.t ? window.t('add_to_cart_btn') : '') + '</button>'
      : '';
    return (
      '<div class="card clickable product-card" data-id="' + p.id + '">' + cover +
      '<div class="body">' +
        '<h4>' + escapeHtml(l.name) + '</h4>' +
        '<p>' + escapeHtml(desc) + '</p>' +
        tagsHtml +
        priceHtml +
        cartBtnHtml +
      '</div></div>'
    );
  }

  function renderTagFilters() {
    var tagSet = {};
    allProducts.forEach(function (p) { (p.tags || []).forEach(function (t) { tagSet[t] = true; }); });
    var tags = Object.keys(tagSet);
    if (!tags.length) { tagFiltersEl.style.display = 'none'; return; }
    tagFiltersEl.style.display = 'flex';
    tagFiltersEl.innerHTML = '<button type="button" class="pill-btn' + (activeTag === 'all' ? ' active' : '') + '" data-tag="all">' + (window.t ? window.t('tag_all') : 'ทั้งหมด') + '</button>' +
      tags.map(function (t) {
        return '<button type="button" class="pill-btn' + (activeTag === t ? ' active' : '') + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
      }).join('');
    tagFiltersEl.querySelectorAll('.pill-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTag = btn.getAttribute('data-tag');
        render();
      });
    });
  }

  function render() {
    var q = (searchInput.value || '').trim().toLowerCase();
    var visible = allProducts
      .map(function (p) { return { p: p, l: localize(p) }; })
      .filter(function (x) { return x.l; })
      .filter(function (x) {
        var matchesTag = activeTag === 'all' || (x.p.tags || []).indexOf(activeTag) !== -1;
        var matchesQuery = !q || x.l.name.toLowerCase().indexOf(q) !== -1 || (x.p.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
        return matchesTag && matchesQuery;
      });
    productGrid.innerHTML = visible.length
      ? visible.map(function (x) { return renderProductCard(x.p, x.l); }).join('')
      : '<p class="no-results">' + (window.t ? window.t(!allProducts.length ? 'err_load_products' : 'no_results') : '') + '</p>';
    startCardCarousels(productGrid);
    productGrid.querySelectorAll('.product-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var x = visible.find(function (x) { return String(x.p.id) === card.getAttribute('data-id'); });
        if (x) Modal.open({ title: x.l.name, images: x.p.images, desc: x.l.description, priceText: x.p.price_text });
      });
      var cartBtn = card.querySelector('.add-to-cart-btn');
      if (cartBtn) {
        cartBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var x = visible.find(function (x) { return String(x.p.id) === card.getAttribute('data-id'); });
          if (x && window.Cart) window.Cart.add(x.p);
        });
      }
    });
  }

  searchInput.addEventListener('input', render);
  window.addEventListener('langchange', function () { renderTagFilters(); render(); });

  fetch(API_BASE + '/api/products')
    .then(function (res) { return res.json(); })
    .then(function (products) {
      allProducts = products;
      renderTagFilters();
      render();
    })
    .catch(function () {
      productGrid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_products') : '') + '</p>';
    });
})();

// ============ SERVICES (dynamic, grouped by type, searchable + tag-filterable) ============
(function () {
  var wrap = document.getElementById('service-groups');
  if (!wrap) return;
  var searchInput = document.getElementById('service-search');
  var tagFiltersEl = document.getElementById('service-tag-filters');

  var TYPE_LABELS = {
    tour: 'ทัวร์', guide: 'ไกด์ชุมชน', restaurant: 'ร้านอาหาร',
    massage: 'นวดไทย', driver: 'บริการรถรับส่ง', accommodation: 'ที่พัก'
  };
  var TYPE_ORDER = ['tour', 'accommodation', 'guide', 'restaurant', 'massage', 'driver'];
  var allServices = [];
  var activeTag = 'all';

  // Thai fields are required, so Thai always shows everything. EN/ZH only
  // show services where that language's name + description were filled in.
  // Type-specific fields (schedule, includes, languages, license, awards)
  // stay Thai-only regardless of the selected language.
  function localize(s) {
    var lang = window.getLang ? window.getLang() : 'th';
    if (lang === 'en' && s.name_en && s.description_en) return { name: s.name_en, description: s.description_en };
    if (lang === 'zh' && s.name_zh && s.description_zh) return { name: s.name_zh, description: s.description_zh };
    if (lang === 'th') return { name: s.name, description: s.description };
    return null;
  }

  function fieldsFor(s) {
    var fields = [];
    if (s.service_type === 'tour' || s.service_type === 'accommodation') {
      if (s.schedule_text) fields.push({ label: 'กำหนดการ / เวลา', value: s.schedule_text });
      if (s.includes_text) fields.push({ label: 'รวม/ไม่รวม/เงื่อนไข', value: s.includes_text });
    }
    if (s.service_type === 'guide') {
      if (s.languages) fields.push({ label: 'ภาษาที่ใช้', value: s.languages });
      if (s.license_no) fields.push({ label: 'ใบอนุญาตไกด์', value: s.license_no });
    }
    if (s.service_type === 'massage') {
      if (s.license_no) fields.push({ label: 'ใบอนุญาต', value: s.license_no });
    }
    if (s.awards) fields.push({ label: 'รางวัล', value: s.awards });
    return fields;
  }

  function renderServiceCard(s, l) {
    var cover = renderCoverHtml(
      s.images, l.name,
      '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1B4D2E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>'
    );
    var priceHtml = s.price_text ? '<div class="product-price">' + escapeHtml(s.price_text) + '</div>' : '';
    var tagsHtml = (s.tags && s.tags.length)
      ? '<div>' + s.tags.map(function (t) { return '<span class="tag-chip">' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
      : '';
    var desc = l.description.length > 90 ? l.description.slice(0, 90) + '…' : l.description;
    var bookBtnHtml = (s.service_type !== 'guide')
      ? '<button type="button" class="btn-small book-service-btn" style="margin-top:8px; width:fit-content;">' + (window.t ? window.t('book_now_btn') : '') + '</button>'
      : '';
    return (
      '<div class="card clickable product-card" data-id="' + s.id + '">' + cover +
      '<div class="body">' +
        '<h4>' + escapeHtml(l.name) + '</h4>' +
        '<p>' + escapeHtml(desc) + '</p>' +
        tagsHtml +
        priceHtml +
        bookBtnHtml +
      '</div></div>'
    );
  }

  function renderTagFilters() {
    var tagSet = {};
    allServices.forEach(function (s) { (s.tags || []).forEach(function (t) { tagSet[t] = true; }); });
    var tags = Object.keys(tagSet);
    if (!tags.length) { tagFiltersEl.style.display = 'none'; return; }
    tagFiltersEl.style.display = 'flex';
    tagFiltersEl.innerHTML = '<button type="button" class="pill-btn' + (activeTag === 'all' ? ' active' : '') + '" data-tag="all">' + (window.t ? window.t('tag_all') : 'ทั้งหมด') + '</button>' +
      tags.map(function (t) {
        return '<button type="button" class="pill-btn' + (activeTag === t ? ' active' : '') + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
      }).join('');
    tagFiltersEl.querySelectorAll('.pill-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTag = btn.getAttribute('data-tag');
        render();
      });
    });
  }

  function render() {
    var q = (searchInput.value || '').trim().toLowerCase();
    var visible = allServices
      .map(function (s) { return { s: s, l: localize(s) }; })
      .filter(function (x) { return x.l; })
      .filter(function (x) {
        var matchesTag = activeTag === 'all' || (x.s.tags || []).indexOf(activeTag) !== -1;
        var matchesQuery = !q || x.l.name.toLowerCase().indexOf(q) !== -1 || (x.s.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
        return matchesTag && matchesQuery;
      });

    if (!visible.length) {
      wrap.innerHTML = '<p class="no-results">' + (window.t ? window.t(!allServices.length ? 'err_load_services' : 'no_results') : '') + '</p>';
      return;
    }
    var html = '';
    TYPE_ORDER.forEach(function (type) {
      var items = visible.filter(function (x) { return x.s.service_type === type; });
      if (!items.length) return;
      html += '<div class="service-type-head"><h4>' + TYPE_LABELS[type] + '</h4></div>';
      html += '<div class="product-grid">' + items.map(function (x) { return renderServiceCard(x.s, x.l); }).join('') + '</div>';
    });
    wrap.innerHTML = html;
    startCardCarousels(wrap);
    wrap.querySelectorAll('.product-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var x = visible.find(function (x) { return String(x.s.id) === card.getAttribute('data-id'); });
        if (x) {
          var s = x.s;
          Modal.open({
            title: x.l.name,
            tag: TYPE_LABELS[s.service_type],
            images: s.images,
            desc: x.l.description,
            fields: fieldsFor(s),
            priceText: s.price_text
          });
        }
      });
      var bookBtn = card.querySelector('.book-service-btn');
      if (bookBtn) {
        bookBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var x = visible.find(function (x) { return String(x.s.id) === card.getAttribute('data-id'); });
          if (x && window.openBooking) window.openBooking(x.s.id, x.l.name);
        });
      }
    });
  }

  searchInput.addEventListener('input', render);
  window.addEventListener('langchange', function () { renderTagFilters(); render(); });

  fetch(API_BASE + '/api/services')
    .then(function (res) { return res.json(); })
    .then(function (services) {
      allServices = services;
      renderTagFilters();
      render();
    })
    .catch(function () {
      wrap.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_services') : '') + '</p>';
    });
})();

// ============ CART (products checkout, guarded — only present on shop.html) ============
var Cart = (function () {
  var fab = document.getElementById('cart-fab');
  if (!fab) return { add: function () {} };

  var STORAGE_KEY = 'cart_items';
  var overlay = document.getElementById('cart-overlay');
  var closeBtn = document.getElementById('cart-close');
  var countEl = document.getElementById('cart-count');
  var itemsEl = document.getElementById('cart-items');
  var totalsEl = document.getElementById('cart-totals');
  var subtotalRow = document.getElementById('cart-subtotal-row');
  var discountRow = document.getElementById('cart-discount-row');
  var shippingRow = document.getElementById('cart-shipping-row');
  var totalRow = document.getElementById('cart-total-row');
  var form = document.getElementById('checkout-form');
  var successMsg = document.getElementById('checkout-success');
  var couponRow = document.getElementById('cart-coupon-row');
  var couponInput = document.getElementById('cart-coupon-input');
  var couponApplyBtn = document.getElementById('cart-coupon-apply-btn');
  var couponMsg = document.getElementById('cart-coupon-msg');
  var appliedCoupon = null;

  function readCart() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeCart(items) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* ignore */ }
  }

  function updateFab() {
    var items = readCart();
    var count = items.reduce(function (sum, it) { return sum + it.qty; }, 0);
    countEl.textContent = count;
    fab.style.display = count > 0 ? 'flex' : 'none';
  }

  function renderCart() {
    var items = readCart();
    if (!items.length) {
      itemsEl.innerHTML = '<p class="cart-empty-msg">' + (window.t ? window.t('cart_empty') : '') + '</p>';
      totalsEl.style.display = 'none';
      couponRow.style.display = 'none';
      return;
    }
    couponRow.style.display = 'flex';
    itemsEl.innerHTML = items.map(function (it, i) {
      return (
        '<div class="cart-item-row" data-index="' + i + '">' +
          '<div><strong>' + escapeHtml(it.name) + '</strong><br><span style="color:var(--text-muted); font-size:13px;">฿' + it.price_amount + ' × ' + it.qty + '</span></div>' +
          '<div class="qty-controls">' +
            '<button type="button" class="qty-minus">−</button>' +
            '<span>' + it.qty + '</span>' +
            '<button type="button" class="qty-plus">+</button>' +
            '<button type="button" class="qty-remove" style="margin-left:8px; color:#B23A3A; border:none; background:none; font-size:13px; cursor:pointer;">✕</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var subtotal = items.reduce(function (sum, it) { return sum + it.price_amount * it.qty; }, 0);
    var discount = 0;
    if (appliedCoupon) {
      discount = appliedCoupon.discount_type === 'percent'
        ? subtotal * appliedCoupon.discount_value / 100
        : Math.min(appliedCoupon.discount_value, subtotal);
    }
    var total = subtotal - discount;
    totalsEl.style.display = 'flex';
    subtotalRow.textContent = (window.t ? window.t('cart_subtotal_label') : '') + ': ฿' + subtotal.toFixed(2);
    if (appliedCoupon) {
      discountRow.style.display = 'block';
      discountRow.textContent = (window.t ? window.t('cart_discount_label') : '') + ' (' + appliedCoupon.code + '): −฿' + discount.toFixed(2);
    } else {
      discountRow.style.display = 'none';
    }
    shippingRow.textContent = (window.t ? window.t('cart_shipping_label') : '') + ': ' + (window.t ? window.t('cart_shipping_tbd') : '');
    totalRow.textContent = (window.t ? window.t('cart_total_label') : '') + ': ฿' + total.toFixed(2);

    itemsEl.querySelectorAll('.cart-item-row').forEach(function (row) {
      var i = parseInt(row.getAttribute('data-index'), 10);
      row.querySelector('.qty-plus').addEventListener('click', function () {
        items[i].qty += 1; writeCart(items); renderCart(); updateFab();
      });
      row.querySelector('.qty-minus').addEventListener('click', function () {
        items[i].qty = Math.max(1, items[i].qty - 1); writeCart(items); renderCart(); updateFab();
      });
      row.querySelector('.qty-remove').addEventListener('click', function () {
        items.splice(i, 1); writeCart(items); renderCart(); updateFab();
      });
    });
  }

  function add(product) {
    var items = readCart();
    var existing = items.find(function (it) { return it.product_id === product.id; });
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({ product_id: product.id, name: product.name, price_amount: product.price_amount, qty: 1 });
    }
    writeCart(items);
    updateFab();
  }

  fab.addEventListener('click', function () {
    renderCart();
    overlay.classList.add('show');
  });
  closeBtn.addEventListener('click', function () { overlay.classList.remove('show'); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('show'); });

  couponApplyBtn.addEventListener('click', function () {
    var code = couponInput.value.trim().toUpperCase();
    couponMsg.classList.remove('show');
    if (!code) return;
    couponApplyBtn.disabled = true;
    fetch(API_BASE + '/api/coupons/validate/' + encodeURIComponent(code))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.valid) {
          appliedCoupon = result.data.coupon;
          couponMsg.textContent = window.t ? window.t('cart_coupon_applied') : '';
          couponMsg.style.color = '';
          couponMsg.classList.add('show');
        } else {
          appliedCoupon = null;
          couponMsg.textContent = (result.data && result.data.error) || (window.t ? window.t('cart_coupon_invalid') : '');
          couponMsg.style.color = '#B23A3A';
          couponMsg.classList.add('show');
        }
        renderCart();
      })
      .catch(function () {
        appliedCoupon = null;
        couponMsg.textContent = window.t ? window.t('cart_coupon_invalid') : '';
        couponMsg.style.color = '#B23A3A';
        couponMsg.classList.add('show');
      })
      .finally(function () { couponApplyBtn.disabled = false; });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var items = readCart();
    if (!items.length) return;
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    successMsg.classList.remove('show');
    successMsg.style.color = '';

    fetch(API_BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: document.getElementById('checkout-name').value.trim(),
        customer_contact: document.getElementById('checkout-contact').value.trim(),
        customer_address: document.getElementById('checkout-address').value.trim(),
        notes: document.getElementById('checkout-notes').value.trim(),
        items: items.map(function (it) { return { product_id: it.product_id, qty: it.qty }; }),
        coupon_code: appliedCoupon ? appliedCoupon.code : ''
      })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          successMsg.textContent = window.t ? window.t('checkout_success') : '';
          successMsg.classList.add('show');
          writeCart([]);
          appliedCoupon = null;
          couponInput.value = '';
          couponMsg.classList.remove('show');
          updateFab();
          form.reset();
        } else {
          successMsg.textContent = (result.data && result.data.error) || (window.t ? window.t('checkout_fail') : '');
          successMsg.style.color = '#B23A3A';
          successMsg.classList.add('show');
        }
      })
      .catch(function () {
        successMsg.textContent = window.t ? window.t('checkout_fail') : '';
        successMsg.style.color = '#B23A3A';
        successMsg.classList.add('show');
      })
      .finally(function () { submitBtn.disabled = false; });
  });

  updateFab();
  return { add: add };
})();

// ============ SERVICE BOOKING (guarded — only present on shop.html) ============
(function () {
  var overlay = document.getElementById('booking-overlay');
  if (!overlay) { window.openBooking = function () {}; return; }

  var closeBtn = document.getElementById('booking-close');
  var nameEl = document.getElementById('booking-service-name');
  var form = document.getElementById('booking-form');
  var successMsg = document.getElementById('booking-success');
  var currentService = null;

  window.openBooking = function (serviceId, serviceName) {
    currentService = { id: serviceId, name: serviceName };
    nameEl.textContent = serviceName;
    successMsg.classList.remove('show');
    form.reset();
    overlay.classList.add('show');
  };

  closeBtn.addEventListener('click', function () { overlay.classList.remove('show'); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('show'); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentService) return;
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    successMsg.classList.remove('show');
    successMsg.style.color = '';

    fetch(API_BASE + '/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: currentService.id,
        service_name: currentService.name,
        customer_name: document.getElementById('booking-name').value.trim(),
        customer_contact: document.getElementById('booking-contact').value.trim(),
        preferred_date: document.getElementById('booking-date').value.trim(),
        party_size: document.getElementById('booking-party').value.trim(),
        notes: document.getElementById('booking-notes').value.trim()
      })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          successMsg.textContent = window.t ? window.t('booking_success') : '';
          successMsg.classList.add('show');
          form.reset();
        } else {
          successMsg.textContent = (result.data && result.data.error) || (window.t ? window.t('booking_fail') : '');
          successMsg.style.color = '#B23A3A';
          successMsg.classList.add('show');
        }
      })
      .catch(function () {
        successMsg.textContent = window.t ? window.t('booking_fail') : '';
        successMsg.style.color = '#B23A3A';
        successMsg.classList.add('show');
      })
      .finally(function () { submitBtn.disabled = false; });
  });
})();
