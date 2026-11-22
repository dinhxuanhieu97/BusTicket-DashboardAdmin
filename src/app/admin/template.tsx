// Next.js mounts a template again on every navigation between admin pages,
// so the enter animation plays each time the user opens another page.
export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pn-page-enter">{children}</div>;
}
