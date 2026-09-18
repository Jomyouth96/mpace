var API_BASE = '';

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

// ============ ATTRACTIONS (dynamic, from the admin panel) ============
(function () {
  var grid = document.getElementById('attraction-grid');
  var filterButtons = document.querySelectorAll('#attraction-filters .pill-btn');
  var mapEl = document.getElementById('attraction-leaflet-map');
  if (!grid) return;

  // Real GPS center of Mae Ho Phra subdistrict (municipal office), used so the
  // map has a sensible view even before every attraction has a pinned location.
  var COMMUNITY_CENTER = [19.1136158, 99.0202498];

  function applyFilter(filter) {
    grid.querySelectorAll('.place-card').forEach(function (card) {
      var match = filter === 'all' || card.getAttribute('data-category') === filter;
      card.classList.toggle('hidden', !match);
    });
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  function openAttractionModal(p) {
    Modal.open({
      title: p.name,
      tag: p.tag || (p.category === 'nature' ? 'ธรรมชาติ' : 'วัฒนธรรม'),
      images: p.images,
      desc: p.description
    });
  }

  fetch(API_BASE + '/api/attractions')
    .then(function (res) { return res.json(); })
    .then(function (places) {
      if (!places.length) {
        grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_no_attractions') : '') + '</p>';
        return;
      }
      grid.innerHTML = places.map(function (p) {
        var cover = renderCoverHtml(
          p.images, p.name,
          '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F3E9D2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
            (p.category === 'culture'
              ? '<path d="M12 2 4 7v3h16V7Z"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 21h18"/>'
              : '<path d="M12 22V12"/><path d="M12 12C12 7 8 4 4 4c0 5 3 8 8 8Z"/><path d="M12 12c0-5 4-8 8-8 0 5-3 8-8 8Z"/>') +
            '</svg></div>'
        );
        return (
          '<div id="place-' + p.id + '" class="card clickable place-card" data-category="' + escapeHtml(p.category) + '" data-id="' + p.id + '">' + cover +
          '<div class="body">' +
            '<span class="tag" style="width:fit-content;">' + escapeHtml(p.tag || (p.category === 'nature' ? 'ธรรมชาติ' : 'วัฒนธรรม')) + '</span>' +
            '<h4>' + escapeHtml(p.name) + '</h4>' +
            '<p>' + escapeHtml(p.description) + '</p>' +
          '</div></div>'
        );
      }).join('');
      startCardCarousels(grid);

      grid.querySelectorAll('.place-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var p = places.find(function (x) { return String(x.id) === card.getAttribute('data-id'); });
          if (p) openAttractionModal(p);
        });
      });

      // Build real map pins from live attraction GPS data (auto-added for new
      // attractions the moment they have a Google Maps link saved in admin).
      if (mapEl && window.L) {
        var located = places.filter(function (p) { return p.lat != null && p.lng != null; });
        var map = L.map(mapEl, { scrollWheelZoom: false }).setView(COMMUNITY_CENTER, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        located.forEach(function (p) {
          var color = p.category === 'culture' ? '#2E6B47' : '#D9A441';
          var marker = L.circleMarker([p.lat, p.lng], {
            radius: 10, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1
          }).addTo(map);
          var popupEl = document.createElement('div');
          popupEl.innerHTML =
            '<h4>' + escapeHtml(p.name) + '</h4>' +
            '<p>' + escapeHtml((p.description || '').slice(0, 60)) + (p.description && p.description.length > 60 ? '…' : '') + '</p>' +
            '<span class="btn-link">ดูรายละเอียด →</span>';
          popupEl.querySelector('.btn-link').addEventListener('click', function () { openAttractionModal(p); });
          marker.bindPopup(popupEl);
        });

        if (located.length) {
          var bounds = L.latLngBounds(located.map(function (p) { return [p.lat, p.lng]; }));
          map.fitBounds(bounds.pad(0.35), { maxZoom: 15 });
        }
      }
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
        return (
          '<div class="card clickable nearby-card" data-id="' + p.id + '" style="padding:0; overflow:hidden;">' +
            (p.images && p.images.length ? cover : '') +
            '<div style="padding:20px; display:flex; flex-direction:column; gap:6px;">' +
              '<span class="tag" style="width:fit-content;">' + escapeHtml(p.area_tag) + '</span>' +
              '<h4>' + escapeHtml(p.name) + '</h4>' +
              '<p>' + escapeHtml(p.description) + '</p>' +
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

// ============ SEASONAL PICKS ============
(function () {
  var seasons = [
    { descKey: 'season_summer_desc', picks: ['ทุ่งนาอินทรีย์แม่หอพระ', 'วัดบ้านกาด'] },
    { descKey: 'season_rainy_desc', picks: ['น้ำตกหินปูน', 'บ่อน้ำสีมรกต'] },
    { descKey: 'season_winter_desc', picks: ['ถ้ำศักดิ์สิทธิ์', 'ทุ่งนาอินทรีย์แม่หอพระ'] }
  ];

  var buttons = document.querySelectorAll('#season-buttons .season-btn');
  var descEl = document.getElementById('season-desc');
  var picksEl = document.getElementById('season-picks');
  if (!descEl) return;

  var currentIndex = 0;

  function render(index) {
    currentIndex = index;
    var s = seasons[index];
    descEl.textContent = window.t ? window.t(s.descKey) : '';
    picksEl.innerHTML = '';
    s.picks.forEach(function (name) {
      var span = document.createElement('span');
      span.className = 'tag-gold';
      span.textContent = name;
      picksEl.appendChild(span);
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      render(parseInt(btn.getAttribute('data-season'), 10));
    });
  });

  window.addEventListener('langchange', function () { render(currentIndex); });

  render(0);
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
    var visible = allStories
      .map(function (s) { return { s: s, l: localize(s) }; })
      .filter(function (x) { return x.l; });

    if (!visible.length) {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' +
        (window.t ? window.t(allStories.length ? 'no_stories_lang' : 'err_load_stories') : '') + '</p>';
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

  window.addEventListener('langchange', render);
})();

// ============ PRODUCTS (dynamic) ============
(function () {
  var productGrid = document.getElementById('product-grid');
  if (!productGrid) return;

  function renderProductCard(p) {
    var cover = renderCoverHtml(
      p.images, p.name,
      '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1B4D2E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg></div>'
    );
    var priceHtml = p.price_text ? '<div class="product-price">' + escapeHtml(p.price_text) + '</div>' : '';
    return (
      '<div class="card clickable product-card" data-id="' + p.id + '">' + cover +
      '<div class="body">' +
        '<h4>' + escapeHtml(p.name) + '</h4>' +
        '<p>' + escapeHtml(p.description) + '</p>' +
        priceHtml +
      '</div></div>'
    );
  }

  fetch(API_BASE + '/api/products')
    .then(function (res) { return res.json(); })
    .then(function (products) {
      productGrid.innerHTML = products.length
        ? products.map(renderProductCard).join('')
        : '<p style="color:var(--text-muted); font-size:14px;">ยังไม่มีสินค้าในขณะนี้</p>';
      startCardCarousels(productGrid);
      productGrid.querySelectorAll('.product-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var p = products.find(function (x) { return String(x.id) === card.getAttribute('data-id'); });
          if (p) Modal.open({ title: p.name, images: p.images, desc: p.description, priceText: p.price_text });
        });
      });
    })
    .catch(function () {
      productGrid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_products') : '') + '</p>';
    });
})();

// ============ SERVICES (dynamic, grouped by type) ============
(function () {
  var wrap = document.getElementById('service-groups');
  if (!wrap) return;

  var TYPE_LABELS = {
    tour: 'ทัวร์', guide: 'ไกด์ชุมชน', restaurant: 'ร้านอาหาร',
    massage: 'นวดไทย', driver: 'บริการรถรับส่ง'
  };
  var TYPE_ORDER = ['tour', 'guide', 'restaurant', 'massage', 'driver'];

  function fieldsFor(s) {
    var fields = [];
    if (s.service_type === 'tour') {
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

  function renderServiceCard(s) {
    var cover = renderCoverHtml(
      s.images, s.name,
      '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1B4D2E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>'
    );
    var priceHtml = s.price_text ? '<div class="product-price">' + escapeHtml(s.price_text) + '</div>' : '';
    return (
      '<div class="card clickable product-card" data-id="' + s.id + '">' + cover +
      '<div class="body">' +
        '<h4>' + escapeHtml(s.name) + '</h4>' +
        '<p>' + escapeHtml(s.description) + '</p>' +
        priceHtml +
      '</div></div>'
    );
  }

  fetch(API_BASE + '/api/services')
    .then(function (res) { return res.json(); })
    .then(function (services) {
      if (!services.length) {
        wrap.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ยังไม่มีบริการในขณะนี้</p>';
        return;
      }
      var html = '';
      TYPE_ORDER.forEach(function (type) {
        var items = services.filter(function (s) { return s.service_type === type; });
        if (!items.length) return;
        html += '<div class="service-type-head"><h4>' + TYPE_LABELS[type] + '</h4></div>';
        html += '<div class="product-grid">' + items.map(renderServiceCard).join('') + '</div>';
      });
      wrap.innerHTML = html;
      startCardCarousels(wrap);
      wrap.querySelectorAll('.product-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var s = services.find(function (x) { return String(x.id) === card.getAttribute('data-id'); });
          if (s) {
            Modal.open({
              title: s.name,
              tag: TYPE_LABELS[s.service_type],
              images: s.images,
              desc: s.description,
              fields: fieldsFor(s),
              priceText: s.price_text
            });
          }
        });
      });
    })
    .catch(function () {
      wrap.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">' + (window.t ? window.t('err_load_services') : '') + '</p>';
    });
})();
