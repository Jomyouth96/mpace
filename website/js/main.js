// ============ ATTRACTIONS (dynamic, from the admin panel) ============
(function () {
  var API_BASE = '';
  var grid = document.getElementById('attraction-grid');
  var filterButtons = document.querySelectorAll('#attraction-filters .pill-btn');
  if (!grid) return;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function cultureThumb() {
    return '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F3E9D2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 7v3h16V7Z"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 21h18"/></svg></div>';
  }
  function natureThumb() {
    return '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F3E9D2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12C12 7 8 4 4 4c0 5 3 8 8 8Z"/><path d="M12 12c0-5 4-8 8-8 0 5-3 8-8 8Z"/></svg></div>';
  }

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

  fetch(API_BASE + '/api/attractions')
    .then(function (res) { return res.json(); })
    .then(function (places) {
      if (!places.length) {
        grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ยังไม่มีข้อมูลแหล่งท่องเที่ยว</p>';
        return;
      }
      grid.innerHTML = places.map(function (p) {
        var img = p.image_path
          ? '<img src="' + escapeHtml(p.image_path) + '" alt="' + escapeHtml(p.name) + '">'
          : (p.category === 'culture' ? cultureThumb() : natureThumb());
        return (
          '<div id="place-' + p.id + '" class="card place-card" data-category="' + escapeHtml(p.category) + '">' + img +
          '<div class="body">' +
            '<span class="tag" style="width:fit-content;">' + escapeHtml(p.tag || (p.category === 'nature' ? 'ธรรมชาติ' : 'วัฒนธรรม')) + '</span>' +
            '<h4>' + escapeHtml(p.name) + '</h4>' +
            '<p>' + escapeHtml(p.description) + '</p>' +
          '</div></div>'
        );
      }).join('');
    })
    .catch(function () {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ไม่สามารถโหลดแหล่งท่องเที่ยวได้ในขณะนี้</p>';
    });
})();

// ============ SEASONAL PICKS ============
(function () {
  var seasons = [
    {
      label: 'ฤดูร้อน (มี.ค.–มิ.ย.)',
      desc: 'อากาศแจ่มใสยามเช้า เหมาะเดินชมทุ่งนาและกราบไหว้พระที่วัดบ้านกาดก่อนแดดจัด',
      picks: ['ทุ่งนาอินทรีย์แม่หอพระ', 'วัดบ้านกาด']
    },
    {
      label: 'ฤดูฝน (ก.ค.–ต.ค.)',
      desc: 'สายน้ำในน้ำตกและบ่อน้ำไหลแรงเต็มที่ ทุ่งนาเขียวขจีสุดสายตา เหมาะกับคนชอบธรรมชาติชุ่มฉ่ำ',
      picks: ['น้ำตกหินปูน', 'บ่อน้ำสีมรกต']
    },
    {
      label: 'ฤดูหนาว (พ.ย.–ก.พ.)',
      desc: 'อากาศเย็นสบาย เหมาะเดินป่าเข้าชมถ้ำ พร้อมสัมผัสทุ่งข้าวสีทองในช่วงเก็บเกี่ยว',
      picks: ['ถ้ำศักดิ์สิทธิ์', 'ทุ่งนาอินทรีย์แม่หอพระ']
    }
  ];

  var buttons = document.querySelectorAll('#season-buttons .season-btn');
  var descEl = document.getElementById('season-desc');
  var picksEl = document.getElementById('season-picks');

  function render(index) {
    var s = seasons[index];
    descEl.textContent = s.desc;
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

  render(0);
})();

// ============ 12-MONTH CALENDAR (dynamic, from the admin panel) ============
(function () {
  var API_BASE = '';
  var monthButtonsEl = document.getElementById('month-buttons');
  if (!monthButtonsEl) return;

  var hasDataPanel = document.getElementById('calendar-has-data');
  var noDataPanel = document.getElementById('calendar-no-data');
  var traditionTag = document.getElementById('cal-tradition-tag');
  var traditionTitle = document.getElementById('cal-tradition-title');
  var traditionDesc = document.getElementById('cal-tradition-desc');
  var activityTitle = document.getElementById('cal-activity-title');
  var activityDesc = document.getElementById('cal-activity-desc');
  var productsEl = document.getElementById('cal-products');
  var emptyText = document.getElementById('cal-empty-text');
  var monthData = [];

  function select(index) {
    var buttons = monthButtonsEl.querySelectorAll('.pill-btn');
    buttons.forEach(function (b, i) { b.classList.toggle('active', i === index); });

    var m = monthData[index];
    if (m.tradition_title) {
      hasDataPanel.style.display = 'grid';
      noDataPanel.style.display = 'none';
      traditionTag.textContent = 'ประเพณีประจำเดือน' + m.label;
      traditionTitle.textContent = m.tradition_title;
      traditionDesc.textContent = m.tradition_desc || '';
      activityTitle.textContent = m.activity_title || '';
      activityDesc.textContent = m.activity_desc || '';
      productsEl.innerHTML = '';
      (m.products || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (name) {
        var span = document.createElement('span');
        span.className = 'product-chip';
        span.textContent = name;
        productsEl.appendChild(span);
      });
    } else {
      hasDataPanel.style.display = 'none';
      noDataPanel.style.display = 'flex';
      emptyText.textContent = 'กำลังอัปเดตข้อมูลประเพณี สินค้าเกษตร และกิจกรรมของเดือน' + m.label;
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
        btn.textContent = m.label;
        btn.setAttribute('data-month', i);
        btn.addEventListener('click', function () { select(i); });
        monthButtonsEl.appendChild(btn);
      });
      if (months.length) select(0);
    })
    .catch(function () {
      monthButtonsEl.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ไม่สามารถโหลดปฏิทินได้ในขณะนี้</p>';
    });
})();

// ============ Q&A FORM ============
(function () {
  var form = document.getElementById('qa-form');
  var successMsg = document.getElementById('qa-success');
  if (!form) return;

  // Points at the local Flask backend in /backend (see backend/app.py).
  // Change this if the API is deployed somewhere else.
  var API_BASE = '';

  var submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    successMsg.classList.remove('show');
    successMsg.style.color = '';

    var name = document.getElementById('qa-name').value.trim();
    var contact = document.getElementById('qa-contact').value.trim();
    var question = document.getElementById('qa-question').value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่ง...';

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
          successMsg.textContent = 'ขอบคุณสำหรับคำถาม ทีมงานจะติดต่อกลับโดยเร็วที่สุด';
          successMsg.classList.add('show');
          form.reset();
        } else {
          successMsg.textContent = (result.data && result.data.error) || 'ส่งคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
          successMsg.style.color = '#B23A3A';
          successMsg.classList.add('show');
        }
      })
      .catch(function () {
        successMsg.textContent = 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ backend เปิดอยู่ (backend/app.py)';
        successMsg.style.color = '#B23A3A';
        successMsg.classList.add('show');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ส่งคำถาม';
      });
  });
})();

// ============ DYNAMIC CONTENT (stories & products, from the admin panel) ============
(function () {
  var API_BASE = '';

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  var placeholderThumb =
    '<div class="thumb"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8AA08F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg></div>';

  function loadStories() {
    var grid = document.getElementById('story-grid');
    if (!grid) return;
    fetch(API_BASE + '/api/stories')
      .then(function (res) { return res.json(); })
      .then(function (stories) {
        if (!stories.length) {
          grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ยังไม่มีเรื่องราวในขณะนี้ ติดตามเร็ว ๆ นี้</p>';
          return;
        }
        grid.innerHTML = stories.map(function (s) {
          var img = s.image_path
            ? '<img src="' + escapeHtml(s.image_path) + '" alt="' + escapeHtml(s.title) + '" style="width:100%; height:170px; object-fit:cover;">'
            : placeholderThumb;
          return (
            '<div class="card story-card">' + img +
            '<div class="body">' +
              '<span class="date">' + escapeHtml(s.published_at) + '</span>' +
              '<h4>' + escapeHtml(s.title) + '</h4>' +
              '<p>' + escapeHtml(s.excerpt) + '</p>' +
            '</div></div>'
          );
        }).join('');
      })
      .catch(function () {
        grid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ไม่สามารถโหลดเรื่องราวได้ในขณะนี้</p>';
      });
  }

  function renderProductCard(p) {
    var img = p.image_path
      ? '<img src="' + escapeHtml(p.image_path) + '" alt="' + escapeHtml(p.name) + '">'
      : '<div class="thumb"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1B4D2E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg></div>';
    var priceHtml = p.price_text
      ? '<div class="product-price">' + escapeHtml(p.price_text) + '</div>'
      : '';
    return (
      '<div class="card product-card">' + img +
      '<div class="body">' +
        '<h4>' + escapeHtml(p.name) + '</h4>' +
        '<p>' + escapeHtml(p.description) + '</p>' +
        priceHtml +
      '</div></div>'
    );
  }

  function loadProducts() {
    var productGrid = document.getElementById('product-grid');
    var serviceGrid = document.getElementById('service-grid');
    if (!productGrid && !serviceGrid) return;
    fetch(API_BASE + '/api/products')
      .then(function (res) { return res.json(); })
      .then(function (items) {
        var products = items.filter(function (p) { return p.kind === 'product'; });
        var services = items.filter(function (p) { return p.kind === 'service'; });
        if (productGrid) {
          productGrid.innerHTML = products.length
            ? products.map(renderProductCard).join('')
            : '<p style="color:var(--text-muted); font-size:14px;">ยังไม่มีสินค้าในขณะนี้</p>';
        }
        if (serviceGrid) {
          serviceGrid.innerHTML = services.length
            ? services.map(renderProductCard).join('')
            : '<p style="color:var(--text-muted); font-size:14px;">ยังไม่มีบริการในขณะนี้</p>';
        }
      })
      .catch(function () {
        if (productGrid) productGrid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ไม่สามารถโหลดสินค้าได้ในขณะนี้</p>';
        if (serviceGrid) serviceGrid.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">ไม่สามารถโหลดบริการได้ในขณะนี้</p>';
      });
  }

  loadStories();
  loadProducts();
})();
