import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Button } from '../components/ui';

const FEATURES = [
  {
    icon: '📝',
    title: 'Soạn chương trình thờ phượng',
    desc: 'Sắp xếp các mục: đón tiếp, cầu nguyện, hát thờ phượng, giảng luận… theo đúng trật tự buổi lễ của Hội thánh bạn.',
  },
  {
    icon: '🖼️',
    title: 'Slide đẹp, chữ Việt chuẩn',
    desc: 'Thánh ca, Kinh Thánh hiển thị rõ ràng trên phông nền trang nhã. Hỗ trợ màn hình 16:9 và 4:3.',
  },
  {
    icon: '📱',
    title: 'Điều khiển từ xa bằng điện thoại',
    desc: 'Người trình chiếu chuyển slide ngay trên điện thoại qua mã ghép nối — không cần đứng gần máy tính.',
  },
  {
    icon: '📤',
    title: 'Xuất PowerPoint & PDF',
    desc: 'Xuất file .pptx để chỉnh sửa tiếp, hoặc PDF để in ấn và chia sẻ cho ban thờ phượng.',
  },
  {
    icon: '⛪',
    title: 'Đa Hội thánh, phân quyền rõ ràng',
    desc: 'Chủ sở hữu, quản trị viên, biên tập viên, người trình chiếu, người xem — mỗi người một vai trò.',
  },
  {
    icon: '📴',
    title: 'Làm việc cả khi mất mạng',
    desc: 'Bản nháp tự lưu trên máy, có mạng sẽ tự đồng bộ lên đám mây — không lo mất bài.',
  },
];

export function Landing() {
  const { user, initialized } = useAuth();
  if (initialized && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-church-900 via-church-800 to-church-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Thờ Phượng Slide" className="h-10 w-10" />
          <span className="text-xl font-bold">Thờ Phượng Slide</span>
        </div>
        <div className="flex gap-2">
          <Link to="/dang-nhap">
            <Button variant="ghost" className="!text-white hover:!bg-white/10">
              Đăng nhập
            </Button>
          </Link>
          <Link to="/dang-ky">
            <Button className="!bg-gold-400 !text-church-950 hover:!bg-gold-500">Đăng ký miễn phí</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="py-16 text-center md:py-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-400">
            Dành cho Hội thánh Tin Lành Việt Nam
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            Slide thờ phượng đẹp,
            <br />
            soạn trong vài phút
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-church-100">
            Từ chương trình buổi lễ đến từng slide thánh ca và Kinh Thánh — Thờ Phượng Slide giúp ban
            thờ phượng chuẩn bị chu đáo, trình chiếu trang trọng, và điều khiển dễ dàng ngay trên điện thoại.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/dang-ky">
              <Button className="!bg-gold-400 !text-church-950 hover:!bg-gold-500 !px-8 !py-3 !text-base">
                Bắt đầu miễn phí
              </Button>
            </Link>
            <Link to="/dang-nhap">
              <Button variant="secondary" className="!px-8 !py-3 !text-base !bg-white/10 !text-white hover:!bg-white/20">
                Tôi đã có tài khoản
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/10 p-6 backdrop-blur">
              <div className="mb-3 text-3xl" aria-hidden>
                {f.icon}
              </div>
              <h2 className="mb-2 text-lg font-bold">{f.title}</h2>
              <p className="text-sm leading-relaxed text-church-100">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
          <h2 className="text-2xl font-bold">Sẵn sàng cho buổi thờ phượng cuối tuần này?</h2>
          <p className="mt-2 text-church-100">
            Tạo hội thánh của bạn, mời ban thờ phượng cùng soạn — mọi thứ lưu trên đám mây, an toàn.
          </p>
          <Link to="/dang-ky" className="mt-6 inline-block">
            <Button className="!bg-gold-400 !text-church-950 hover:!bg-gold-500 !px-8 !py-3 !text-base">
              Tạo tài khoản ngay
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-church-200">
        Thờ Phượng Slide — Phục vụ Hội thánh bằng công nghệ, vì sự vinh hiển của Chúa.
      </footer>
    </div>
  );
}

export default Landing;
