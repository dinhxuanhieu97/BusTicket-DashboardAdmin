import Link from "next/link";
import { PageHero } from "@/components/ui/page-hero";
import { HELP, SHORTCUTS } from "@/lib/help";
import { groupNav, visibleNav } from "@/lib/nav";
import { pageAccess } from "@/lib/server/page-access";
import { redirect } from "next/navigation";

export default async function Page() {
  const access = await pageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return null;
  }
  const groups = groupNav(
    visibleNav(access.session.permissions).filter((i) => i.key !== "help"),
  );
  return (
    <div className="pn-page-stack">
      <PageHero
        title="Trợ giúp"
        description="Mỗi mục trong menu dùng để làm gì, và các phím tắt."
        note="Bạn chỉ thấy những mục tài khoản được phép dùng."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="pn-page-stack min-w-0">
          {groups.map((group) => (
            <section
              key={group.id}
              className="card p-5"
              aria-labelledby={`help-${group.id}`}
            >
              <h3
                id={`help-${group.id}`}
                className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase"
              >
                {group.title}
              </h3>
              <dl>
                {group.items.map((item) => (
                  <div key={item.key} className="pn-list-row items-start">
                    <dt className="w-32 shrink-0 font-medium sm:w-40">
                      <Link
                        href={item.href}
                        className="text-accent hover:underline"
                      >
                        {item.label}
                      </Link>
                    </dt>
                    <dd className="min-w-0 text-sm text-muted">
                      {HELP[item.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <section
          className="card min-w-0 p-5 xl:self-start"
          aria-labelledby="help-keys"
        >
          <h3 id="help-keys" className="font-semibold">
            Phím tắt
          </h3>
          <ul className="mt-2" aria-label="Phím tắt">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="pn-list-row">
                <span className="flex shrink-0 gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="pn-kbd">
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="text-sm text-muted">{s.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
