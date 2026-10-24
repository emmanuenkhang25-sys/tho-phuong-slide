-- ############################################################
-- #  DỮ LIỆU DEMO — KHÔNG PHẢI DỮ LIỆU CHÍNH THỨC
-- #
-- #  File này chỉ tạo dữ liệu THỬ NGHIỆM để xem trước giao diện:
-- #   - 1 hội thánh demo
-- #   - 1 chương trình demo kèm 4 mục (khai mạc, hát thờ phượng,
-- #     kinh thánh, bế mạc) và 6 slide mẫu
-- #
-- #  KHÔNG dùng cho hội thánh thật. Khi đưa vào sử dụng chính thức,
-- #  hãy XÓA hội thánh demo này (xóa church sẽ cascade xóa program,
-- #  sections, slides, assets, invitations, audit_logs...).
-- #
-- #  Chạy SAU schema.sql, trong Supabase SQL Editor (role postgres,
-- #  bypass RLS). Có guard idempotent: chạy lại nhiều lần cũng chỉ
-- #  insert 1 lần duy nhất.
-- ############################################################

do $$
declare
  v_church_id  uuid;
  v_program_id uuid;
  v_sec_khaimac uuid := gen_random_uuid();
  v_sec_hat     uuid := gen_random_uuid();
  v_sec_kt      uuid := gen_random_uuid();
  v_sec_bemac   uuid := gen_random_uuid();
  c_demo_name constant text :=
    'Hội Thánh Tin Lành DEMO (dữ liệu thử nghiệm — xóa khi dùng thật)';
begin
  -- Guard idempotent: đã có church demo thì bỏ qua
  if exists (select 1 from public.churches where name = c_demo_name) then
    raise notice 'DEMO đã tồn tại — bỏ qua seed.';
    return;
  end if;

  -- 1 hội thánh demo (created_by null vì chưa có user thật;
  -- trigger handle_new_church bỏ qua khi created_by null)
  insert into public.churches (name, contact_info, settings)
  values (
    c_demo_name,
    'DỮ LIỆU DEMO — liên hệ quản trị viên để xóa khi dùng thật',
    '{"demo": true}'::jsonb
  )
  returning id into v_church_id;

  -- 1 chương trình demo
  insert into public.programs
    (church_id, title, event_date, leader, theme, theme_verse, aspect_ratio, status)
  values (
    v_church_id,
    'Chương trình thờ phượng Chúa nhật (DEMO)',
    current_date,
    'Mục sư Demo',
    'Ân điển diệu kỳ',
    'Ê-phê-sô 2:8',
    '16:9',
    'draft'
  )
  returning id into v_program_id;

  -- 4 mục theo mã kind chuẩn CONTRACT 3.5.1
  insert into public.sections (id, program_id, title, kind, order_index)
  values
    (v_sec_khaimac, v_program_id, 'Khai mạc',       'khai-mac',       0),
    (v_sec_hat,     v_program_id, 'Hát thờ phượng', 'hat-tho-phuong', 1),
    (v_sec_kt,      v_program_id, 'Kinh Thánh',     'kinh-thanh',     2),
    (v_sec_bemac,   v_program_id, 'Bế mạc',         'be-mac',         3);

  -- 6 slide mẫu — content đúng shape CONTRACT 3.6.1
  -- (objects có x/y/w/h theo %, text tiếng Việt có dấu),
  -- background đúng shape CONTRACT 3.6.2
  insert into public.slides (program_id, section_id, order_index, content, background)
  values
  -- Slide 1: trang bìa chào mừng
  (v_program_id, v_sec_khaimac, 0,
   '{"objects":[
      {"id":"demo-s1-t1","type":"text","x":10,"y":16,"w":80,"h":22,
       "text":"CHÀO MỪNG","fontSize":64,"color":"#ffffff","bold":true,"align":"center"},
      {"id":"demo-s1-line","type":"shape","shape":"rect","x":42,"y":42,"w":16,"h":1.2,
       "fill":"#ffd166"},
      {"id":"demo-s1-t2","type":"text","x":10,"y":46,"w":80,"h":12,
       "text":"Buổi thờ phượng Chúa nhật","fontSize":34,"color":"#ffe9a8","align":"center"},
      {"id":"demo-s1-t3","type":"text","x":10,"y":60,"w":80,"h":10,
       "text":"Hội Thánh Tin Lành DEMO","fontSize":24,"color":"#cfe3ff","align":"center"}
    ]}'::jsonb,
   '{"type":"gradient","gradient":{"from":"#1e3a5f","to":"#0f2027","angle":135},
     "overlayOpacity":0.3}'::jsonb),

  -- Slide 2: cầu nguyện khai mạc
  (v_program_id, v_sec_khaimac, 1,
   '{"objects":[
      {"id":"demo-s2-t1","type":"text","x":10,"y":14,"w":80,"h":14,
       "text":"Cầu nguyện khai mạc","fontSize":44,"color":"#ffffff","bold":true,"align":"center"},
      {"id":"demo-s2-t2","type":"text","x":15,"y":36,"w":70,"h":30,
       "text":"Xin Chúa hiện diện, dẫn dắt và ban phước cho buổi thờ phượng hôm nay.",
       "fontSize":28,"color":"#f2f5fa","align":"center","lineHeight":1.6}
    ]}'::jsonb,
   '{"type":"color","color":"#243b55"}'::jsonb),

  -- Slide 3: thánh ca 1
  (v_program_id, v_sec_hat, 2,
   '{"objects":[
      {"id":"demo-s3-t1","type":"text","x":10,"y":10,"w":80,"h":12,
       "text":"Thánh ca: Tôn Vinh Chúa","fontSize":40,"color":"#ffffff","bold":true,"align":"center"},
      {"id":"demo-s3-t2","type":"text","x":15,"y":30,"w":70,"h":50,
       "text":"Hát khen Chúa từ ái vô biên,\nNgợi khen danh Ngài đời đời.\nA-men!",
       "fontSize":32,"color":"#fff8e1","align":"center","lineHeight":1.8}
    ]}'::jsonb,
   '{"type":"gradient","gradient":{"from":"#4a2c6a","to":"#1d1147","angle":120}}'::jsonb),

  -- Slide 4: thánh ca 2
  (v_program_id, v_sec_hat, 3,
   '{"objects":[
      {"id":"demo-s4-t1","type":"text","x":10,"y":10,"w":80,"h":12,
       "text":"Thánh ca: Ngợi Khen Ngài","fontSize":40,"color":"#ffffff","bold":true,"align":"center"},
      {"id":"demo-s4-t2","type":"text","x":15,"y":30,"w":70,"h":50,
       "text":"Ngợi khen Chúa, Đấng chăn giữ tôi,\nLòng tôi vui mừng trong Ngài.\nHa-lê-lu-gia!",
       "fontSize":32,"color":"#e8f5e9","align":"center","lineHeight":1.8}
    ]}'::jsonb,
   '{"type":"gradient","gradient":{"from":"#0f5132","to":"#071f16","angle":120}}'::jsonb),

  -- Slide 5: câu Kinh Thánh
  (v_program_id, v_sec_kt, 4,
   '{"objects":[
      {"id":"demo-s5-t1","type":"text","x":10,"y":10,"w":80,"h":10,
       "text":"Câu Kinh Thánh","fontSize":30,"color":"#ffe9a8","align":"center"},
      {"id":"demo-s5-t2","type":"text","x":10,"y":22,"w":80,"h":14,
       "text":"Giăng 3:16","fontSize":52,"color":"#ffffff","bold":true,"align":"center"},
      {"id":"demo-s5-t3","type":"text","x":12,"y":42,"w":76,"h":40,
       "text":"Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con Một của Ngài, hầu cho hễ ai tin Con ấy không bị hư mất mà được sự sống đời đời.",
       "fontSize":30,"color":"#fdfdfd","align":"center","lineHeight":1.7}
    ]}'::jsonb,
   '{"type":"color","color":"#1a2332","overlayOpacity":0.2}'::jsonb),

  -- Slide 6: bế mạc, chúc bình an
  (v_program_id, v_sec_bemac, 5,
   '{"objects":[
      {"id":"demo-s6-t1","type":"text","x":10,"y":14,"w":80,"h":12,
       "text":"Bế mạc","fontSize":44,"color":"#ffffff","bold":true,"align":"center"},
      {"id":"demo-s6-t2","type":"text","x":15,"y":36,"w":70,"h":30,
       "text":"Nguyện xin ân điển của Chúa Giê-xu ở cùng anh chị em. A-men!",
       "fontSize":30,"color":"#ffe9a8","align":"center","lineHeight":1.7},
      {"id":"demo-s6-t3","type":"text","x":10,"y":70,"w":80,"h":10,
       "text":"Hẹn gặp lại Chúa nhật tuần sau","fontSize":22,"color":"#cfe3ff","align":"center"}
    ]}'::jsonb,
   '{"type":"gradient","gradient":{"from":"#3a1c5e","to":"#12081f","angle":135}}'::jsonb);

  raise notice 'Seed DEMO xong: church %, program %', v_church_id, v_program_id;
end $$;
