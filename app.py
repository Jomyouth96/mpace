
import streamlit as st

# ตั้งชื่อแท็บบนเบราว์เซอร์
st.set_page_config(page_title="Rak Pana | รักษ์พนา", page_icon="🌿", layout="wide")

# แบนเนอร์หัวเว็บพร้อมแสดงโลโก้วิสาหกิจ
col_head1, col_head2, col_head3 = st.columns([1, 4, 1])

with col_head2:
    sub_c1, sub_c2 = st.columns([1, 3])
    with sub_c1:
        st.image("LOGO+BN/logo.png", width=140)
    with sub_c2:
        st.markdown("<h1 style='color:#1B4D2E; margin: 15px 0 5px 0; font-size:2.3rem;'>รักษ์พนา (Rak Pana)</h1>", unsafe_allow_html=True)
        st.markdown("<p style='color:#E08E2B; font-weight:600; margin:0;'>วิสาหกิจชุมชนเกษตรเชิงท่องเที่ยวตำบลแม่หอพระ</p>", unsafe_allow_html=True)
        st.caption("อำเภอแม่แตง จังหวัดเชียงใหม่ • Authentic Agro-Tourism")

st.markdown("---")
# เว้นบรรทัดเล็กน้อย
st.write("")

# สร้างแท็บเมนูหลัก 6 แท็บ
tab_home, tab_about, tab_cal, tab_tour, tab_shop, tab_story = st.tabs([
    "🏡 หน้าหลัก",
    "🌿 เกี่ยวกับเรา",
    "📅 ปฏิทินประสบการณ์", 
    "🧭 แพ็คเกจท่องเที่ยว", 
    "🛍️ สินค้าชุมชน", 
    "📖 เรื่องเล่าแม่หอพระ"
])

# ใส่ข้อความจำลองในแต่ละแท็บไว้ก่อน
# ----------------- หน้าหลัก (Home) -----------------
with tab_home:
    st.markdown("""
    <div style="background: linear-gradient(rgba(27,77,46,0.8), rgba(27,77,46,0.8)), url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80');
                background-size: cover; background-position: center; padding: 3rem 2rem; border-radius: 16px; text-align: center; color: white; margin-bottom: 1.5rem;">
        <h2 style="font-size: 2.2rem; margin: 0; color: white;">ยินดีต้อนรับสู่ รักษ์พนา</h2>
        <p style="font-size: 1.1rem; opacity: 0.95; margin-top: 0.5rem;">
            เปิดประสบการณ์ท่องเที่ยวเชิงเกษตร สัมผัสวิถีชีวิตชาวแม่หอพระ และธรรมชาติอันสมบูรณ์
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    col_h1, col_h2, col_h3 = st.columns(3)
    with col_h1:
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E;">🌱 เกษตรอินทรีย์วิถีพื้นบ้าน</h4>
            <p style="color:#666; font-size:0.95rem;">เรียนรู้การทำเกษตรที่ไม่พึ่งสารเคมี ปลูกด้วยน้ำธรรมชาติ และเก็บเกี่ยวสดใหม่จากแปลง</p>
        </div>
        """, unsafe_allow_html=True)
    with col_h2:
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E;">🏮 วัฒนธรรมและประเพณี</h4>
            <p style="color:#666; font-size:0.95rem;">สัมผัสวิถีล้านนาดั้งเดิมผ่านปฏิทิน 12 เดือน ทั้งตานข้าวใหม่ สงกรานต์แห่ไม้ค้ำ และเวียนเทียน</p>
        </div>
        """, unsafe_allow_html=True)
    with col_h3:
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E;">🤝 กระจายรายได้สู่ชุมชน</h4>
            <p style="color:#666; font-size:0.95rem;">ทุกการเดินทางและการอุดหนุนสินค้า ส่งตรงถึงมือเกษตรกรและกลุ่มอาชีพผู้สูงอายุในพื้นที่</p>
        </div>
        """, unsafe_allow_html=True)

with tab_cal:
    st.subheader("🌾 ปฏิทินวิถีชีวิตและผลผลิต 12 เดือน")
    st.caption("เลือกเดือนเพื่อดูประเพณี กิจกรรมลงมือทำ และผลผลิตการเกษตรประจำฤดู")
    
    # ตัวเลื่อนเลือกเดือน
    selected_month = st.select_slider(
        "เลือกช่วงเวลาเดินทาง:",
        options=[
            "ม.ค. (ตานข้าวใหม่)", 
            "ก.พ. (มาฆบูชา)", 
            "มี.ค. (เกี่ยวข้าวแล้ง)", 
            "เม.ย. (ปี๋ใหม่เมือง)"
        ],
        value="ม.ค. (ตานข้าวใหม่)"
    )
    
    st.write("")
    col_left, col_right = st.columns(2)
    
    # กล่องสไตล์การ์ดขอบมนสีขาว
    card_style = """
        background-color: #FFFFFF;
        padding: 1.5rem;
        border-radius: 12px;
        border: 1px solid #E0E7E1;
        box-shadow: 0 4px 10px rgba(0,0,0,0.03);
    """
    
    if "ม.ค." in selected_month:
        with col_left:
            st.markdown(f"""
            <div style="{card_style}">
                <span style="background-color:#EBF3ED; color:#1B4D2E; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">ประเพณีประจำเดือน</span>
                <h3 style="color:#1B4D2E; margin-top:0.6rem;">🌾 ตานข้าวใหม่</h3>
                <p style="color:#444; line-height:1.6;">
                    ประเพณีถวายข้าวที่เพิ่งเกี่ยวใหม่แด่พระสงฆ์ตามวิถีชาวพุทธล้านนา เพื่อความเป็นสิริมงคลและความกตัญญูต่อแม่โพสพ
                </p>
                <hr style="border:none; border-top:1px solid #EFEFEF; margin:1rem 0;">
                <p style="margin:0;"><strong>ผลผลิตไฮไลต์:</strong> ข้าวเหนียวพันธุ์พื้นเมือง, ข้าวหอมอินทรีย์แม่หอพระ</p>
            </div>
            """, unsafe_allow_html=True)
            
        with col_right:
            st.markdown(f"""
            <div style="{card_style}">
                <span style="background-color:#EBF3ED; color:#1B4D2E; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">FIT Hands-on Workshop</span>
                <h3 style="color:#1B4D2E; margin-top:0.6rem;">🔥 ปิ้งข้าวจี่โบราณ</h3>
                <p style="color:#444; line-height:1.6;">
                    • นึ่งข้าวใหม่ด้วยหวดไม้ไผ่แบบดั้งเดิม<br>
                    • ปั้นและปิ้งข้าวจี่ทาไข่เตาถ่านหอมกรุ่น<br>
                    • ร่วมทำบุญตานข้าวใหม่ยามเช้ากับคนในชุมชน
                </p>
            </div>
            """, unsafe_allow_html=True)
            st.button("จองประสบการณ์เดือนมกราคม", key="btn_jan")
            
    elif "เม.ย." in selected_month:
        with col_left:
            st.markdown(f"""
            <div style="{card_style}">
                <span style="background-color:#EBF3ED; color:#1B4D2E; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">ประเพณีประจำเดือน</span>
                <h3 style="color:#1B4D2E; margin-top:0.6rem;">💦 ปี๋ใหม่เมือง & แห่ไม้ค้ำสะหลี</h3>
                <p style="color:#444; line-height:1.6;">
                    สืบสานป๋าเวณีสงกรานต์ล้านนา ร่วมขบวนแห่ไม้ค้ำต้นโพธิ์เพื่อค้ำจุนพระศาสนาและชีวิตให้อยู่ร่มเย็นเป็นสุข
                </p>
                <hr style="border:none; border-top:1px solid #EFEFEF; margin:1rem 0;">
                <p style="margin:0;"><strong>ผลผลิตไฮไลต์:</strong> มะม่วงพื้นเมือง, พืชผักและดอกไม้หน้าร้อน</p>
            </div>
            """, unsafe_allow_html=True)
            
        with col_right:
            st.markdown(f"""
            <div style="{card_style}">
                <span style="background-color:#EBF3ED; color:#1B4D2E; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">FIT Hands-on Workshop</span>
                <h3 style="color:#1B4D2E; margin-top:0.6rem;">🪵 ตกแต่งไม้ค้ำ & สรงน้ำพระ</h3>
                <p style="color:#444; line-height:1.6;">
                    • ประดิษฐ์สวยดอกและตกแต่งไม้ค้ำสะหลี<br>
                    • รดน้ำดำหัวผู้เฒ่าผู้แก่ด้วยน้ำขมิ้นส้มป่อย<br>
                    • ร่วมขบวนแห่ดนตรีพื้นเมืองล้านนา
                </p>
            </div>
            """, unsafe_allow_html=True)
            st.button("จองประสบการณ์เดือนเมษายน", key="btn_apr")
            
    else:
        st.info("💡 กำลังอัปเดตรายละเอียดกิจกรรมและผลผลิตของเดือนนี้")

with tab_tour:
    st.subheader("🧭 ประสบการณ์ท่องเที่ยวชุมชนแม่หอพระ")
    st.caption("ออกแบบสำหรับนักท่องเที่ยวอิสระ (FIT) ที่ต้องการสัมผัสวิถีชีวิตจริง")
    
    t_col1, t_col2 = st.columns(2)
    
    with t_col1:
        st.image("https://images.unsplash.com/photo-1592417817098-8f3d6910985c?auto=format&fit=crop&w=600&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <span style="background-color:#EBF3ED; color:#1B4D2E; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">1-Day Trip</span>
            <h3 style="color:#1B4D2E; margin-top:0.6rem;">🍃 One Day Agro-Life</h3>
            <p style="color:#555; line-height:1.5;">เดินชมแปลงเกษตรอินทรีย์ ชิมผลไม้ตามฤดูกาลสดจากต้น และร่วมปรุงอาหารพื้นบ้านกับกลุ่มแม่บ้านชุมชน</p>
            <p style="margin:0; font-size:1.2rem; font-weight:bold; color:#1B4D2E;">฿ 1,200 <span style="font-size:0.85rem; font-weight:normal; color:#666;">/ ท่าน</span></p>
        </div>
        """, unsafe_allow_html=True)
        st.button("จองทริป 1 วัน (1-Day)", key="t_btn1")

    with t_col2:
        st.image("https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <span style="background-color:#EBF3ED; color:#1B4D2E; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">2 Days 1 Night</span>
            <h3 style="color:#1B4D2E; margin-top:0.6rem;">🏡 โฮมสเตย์วิถีรักษ์พนา</h3>
            <p style="color:#555; line-height:1.5;">พักผ่อนท่ามกลางสวนเกษตร สัมผัสสายหมอกยามเช้า ปลูกผักอินทรีย์ และล้อมวงคุยรอบกองไฟยามค่ำ</p>
            <p style="margin:0; font-size:1.2rem; font-weight:bold; color:#1B4D2E;">฿ 2,200 <span style="font-size:0.85rem; font-weight:normal; color:#666;">/ ท่าน (รวมอาหาร)</span></p>
        </div>
        """, unsafe_allow_html=True)
        st.button("จองทริปโฮมสเตย์ (2D1N)", key="t_btn2")

with tab_shop:
    st.subheader("🛍️ ผลิตภัณฑ์ชุมชนรักษ์พนา (Mae Ho Phra Goods)")
    st.caption("ผลผลิตปลอดภัยจากเกษตรกรและงานหัตถกรรมพื้นบ้าน ส่งตรงถึงมือคุณ")
    
    p1, p2, p3 = st.columns(3)
    
    with p1:
        st.image("https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E; margin:0 0 0.4rem 0;">🌾 ข้าวกล้องอินทรีย์</h4>
            <p style="color:#666; font-size:0.9rem; line-height:1.4;">ข้าวพันธุ์พื้นเมืองคัดพิเศษ ปลอดสารพิษ 100% ปลูกด้วยน้ำธรรมชาติ</p>
            <p style="font-size:1.15rem; font-weight:bold; color:#1B4D2E; margin:0.5rem 0 0 0;">฿ 120 / กก.</p>
        </div>
        """, unsafe_allow_html=True)
        st.button("สั่งซื้อข้าวกล้อง", key="btn_p1")

    with p2:
        st.image("https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=500&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E; margin:0 0 0.4rem 0;">🍵 ชาสมุนไพรป่า</h4>
            <p style="color:#666; font-size:0.9rem; line-height:1.4;">ชาสมุนไพรอบแห้ง กลิ่นหอมสดชื่น รสชาตินุ่มละมุน เสริมสร้างภูมิคุ้มกัน</p>
            <p style="font-size:1.15rem; font-weight:bold; color:#1B4D2E; margin:0.5rem 0 0 0;">฿ 180 / กล่อง</p>
        </div>
        """, unsafe_allow_html=True)
        st.button("สั่งซื้อชาสมุนไพร", key="btn_p2")

    with p3:
        st.image("https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=500&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E; margin:0 0 0.4rem 0;">🧺 ชะลอมจักสานไม้ไผ่</h4>
            <p style="color:#666; font-size:0.9rem; line-height:1.4;">งานฝีมือประณีตจากภูมิปัญญาผู้เฒ่าผู้แก่แม่หอพระ ใช้วัสดุธรรมชาติ</p>
            <p style="font-size:1.15rem; font-weight:bold; color:#1B4D2E; margin:0.5rem 0 0 0;">฿ 85 / ชิ้น</p>
        </div>
        """, unsafe_allow_html=True)
        st.button("สั่งซื้อชะลอมสาน", key="btn_p3")

with tab_shop:
    st.subheader("🛍️ ผลิตภัณฑ์ชุมชนรักษ์พนา (Mae Ho Phra Goods)")
    st.caption("ผลผลิตปลอดภัยจากเกษตรกรและงานหัตถกรรมพื้นบ้าน ส่งตรงถึงมือคุณ")
    
    p1, p2, p3 = st.columns(3)
    
    with p1:
        st.image("https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E; margin:0 0 0.4rem 0;">🌾 ข้าวกล้องอินทรีย์</h4>
            <p style="color:#666; font-size:0.9rem; line-height:1.4;">ข้าวพันธุ์พื้นเมืองคัดพิเศษ ปลอดสารพิษ 100% ปลูกด้วยน้ำธรรมชาติ</p>
            <p style="font-size:1.15rem; font-weight:bold; color:#1B4D2E; margin:0.5rem 0 0 0;">฿ 120 / กก.</p>
        </div>
        """, unsafe_allow_html=True)
        st.button("สั่งซื้อข้าวกล้อง", key="btn_shop_rice_unique")

    with p2:
        st.image("https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=500&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E; margin:0 0 0.4rem 0;">🍵 ชาสมุนไพรป่า</h4>
            <p style="color:#666; font-size:0.9rem; line-height:1.4;">ชาสมุนไพรอบแห้ง กลิ่นหอมสดชื่น รสชาตินุ่มละมุน เสริมสร้างภูมิคุ้มกัน</p>
            <p style="font-size:1.15rem; font-weight:bold; color:#1B4D2E; margin:0.5rem 0 0 0;">฿ 180 / กล่อง</p>
        </div>
        """, unsafe_allow_html=True)
        st.button("สั่งซื้อสมุนไพร", key="btn_shop_herb_unique")

    with p3:
        st.image("https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=500&q=80", use_container_width=True)
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E; margin:0 0 0.4rem 0;">🧺 ชะลอมจักสานไม้ไผ่</h4>
            <p style="color:#666; font-size:0.9rem; line-height:1.4;">งานฝีมือประณีตจากภูมิปัญญาผู้เฒ่าผู้แก่แม่หอพระ ใช้วัสดุธรรมชาติ</p>
            <p style="font-size:1.15rem; font-weight:bold; color:#1B4D2E; margin:0.5rem 0 0 0;">฿ 85 / ชิ้น</p>
        </div>
        """, unsafe_allow_html=True)
        st.button("เครื่องจักสาน", key="btn_shop_basket_unique")

# ----------------- เกี่ยวกับเรา (About) -----------------
with tab_about:
    st.subheader("🌿 เกี่ยวกับวิสาหกิจชุมชนเกษตรเชิงท่องเที่ยวตำบลแม่หอพระ")
    
    col_ab1, col_ab2 = st.columns([1, 1])
    with col_ab1:
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E;">จุดเริ่มต้นของแบรนด์ 'รักษ์พนา'</h4>
            <p style="color:#444; line-height:1.7;">
                <strong>รักษ์พนา</strong> ถือกำเนิดจากการรวมกลุ่มของชาวบ้านและเกษตรกรในตำบลแม่หอพระ อำเภอแม่แตง จังหวัดเชียงใหม่ 
                เพื่อขับเคลื่อนการท่องเที่ยวเชิงเกษตรที่ยั่งยืน โดยนำต้นทุนทางธรรมชาติและภูมิปัญญาท้องถิ่นมาสร้างคุณค่า
            </p>
            <p style="color:#444; line-height:1.7;">
                เรามุ่งเน้นการเปิดพื้นที่ให้นักท่องเที่ยว โดยเฉพาะนักเดินทางอิสระ (FIT) ได้เข้ามามีส่วนร่วมกับวิถีชีวิตจริง 
                พร้อมส่งเสริมสินค้าเกษตรอินทรีย์แปรรูปที่สร้างรายได้กลับคืนสู่ชุมชนอย่างเป็นธรรม
            </p>
        </div>
        """, unsafe_allow_html=True)
    
    with col_ab2:
        st.markdown(f"""
        <div style="{card_style}">
            <h4 style="color:#1B4D2E;">วิสัยทัศน์ & พันธกิจชุมชน</h4>
            <ul style="color:#444; line-height:1.8;">
                <li><strong>อนุรักษ์:</strong> รักษาทรัพยากรธรรมชาติและประเพณีล้านนาดั้งเดิมของแม่หอพระ</li>
                <li><strong>แบ่งปัน:</strong> ถ่ายทอดองค์ความรู้การทำเกษตรปลอดภัยและวิถีชุมชนแก่ผู้มาเยือน</li>
                <li><strong>ยั่งยืน:</strong> พัฒนาเศรษฐกิจฐานรากให้ลูกหลานและคนในชุมชนพึ่งพาตนเองได้</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
