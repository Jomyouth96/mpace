// ============ LANGUAGE SWITCHER (static site text only) ============
// Admin-managed content (attractions, calendar, products, services, stories,
// Q&A) is fetched from the database and stays Thai-only — translating that
// would require bilingual fields in every admin form, which is out of scope
// for now. This file only covers the fixed site chrome and copy.
(function () {
  var TRANSLATIONS = {
    th: {
      page_title: 'วิสาหกิจชุมชนเกษตรเชิงท่องเที่ยวตำบลแม่หอพระ',
      page_desc: 'เที่ยววิถีชุมชน สัมผัสธรรมชาติ วัฒนธรรม สินค้าและบริการของตำบลแม่หอพระ อำเภอแม่แตง จังหวัดเชียงใหม่',
      brand_title: 'วิสาหกิจชุมชนเกษตรเชิงท่องเที่ยว',
      brand_subtitle: 'ตำบลแม่หอพระ อ.แม่แตง จ.เชียงใหม่',
      nav_home: 'หน้าแรก',
      nav_about: 'เกี่ยวกับเรา',
      nav_attractions: 'แหล่งท่องเที่ยว',
      nav_calendar: 'ปฏิทินประสบการณ์',
      nav_shop: 'สินค้าและบริการในชุมชน',
      nav_stories: 'เรื่องราว',
      nav_contact: 'ติดต่อเรา',
      hero_badge: 'วิสาหกิจชุมชนเกษตรเชิงท่องเที่ยวตำบลแม่หอพระ',
      hero_title: 'เที่ยววิถีชุมชน<br>สัมผัสธรรมชาติแม่หอพระ',
      hero_desc: 'ย้อนกลับสู่วิถีเกษตรอินทรีย์และภูมิปัญญาล้านนาดั้งเดิม เดินเล่นท่ามกลางทุ่งนาเขียวขจี เรียนรู้งานฝีมือจากผู้เฒ่าผู้แก่ และลิ้มรสอาหารพื้นบ้านแท้ ๆ ของตำบลแม่หอพระ อำเภอแม่แตง จังหวัดเชียงใหม่',
      hero_btn_shop: 'ดูสินค้าและบริการ',
      hero_btn_about: 'เกี่ยวกับวิสาหกิจ',
      feat1_title: 'เกษตรอินทรีย์วิถีพื้นบ้าน',
      feat1_desc: 'เรียนรู้การทำเกษตรที่ไม่พึ่งสารเคมี ปลูกด้วยน้ำธรรมชาติ เก็บเกี่ยวสดใหม่จากแปลง',
      feat2_title: 'วัฒนธรรมและประเพณี',
      feat2_desc: 'สัมผัสวิถีล้านนาดั้งเดิมผ่านปฏิทิน 12 เดือน ทั้งตานข้าวใหม่ ปี๋ใหม่เมือง และแห่ไม้ค้ำ',
      feat3_title: 'กระจายรายได้สู่ชุมชน',
      feat3_desc: 'ทุกการเดินทางและการอุดหนุนสินค้า ส่งตรงถึงมือเกษตรกรและกลุ่มอาชีพผู้สูงอายุในพื้นที่',
      attractions_title: 'แหล่งท่องเที่ยวแม่หอพระ',
      attractions_desc: 'รวมแหล่งท่องเที่ยวทุกที่ในพื้นที่ ทั้งธรรมชาติ วัด และตำนานท้องถิ่นที่รอให้คุณมาสัมผัส ในระยะไม่ไกลจากตัวชุมชน',
      filter_all: 'ทั้งหมด',
      filter_nature: 'แหล่งท่องเที่ยวทางธรรมชาติ',
      filter_culture: 'แหล่งท่องเที่ยวทางวัฒนธรรม',
      loading_attractions: 'กำลังโหลดแหล่งท่องเที่ยว...',
      seasonal_title: 'แนะนำแหล่งท่องเที่ยวตามฤดูกาล',
      season_summer: 'ฤดูร้อน (มี.ค.–มิ.ย.)',
      season_rainy: 'ฤดูฝน (ก.ค.–ต.ค.)',
      season_winter: 'ฤดูหนาว (พ.ย.–ก.พ.)',
      season_summer_desc: 'อากาศแจ่มใสยามเช้า เหมาะเดินชมทุ่งนาและกราบไหว้พระที่วัดบ้านกาดก่อนแดดจัด',
      season_rainy_desc: 'สายน้ำในน้ำตกและบ่อน้ำไหลแรงเต็มที่ ทุ่งนาเขียวขจีสุดสายตา เหมาะกับคนชอบธรรมชาติชุ่มฉ่ำ',
      season_winter_desc: 'อากาศเย็นสบาย เหมาะเดินป่าเข้าชมถ้ำ พร้อมสัมผัสทุ่งข้าวสีทองในช่วงเก็บเกี่ยว',
      map_title: 'แผนที่แหล่งท่องเที่ยวแม่หอพระ',
      map_desc: 'แผนที่จริงจากพิกัด GPS ของแต่ละสถานที่ — คลิกหมุดเพื่อดูข้อมูล และกด "ดูรายละเอียด" เพื่อดูข้อมูลเต็มของสถานที่นั้น',
      legend_nature: 'ธรรมชาติ',
      legend_culture: 'วัฒนธรรม',
      view_details: 'ดูรายละเอียด →',
      nearby_title: 'แหล่งท่องเที่ยวใกล้เคียง',
      nearby_desc: 'ต่อยอดทริปไปยังแหล่งท่องเที่ยวชื่อดังในอำเภอใกล้เคียง — แม่แตง สันทราย และพร้าว',
      loading_generic: 'กำลังโหลด...',
      calendar_title: 'ปฏิทินวิถีชีวิตและผลผลิต 12 เดือน',
      calendar_desc: 'เลือกเดือนที่สนใจ เพื่อดูประเพณี สินค้าเกษตรประจำฤดู และกิจกรรมแนะนำของเดือนนั้น',
      cal_tradition_prefix: 'ประเพณีประจำเดือน{month}',
      cal_activity_tag: 'กิจกรรมแนะนำ',
      cal_products_tag: 'สินค้าเกษตรประจำเดือน',
      cal_updating_prefix: 'กำลังอัปเดตข้อมูลประเพณี สินค้าเกษตร และกิจกรรมของเดือน{month}',
      err_load_calendar: 'ไม่สามารถโหลดปฏิทินได้ในขณะนี้',
      brand_by: 'แบรนด์สินค้าและบริการโดย รักษ์พนา',
      shop_title: 'สินค้าและบริการในชุมชน',
      shop_desc: 'ผลผลิตปลอดภัยจากเกษตรกรและบริการนำเที่ยวโดยคนในพื้นที่ ทุกรายการสร้างรายได้กลับคืนสู่ชุมชนแม่หอพระ',
      subsection_products: 'สินค้าชุมชน',
      loading_products: 'กำลังโหลดสินค้า...',
      subsection_services: 'บริการชุมชน',
      loading_services: 'กำลังโหลดบริการ...',
      search_products_placeholder: 'ค้นหาสินค้าจากชื่อหรือแท็ก...',
      search_services_placeholder: 'ค้นหาบริการจากชื่อหรือแท็ก...',
      search_stories_placeholder: 'ค้นหาบทความจากชื่อหรือวันที่...',
      no_results: 'ไม่พบรายการที่ตรงกับการค้นหา',
      tag_all: 'ทั้งหมด',
      stories_title: 'เรื่องราวแม่หอพระ',
      stories_desc: 'ตำนาน วิถีชีวิต และภูมิปัญญาท้องถิ่นของตำบลแม่หอพระ บอกเล่าผ่านบทความจากคนในชุมชน',
      loading_stories: 'กำลังโหลดเรื่องราว...',
      about_title: 'ความเป็นมาของวิสาหกิจ',
      about_p1: 'วิสาหกิจชุมชนเกษตรเชิงท่องเที่ยวตำบลแม่หอพระ อำเภอแม่แตง จังหวัดเชียงใหม่ นับเป็นต้นแบบการรวมกลุ่มของคนในท้องถิ่นที่นำศักยภาพด้านการเกษตรและทรัพยากรธรรมชาติมาต่อยอดสู่การท่องเที่ยวอย่างยั่งยืน จนได้รับการรับรองมาตรฐานโครงการ TAT STAR จากการท่องเที่ยวแห่งประเทศไทย',
      about_p2: 'การดำเนินงานของกลุ่มมีความโดดเด่นในฐานะศูนย์วิจัยชุมชนและนวัตกรรมเกษตร ที่มุ่งถ่ายทอดองค์ความรู้ด้านการอนุรักษ์และการบริหารจัดการทรัพยากรชีวภาพอย่างเป็นรูปธรรม โดยเฉพาะความสำเร็จด้านนวัตกรรมการเพาะเชื้อเห็ดตับเต่า ควบคู่ไปกับการออกแบบกิจกรรมการท่องเที่ยวเชิงเรียนรู้ที่เปิดโอกาสให้ผู้มาเยือนได้สัมผัสวิถีชีวิตชาวบ้าน ภูมิทัศน์สวนผลไม้ และวิถีเกษตรอินทรีย์อย่างใกล้ชิด นอกจากนี้ ชุมชนยังให้ความสำคัญกับการยกระดับผลผลิตทางการเกษตรผ่านการแปรรูปเป็นผลิตภัณฑ์และของฝากพื้นถิ่น ซึ่งช่วยสร้างมูลค่าเพิ่มและกระจายรายได้หมุนเวียนสู่ครัวเรือนในพื้นที่ได้อย่างทั่วถึงและมั่นคง',
      mission_title: 'วิสัยทัศน์ &amp; พันธกิจชุมชน',
      mission1: '<strong style="color:var(--green-800);">อนุรักษ์</strong> — รักษาทรัพยากรธรรมชาติและประเพณีล้านนาดั้งเดิมของแม่หอพระ',
      mission2: '<strong style="color:var(--green-800);">แบ่งปัน</strong> — ถ่ายทอดองค์ความรู้การทำเกษตรปลอดภัยและวิถีชุมชนแก่ผู้มาเยือน',
      mission3: '<strong style="color:var(--green-800);">ยั่งยืน</strong> — พัฒนาเศรษฐกิจฐานรากให้ลูกหลานและคนในชุมชนพึ่งพาตนเองได้',
      contact_title: 'พร้อมมาสัมผัสบรรยากาศชุมชนที่แม่หอพระกันหรือยัง',
      contact_desc: 'ติดต่อสอบถามสินค้า บริการ หรือจัดกิจกรรมกลุ่มสำหรับหน่วยงานและครอบครัวได้โดยตรง ทีมงานชุมชนยินดีต้อนรับทุกท่าน',
      contact_btn: 'ติดต่อเรา',
      contact_name: 'คุณพิจิตร',
      contact_location_label: 'ที่ตั้งวิสาหกิจชุมชน',
      contact_address: 'ตำบลแม่หอพระ อำเภอแม่แตง<br>จังหวัดเชียงใหม่',
      contact_hours_label: 'เวลาเปิดกิจกรรม',
      contact_hours_value: 'ทุกวัน 09.00 – 16.00 น.',
      getting_there_title: 'การเดินทางมาแม่หอพระ',
      getting_there_desc: '<p>การเดินทางจากตัวเมืองเชียงใหม่สู่ตำบลแม่หอพระ</p><ul><li><strong>รถยนต์ส่วนตัว:</strong> ใช้ทางหลวงหมายเลข 1001 (เชียงใหม่–พร้าว) ผ่านอำเภอสันทราย มุ่งหน้าสู่อำเภอแม่แตง ตรงเข้าสู่พื้นที่ตำบลแม่หอพระ ระยะทางประมาณ 45–50 กิโลเมตร ใช้เวลาเดินทางราว 50–60 นาที</li><li><strong>รถโดยสารสาธารณะ:</strong> ขึ้นรถสองแถวประจำทางสีแดงสายเชียงใหม่–พร้าว หรือรถตู้ประจำทาง ได้ที่สถานีขนส่งผู้โดยสารแห่งที่ 1 (ขนส่งช้างเผือก) ตัวรถจะวิ่งผ่านเส้นทางหลวง 1001 สามารถแจ้งจุดลงตลอดแนวพื้นที่ตำบลแม่หอพระได้โดยตรง</li></ul>',
      btn_open_maps: 'เปิดใน Google Maps',
      map_iframe_title: 'แผนที่ตำแหน่งเทศบาลตำบลแม่หอพระ',
      qa_title: 'คำถามที่พบบ่อย',
      faq1_q: 'ต้องจองล่วงหน้ากี่วัน?',
      faq1_a: 'แนะนำให้ติดต่อล่วงหน้าอย่างน้อย 2-3 วัน เพื่อให้ทีมงานชุมชนเตรียมกิจกรรมและวัตถุดิบได้ทัน',
      faq2_q: 'มีที่จอดรถหรือไม่?',
      faq2_a: 'มีพื้นที่จอดรถรองรับนักท่องเที่ยว สามารถขับรถส่วนตัวมาได้สะดวก',
      faq3_q: 'รับกรุ๊ปหน่วยงาน/โรงเรียนหรือไม่?',
      faq3_a: 'รับจัดกิจกรรมสำหรับกลุ่มหน่วยงาน โรงเรียน และครอบครัว ติดต่อล่วงหน้าเพื่อออกแบบโปรแกรมให้เหมาะสม',
      qa_form_title: 'มีคำถามอื่น? ส่งถึงเราได้เลย',
      qa_name_label: 'ชื่อของคุณ',
      qa_name_placeholder: 'ชื่อ-นามสกุล',
      qa_contact_label: 'ช่องทางติดต่อกลับ',
      qa_contact_placeholder: 'เบอร์โทรหรืออีเมล',
      qa_question_label: 'คำถามของคุณ',
      qa_question_placeholder: 'พิมพ์คำถามที่นี่...',
      qa_submit_btn: 'ส่งคำถาม',
      qa_sending: 'กำลังส่ง...',
      qa_success: 'ขอบคุณสำหรับคำถาม ทีมงานจะติดต่อกลับโดยเร็วที่สุด',
      qa_fail_generic: 'ส่งคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      qa_fail_network: 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ backend เปิดอยู่ (backend/app.py)',
      footer_copyright: '© วิสาหกิจชุมชนเกษตรเชิงท่องเที่ยวตำบลแม่หอพระ อำเภอแม่แตง จังหวัดเชียงใหม่',
      footer_shop: 'สินค้า/บริการ',
      modal_close: 'ปิด',
      err_no_attractions: 'ยังไม่มีข้อมูลแหล่งท่องเที่ยว',
      err_load_attractions: 'ไม่สามารถโหลดแหล่งท่องเที่ยวได้ในขณะนี้',
      err_no_nearby: 'ยังไม่มีข้อมูล',
      err_load_nearby: 'ไม่สามารถโหลดข้อมูลได้ในขณะนี้',
      highlights_title: 'สิ่งที่น่าสนใจ',
      highlights_desc: 'จุดเด่นและเรื่องน่ารู้อื่น ๆ ของตำบลแม่หอพระที่ไม่ควรพลาด',
      err_no_highlights: 'ยังไม่มีข้อมูล',
      err_load_highlights: 'ไม่สามารถโหลดข้อมูลได้ในขณะนี้',
      err_load_stories: 'ไม่สามารถโหลดเรื่องราวได้ในขณะนี้',
      no_stories_lang: 'ยังไม่มีเรื่องราวในภาษานี้ ลองเปลี่ยนเป็นภาษาไทยดูก่อนได้',
      err_load_products: 'ไม่สามารถโหลดสินค้าได้ในขณะนี้',
      err_load_services: 'ไม่สามารถโหลดบริการได้ในขณะนี้'
    },
    en: {
      page_title: 'Mae Ho Phra Agro-Tourism Community Enterprise',
      page_desc: 'Experience community life, nature, culture, local goods and services of Mae Ho Phra Subdistrict, Mae Taeng, Chiang Mai',
      brand_title: 'Agro-Tourism Community Enterprise',
      brand_subtitle: 'Mae Ho Phra Subdistrict, Mae Taeng, Chiang Mai',
      nav_home: 'Home',
      nav_about: 'About Us',
      nav_attractions: 'Attractions',
      nav_calendar: 'Experience Calendar',
      nav_shop: 'Community Goods & Services',
      nav_stories: 'Stories',
      nav_contact: 'Contact Us',
      hero_badge: 'Mae Ho Phra Agro-Tourism Community Enterprise',
      hero_title: 'Experience Community Life<br>Discover Nature in Mae Ho Phra',
      hero_desc: 'Return to organic farming and traditional Lanna wisdom. Walk through lush green rice fields, learn handicrafts from village elders, and taste authentic local food in Mae Ho Phra Subdistrict, Mae Taeng District, Chiang Mai.',
      hero_btn_shop: 'View Goods & Services',
      hero_btn_about: 'About the Enterprise',
      feat1_title: 'Traditional Organic Farming',
      feat1_desc: 'Learn chemical-free farming methods, grown with natural water and harvested fresh from the fields',
      feat2_title: 'Culture & Traditions',
      feat2_desc: 'Experience traditional Lanna life through a 12-month calendar — from the new rice offering to Songkran and the Mai Kham procession',
      feat3_title: 'Income for the Community',
      feat3_desc: 'Every visit and purchase goes directly to local farmers and the community\'s senior livelihood groups',
      attractions_title: 'Mae Ho Phra Attractions',
      attractions_desc: 'Discover every attraction in the area — nature, temples, and local legends — all just a short distance from the community',
      filter_all: 'All',
      filter_nature: 'Nature',
      filter_culture: 'Culture',
      loading_attractions: 'Loading attractions...',
      seasonal_title: 'Seasonal Recommendations',
      season_summer: 'Summer (Mar–Jun)',
      season_rainy: 'Rainy Season (Jul–Oct)',
      season_winter: 'Winter (Nov–Feb)',
      season_summer_desc: 'Clear mornings, perfect for a walk through the rice fields and to pay respects at Wat Ban Kad before the sun gets hot',
      season_rainy_desc: 'Waterfalls and ponds run full and strong, rice fields are at their greenest — ideal for lovers of lush, water-rich nature',
      season_winter_desc: 'Cool, pleasant weather, great for hiking to the caves and seeing the golden rice fields during harvest',
      map_title: 'Mae Ho Phra Attractions Map',
      map_desc: 'A real map with GPS coordinates for each location — click a pin to see details, then press "View Details" for the full information',
      legend_nature: 'Nature',
      legend_culture: 'Culture',
      view_details: 'View Details →',
      nearby_title: 'Nearby Attractions',
      nearby_desc: 'Extend your trip to well-known attractions in nearby districts — Mae Taeng, San Sai, and Phrao',
      loading_generic: 'Loading...',
      calendar_title: '12-Month Lifestyle & Produce Calendar',
      calendar_desc: 'Select a month to see its traditions, seasonal farm products, and recommended activities',
      cal_tradition_prefix: 'Traditions of {month}',
      cal_activity_tag: 'Recommended Activity',
      cal_products_tag: 'Seasonal Farm Products',
      cal_updating_prefix: 'Updating traditions, farm products, and activities for {month}',
      err_load_calendar: 'Unable to load the calendar right now',
      brand_by: 'Goods & services brand by Rak Phana',
      shop_title: 'Community Goods & Services',
      shop_desc: 'Safe produce from local farmers and tours led by local guides — every purchase brings income back to the Mae Ho Phra community',
      subsection_products: 'Community Products',
      loading_products: 'Loading products...',
      subsection_services: 'Community Services',
      loading_services: 'Loading services...',
      search_products_placeholder: 'Search products by name or tag...',
      search_services_placeholder: 'Search services by name or tag...',
      search_stories_placeholder: 'Search stories by title or date...',
      no_results: 'No matches found',
      tag_all: 'All',
      stories_title: 'Mae Ho Phra Stories',
      stories_desc: 'Legends, ways of life, and local wisdom of Mae Ho Phra, told through stories from the community',
      loading_stories: 'Loading stories...',
      about_title: 'Our History',
      about_p1: 'Mae Ho Phra Agro-Tourism Community Enterprise, Mae Taeng District, Chiang Mai, is a model for local people coming together to turn their agricultural potential and natural resources into sustainable tourism, earning TAT STAR certification from the Tourism Authority of Thailand.',
      about_p2: 'The group stands out as a community research and agricultural innovation center, dedicated to passing on practical knowledge of conservation and biological resource management — most notably its success in cultivating Boletus mushroom spawn — alongside learning-based tourism activities that let visitors experience village life, orchard landscapes, and organic farming up close. The community also focuses on adding value to its produce by processing it into local products and souvenirs, generating steady, widely shared income for households in the area.',
      mission_title: 'Vision &amp; Community Mission',
      mission1: '<strong style="color:var(--green-800);">Conserve</strong> — Preserve the natural resources and traditional Lanna heritage of Mae Ho Phra',
      mission2: '<strong style="color:var(--green-800);">Share</strong> — Pass on knowledge of safe farming and community life to visitors',
      mission3: '<strong style="color:var(--green-800);">Sustain</strong> — Build a grassroots economy so future generations and the community can support themselves',
      contact_title: 'Ready to Experience Mae Ho Phra?',
      contact_desc: 'Reach out directly for products, services, or to arrange group activities for organizations and families. Our community team welcomes everyone.',
      contact_btn: 'Contact Us',
      contact_name: 'Khun Pichit',
      contact_location_label: 'Enterprise Location',
      contact_address: 'Mae Ho Phra Subdistrict, Mae Taeng District<br>Chiang Mai Province',
      contact_hours_label: 'Activity Hours',
      contact_hours_value: 'Daily 09:00 – 16:00',
      getting_there_title: 'Getting to Mae Ho Phra',
      getting_there_desc: '<p>Getting from Chiang Mai city to Mae Ho Phra Subdistrict</p><ul><li><strong>By private car:</strong> Take Highway 1001 (Chiang Mai–Phrao) through San Sai District towards Mae Taeng District, straight into Mae Ho Phra Subdistrict. Approximately 45–50 km, about 50–60 minutes.</li><li><strong>By public transport:</strong> Take a red songthaew (shared truck-taxi) or van on the Chiang Mai–Phrao route from Chang Phueak Bus Terminal (Terminal 1). The route runs along Highway 1001 — just ask the driver to drop you off anywhere along Mae Ho Phra Subdistrict.</li></ul>',
      btn_open_maps: 'Open in Google Maps',
      map_iframe_title: 'Map of Mae Ho Phra Subdistrict Municipal Office',
      qa_title: 'Frequently Asked Questions',
      faq1_q: 'How many days in advance should I book?',
      faq1_a: 'We recommend contacting us at least 2-3 days in advance so our community team can prepare activities and ingredients in time.',
      faq2_q: 'Is parking available?',
      faq2_a: 'Yes, there is parking space for visitors, so driving your own car is convenient.',
      faq3_q: 'Do you accept organization or school groups?',
      faq3_a: 'Yes, we arrange activities for organizations, schools, and families. Please contact us in advance so we can design a suitable program.',
      qa_form_title: 'Have another question? Send it to us',
      qa_name_label: 'Your Name',
      qa_name_placeholder: 'Full name',
      qa_contact_label: 'Contact Information',
      qa_contact_placeholder: 'Phone number or email',
      qa_question_label: 'Your Question',
      qa_question_placeholder: 'Type your question here...',
      qa_submit_btn: 'Send Question',
      qa_sending: 'Sending...',
      qa_success: 'Thank you for your question. Our team will get back to you as soon as possible.',
      qa_fail_generic: 'Failed to send your question. Please try again.',
      qa_fail_network: 'Unable to connect to the server. Please check that the backend server is running (backend/app.py)',
      footer_copyright: '© Mae Ho Phra Agro-Tourism Community Enterprise, Mae Taeng District, Chiang Mai',
      footer_shop: 'Goods/Services',
      modal_close: 'Close',
      err_no_attractions: 'No attractions available yet',
      err_load_attractions: 'Unable to load attractions right now',
      err_no_nearby: 'No data available yet',
      err_load_nearby: 'Unable to load data right now',
      highlights_title: 'Highlights',
      highlights_desc: 'Other notable spots and things worth knowing about Mae Ho Phra Subdistrict',
      err_no_highlights: 'No data available yet',
      err_load_highlights: 'Unable to load data right now',
      err_load_stories: 'Unable to load stories right now',
      no_stories_lang: 'No stories available in this language yet — try switching to Thai',
      err_load_products: 'Unable to load products right now',
      err_load_services: 'Unable to load services right now'
    },
    zh: {
      page_title: '湄贺帕拉农业旅游社区企业',
      page_desc: '体验社区生活，探索清迈府湄殿区湄贺帕拉分区的自然、文化、当地产品与服务',
      brand_title: '农业旅游社区企业',
      brand_subtitle: '清迈府湄殿区湄贺帕拉分区',
      nav_home: '首页',
      nav_about: '关于我们',
      nav_attractions: '旅游景点',
      nav_calendar: '体验日历',
      nav_shop: '社区产品与服务',
      nav_stories: '故事',
      nav_contact: '联系我们',
      hero_badge: '湄贺帕拉农业旅游社区企业',
      hero_title: '体验社区生活<br>探索湄贺帕拉的自然风光',
      hero_desc: '回归有机农业与兰纳传统智慧，漫步在翠绿的稻田间，向长者学习传统手工艺，品尝清迈府湄殿区湄贺帕拉分区的地道美食。',
      hero_btn_shop: '查看产品与服务',
      hero_btn_about: '关于企业',
      feat1_title: '传统有机农业',
      feat1_desc: '了解不依赖化学品的耕作方式，以天然水灌溉，从田间新鲜采收',
      feat2_title: '文化与传统',
      feat2_desc: '通过十二月日历体验传统兰纳生活，包括新米供奉节、宋干节和抬柱游行等',
      feat3_title: '为社区创造收入',
      feat3_desc: '每一次到访与消费都直接惠及当地农民与社区老年人从业群体',
      attractions_title: '湄贺帕拉旅游景点',
      attractions_desc: '汇集当地所有景点，包括自然风光、寺庙与地方传说，皆位于社区附近',
      filter_all: '全部',
      filter_nature: '自然景点',
      filter_culture: '文化景点',
      loading_attractions: '正在加载旅游景点...',
      seasonal_title: '季节推荐景点',
      season_summer: '夏季 (3月–6月)',
      season_rainy: '雨季 (7月–10月)',
      season_winter: '冬季 (11月–2月)',
      season_summer_desc: '清晨天气晴朗，适合漫步稻田并在烈日之前前往班嘎寺参拜',
      season_rainy_desc: '瀑布与水潭水量充沛，稻田翠绿满目，适合喜爱清凉自然风光的游客',
      season_winter_desc: '天气凉爽宜人，适合徒步游览洞穴，并欣赏收获季节的金色稻田',
      map_title: '湄贺帕拉旅游地图',
      map_desc: '根据各景点真实GPS坐标绘制的地图 — 点击图钉查看信息，并点击"查看详情"了解完整内容',
      legend_nature: '自然',
      legend_culture: '文化',
      view_details: '查看详情 →',
      nearby_title: '附近景点',
      nearby_desc: '延伸行程前往邻近区县的知名景点 — 湄殿、圣塞和帕高',
      loading_generic: '正在加载...',
      calendar_title: '十二月生活与农产日历',
      calendar_desc: '选择您感兴趣的月份，查看当月的传统节日、时令农产品与推荐活动',
      cal_tradition_prefix: '{month}传统习俗',
      cal_activity_tag: '推荐活动',
      cal_products_tag: '本月农产品',
      cal_updating_prefix: '正在更新{month}的传统节日、农产品与活动资讯',
      err_load_calendar: '目前无法加载日历',
      brand_by: '产品与服务品牌：Rak Phana',
      shop_title: '社区产品与服务',
      shop_desc: '来自当地农民的安全农产品与本地导览服务 — 每笔消费都为湄贺帕拉社区创造收入',
      subsection_products: '社区产品',
      loading_products: '正在加载产品...',
      subsection_services: '社区服务',
      loading_services: '正在加载服务...',
      search_products_placeholder: '按名称或标签搜索产品...',
      search_services_placeholder: '按名称或标签搜索服务...',
      search_stories_placeholder: '按标题或日期搜索故事...',
      no_results: '未找到符合条件的结果',
      tag_all: '全部',
      stories_title: '湄贺帕拉的故事',
      stories_desc: '通过社区居民讲述的文章，了解湄贺帕拉分区的传说、生活方式与地方智慧',
      loading_stories: '正在加载故事...',
      about_title: '企业历史',
      about_p1: '清迈府湄殿区湄贺帕拉分区农业旅游社区企业，是当地居民联合起来、将农业潜力与自然资源转化为可持续旅游业的典范，并已获得泰国旅游局 TAT STAR 标准认证。',
      about_p2: '该团体作为社区研究与农业创新中心表现突出，致力于切实传授资源保护与生物资源管理知识，尤其在虎掌菌菌种培育方面取得成功，同时设计以学习为主的旅游活动，让游客近距离体验乡村生活、果园风光与有机农业。此外，社区也重视通过将农产品加工成地方产品与伴手礼来提升附加值，为当地家庭创造持续且广泛的收入。',
      mission_title: '愿景与社区使命',
      mission1: '<strong style="color:var(--green-800);">保护</strong> — 保护湄贺帕拉的自然资源与传统兰纳文化',
      mission2: '<strong style="color:var(--green-800);">分享</strong> — 向游客传授安全农业知识与社区生活方式',
      mission3: '<strong style="color:var(--green-800);">可持续</strong> — 发展基层经济，让子孙后代与社区居民能够自立',
      contact_title: '准备好体验湄贺帕拉的社区氛围了吗？',
      contact_desc: '如需咨询产品、服务，或为机关团体与家庭安排团体活动，欢迎直接联系我们，社区团队竭诚欢迎您。',
      contact_btn: '联系我们',
      contact_name: '皮吉先生',
      contact_location_label: '企业地址',
      contact_address: '清迈府湄殿区<br>湄贺帕拉分区',
      contact_hours_label: '活动开放时间',
      contact_hours_value: '每日 09:00 – 16:00',
      getting_there_title: '前往湄贺帕拉的交通方式',
      getting_there_desc: '<p>从清迈市区前往湄贺帕拉分区的交通方式</p><ul><li><strong>自驾：</strong>沿1001号公路（清迈–帕高）经圣塞区前往湄殿区，直达湄贺帕拉分区，全程约45–50公里，车程约50–60分钟。</li><li><strong>公共交通：</strong>可在清迈第一巴士站（象白车站）搭乘清迈–帕高线红色双条车（Songthaew）或小巴，沿1001号公路行驶，可直接告知司机在湄贺帕拉分区沿线下车。</li></ul>',
      btn_open_maps: '在Google地图中打开',
      map_iframe_title: '湄贺帕拉分区市政厅位置地图',
      qa_title: '常见问题',
      faq1_q: '需要提前几天预订？',
      faq1_a: '建议至少提前2-3天联系，以便社区团队准备活动与食材。',
      faq2_q: '是否提供停车位？',
      faq2_a: '有停车位供游客使用，方便自驾前往。',
      faq3_q: '是否接待机关团体或学校团体？',
      faq3_a: '可为机关团体、学校与家庭安排活动，请提前联系以便为您设计合适的行程。',
      qa_form_title: '还有其他问题？欢迎发送给我们',
      qa_name_label: '您的姓名',
      qa_name_placeholder: '姓名',
      qa_contact_label: '联系方式',
      qa_contact_placeholder: '电话号码或电子邮件',
      qa_question_label: '您的问题',
      qa_question_placeholder: '请在此输入您的问题...',
      qa_submit_btn: '提交问题',
      qa_sending: '发送中...',
      qa_success: '感谢您的提问，我们的团队将尽快与您联系。',
      qa_fail_generic: '提交问题失败，请重试。',
      qa_fail_network: '无法连接到服务器，请检查后端服务器是否已启动 (backend/app.py)',
      footer_copyright: '© 湄贺帕拉农业旅游社区企业，清迈府湄殿区',
      footer_shop: '产品/服务',
      modal_close: '关闭',
      err_no_attractions: '暂无旅游景点资料',
      err_load_attractions: '目前无法加载旅游景点',
      err_no_nearby: '暂无资料',
      err_load_nearby: '目前无法加载资料',
      highlights_title: '值得关注的亮点',
      highlights_desc: '湄贺帕拉分区其他值得一看的亮点与趣闻',
      err_no_highlights: '暂无资料',
      err_load_highlights: '目前无法加载资料',
      err_load_stories: '目前无法加载故事',
      no_stories_lang: '此语言暂无故事，可先切换至泰语查看',
      err_load_products: '目前无法加载产品',
      err_load_services: '目前无法加载服务'
    }
  };

  var MONTH_NAMES = {
    th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  };

  function monthName(index) {
    var arr = MONTH_NAMES[currentLang] || MONTH_NAMES.th;
    return arr[index] != null ? arr[index] : '';
  }

  var SUPPORTED = ['th', 'en', 'zh'];
  var STORAGE_KEY = 'site_lang';

  function getSavedLang() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) { /* localStorage unavailable, fall through to default */ }
    return 'th';
  }

  var currentLang = getSavedLang();

  function t(key) {
    var dict = TRANSLATIONS[currentLang] || TRANSLATIONS.th;
    if (dict[key] != null && dict[key] !== '') return dict[key];
    return TRANSLATIONS.th[key] || '';
  }

  function applyLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'th';
    currentLang = lang;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }

    document.documentElement.lang = lang;
    if (t('page_title')) document.title = t('page_title');
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && t('page_desc')) metaDesc.setAttribute('content', t('page_desc'));

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });

    document.querySelectorAll('#lang-switch button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  }

  window.t = t;
  window.applyLanguage = applyLanguage;
  window.getLang = function () { return currentLang; };
  window.monthName = monthName;

  document.addEventListener('DOMContentLoaded', function () {
    var switcher = document.getElementById('lang-switch');
    if (switcher) {
      switcher.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          applyLanguage(btn.getAttribute('data-lang'));
        });
      });
    }
    applyLanguage(currentLang);
  });
})();
